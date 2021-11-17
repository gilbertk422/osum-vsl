import {HttpStatus, Injectable, Logger} from '@nestjs/common';
import {exec} from '../shared/helpers/shell.helper';
import {Subtitle} from "../shared/shared.interface";
import {StoreService} from "../shared/services/store/store.service";
import {GcpService} from "../shared/services/gcp/gcp.service";
import {GoogleVideoAIService} from "./google-video-ai.service";
import {ThumborService} from "./thumbor.service";
import * as uuid from "uuid";
import {MEDIAPIPE_DIMENSIONS} from "./media-pipe.constant";
import {resizeVideo} from "../shared/helpers/video.helper";
import {sleep} from "../shared/helpers/util.helper";
import {VIDEO_AI_LOCATION} from "./google-video-ai.constant";
import {VideoIntelligenceServiceClient, v1, protos} from '@google-cloud/video-intelligence';


@Injectable()
export class MediaPipeService {

  private readonly logger = new Logger(MediaPipeService.name);
  videoClient: v1.VideoIntelligenceServiceClient;
  public authClient;
  videointelligenceUrl = `https://videointelligence.googleapis.com/v1/videos:annotate`;

  constructor(
      private readonly storeService: StoreService,
      private readonly gcpService: GcpService,
      private readonly googleVideoAIService: GoogleVideoAIService,
      private readonly thumborService: ThumborService,
  ) {
  }
  /**
   * Run autoflip of mediapipe
   * @param inputVideo
   * @param outputVideo
   * @param ratio
   */
  async autoFlip(inputVideo, outputVideo, ratio) {
    let cmd = process.env.MEDIAPIPE_COMMAND;
    cmd = cmd.replace(/\$\{inputVideo\}/g, inputVideo);
    cmd = cmd.replace(/\$\{outputVideo\}/g, outputVideo);
    cmd = cmd.replace(/\$\{ratio\}/g, ratio);

    await exec(cmd);
    return outputVideo;
  }

  /**
   *
   * @param item
   * @param videoIndex
   * @param tempDir
   * @param videoObjects
   * @param sceneDurations
   * @param footageDurations
   * @param jobId
   * @return processed video item
   */
  async cutVideo(item: Subtitle, videoIndex: number, tempDir: string, videoObjects, sceneDurations, footageDurations, jobId: string): Promise<Subtitle> {
    this.logger.debug(`Getting high activity for index: ${videoIndex} (video '${tempDir}/input_video-${videoIndex}.mp4')`);

    const highActivityInterval =
        this.googleVideoAIService.getHighActivityInterval(videoObjects[videoIndex], sceneDurations[videoIndex], footageDurations[videoIndex]);

    this.logger.debug(`Completed get high activity for index: ${videoIndex} (video '${tempDir}/input_video-${videoIndex}.mp4')`);

    this.logger.debug(`Starting getClipVideo - input: ${tempDir}/input_video-${videoIndex}.mp4`);

    // cut video by highest activity time
    const path = await this.googleVideoAIService.getClipVideo(
        `${tempDir}/input_video-${videoIndex}.mp4`,
        `${tempDir}/clip-${videoIndex}.mp4`,
        highActivityInterval.startTime,
        highActivityInterval.endTime
    );

    this.logger.debug(`Completed clip video for index: ${videoIndex} (video '${tempDir}/input_video-${videoIndex}.mp4'), path: ${path}`);

    // Calculator::Open() for node "OpenCvVideoDecoderCalculator" failed: ; Fail to open video file at /home/ubuntu/osum_vsl/tmp/3402c0b6-f59f-401c-a27a-6c5bc9e33a0b/clip-1.mp4

    item.content = {landscape: '', portrait: '', square: ''};
    const dimensions = ['landscape', 'portrait', 'square'];

    // each autoflip process starts few autoflip & ffmpeg treads.
    // we need to run autoflip one by one to avoid large number of running  autoflip & ffmpeg treads,
    // which require a lot of CPU, the instance being unresponsive and the job recognized as stalled and killed.
    for (let idx = 0; idx < dimensions.length; idx++) {

      const dimension = dimensions[idx];
      item.content[dimension] = await this.resizeVideoWithAutoFlip(jobId, tempDir, videoIndex, dimension);
    }

    return item;
  }

  /**
   * get autoFlip data, resize video & upload to GCP
   * @param jobId
   * @param tempDir
   * @param index
   * @param dimension
   * @return {String} video URL
   */
  async resizeVideoWithAutoFlip(jobId: string, tempDir: string, index: number, dimension: string): Promise<string> {

    const filename = uuid.v4();

    const profile = MEDIAPIPE_DIMENSIONS[dimension];

    this.logger.debug(`Running Mediapipe for index: ${index}, dimension '${dimension}'`);
    await this.autoFlip(
        `${tempDir}/clip-${index}.mp4`,
        `${tempDir}/${profile.dimension}-${index}.mp4`,
        profile.ratio
    );
    this.logger.debug(`Completed Mediapipe for index: ${index}, dimension '${dimension}'`);

    await resizeVideo(
        `${tempDir}/${profile.dimension}-${index}.mp4`,
        profile.width,
        profile.height,
        `${tempDir}/${dimension}-${index}.mp4`
    );
    this.logger.debug(`Completed resize video for index: ${index}, dimension '${dimension}'`);

    await this.gcpService.upload(`${tempDir}/${dimension}-${index}.mp4`, `${jobId}/${filename}.mp4`);
    this.logger.debug(`Completed upload video for index: ${index}, dimension '${dimension}'`);

    return `${jobId}/${filename}.mp4`;
  }

  // TODO: set return type instead of <any>
  async getOperationResult(operationSubUrl: string, job: any, progressForEachVideo: number): Promise<any> {

    //repeat until we get data
    while (true) {

      try {

        const operationUrl = ` https://videointelligence.googleapis.com/v1/${operationSubUrl}`
        const {data} = await this.authClient.request({method: 'get', url: operationUrl});

        // this.logger.debug('----got result!!', data);

        if (data.done && !data.error) {
          // this.logger.debug('----got response!!', data.response);

          // const currentProgress = await job.progress();
          // await job.progress(+currentProgress + progressForEachVideo);

          return data.response.annotationResults;
        }

        if (data.error) {
          this.logger.debug(data.error, 'Getting operation status, got data.error!!');
        }
      } catch (e) {

        this.logger.debug(e.errors, 'Getting operation status, got request error!!');

        if (e.code !== HttpStatus.TOO_MANY_REQUESTS) {
          throw(e);
        }

        //if got  RESOURCE_EXHAUSTED - sleep 30 seconds and repeat request
        this.logger.debug(new Date(), 'Getting operation status, got TOO_MANY_REQUESTS, waiting..');
        await sleep(20, 40, this.logger);
      }

      // if not finished - wait 10 seconds and try again
      this.logger.debug(operationSubUrl, '----still not ready, waiting..');
      await sleep(20, 40, this.logger);
    }

  }

  async addVAITask(item: Subtitle): Promise<string> {

    const requestData: protos.google.cloud.videointelligence.v1.IAnnotateVideoRequest = {
      inputUri: `gs://${process.env.GCS_BUCKET}/${item.rawContent}`,
      features: [protos.google.cloud.videointelligence.v1.Feature.OBJECT_TRACKING],
      // recommended to use us-east1 for the best latency due to different types of processors used in this region and others
      locationId: VIDEO_AI_LOCATION
    };

    //repeat until we get data
    while (true) {

      try {
        const res = await this.authClient.request({
          method: 'post',
          url: this.videointelligenceUrl,
          data: requestData
        });

        // TODO - calc job progress
        //  await job.progress(100);

        // this.logger.debug('----got data!!', res.data);
        return res.data.name;
      } catch (e) {

        // this.logger.debug('----got error!!', e.errors, e.code);
        if (e.code !== HttpStatus.TOO_MANY_REQUESTS) {
          throw(e);
        }

        //if got  RESOURCE_EXHAUSTED - sleep 10..30 seconds and repeat request
        this.logger.debug('addVAITask: got TOO_MANY_REQUESTS, waiting..');
        await sleep(10, 30, this.logger);
      }
    }
  }

}
