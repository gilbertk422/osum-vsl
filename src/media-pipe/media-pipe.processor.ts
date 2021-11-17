import {InjectQueue, OnQueueCompleted, OnQueueFailed, Process, Processor} from '@nestjs/bull';
import {HttpStatus, Logger} from '@nestjs/common';
import {Job, Queue} from 'bull';
import {GcpService} from '../shared/services/gcp/gcp.service';
import {MEDIAPIPEPROCESSOR} from '../shared/processors.constant';
import {createTempDir, removeTempDir} from '../shared/helpers/xfs.helper';
import {MediaPipeService} from './media-pipe.service';
import {GoogleVideoAIService} from './google-video-ai.service';
import {getVideoAudioDuration, resizeVideo} from '../shared/helpers/video.helper';
import * as fs from 'fs';
import * as uuid from 'uuid';
import {ThumborService} from './thumbor.service';
import {getExt, sleep} from '../shared/helpers/util.helper';
import {MEDIAPIPE_DIMENSIONS} from './media-pipe.constant';
import {JOB_CANCEL_MESSAGE} from '../shared/shared.constant';
import {StoreService} from '../shared/services/store/store.service';
import {JobData, Subtitle, MediaContent} from '../shared/shared.interface';
import {GoogleAuth} from 'google-auth-library';
import {VIDEO_AI_LOCATION} from './google-video-ai.constant';
import {VideoObject} from './google-video-ai.interface';
import {JobService} from 'src/api/job/job.service';

@Processor(MEDIAPIPEPROCESSOR)
export class MediaPipeProcessor {
  private readonly logger = new Logger(MediaPipeProcessor.name);

  constructor(
    private readonly jobService: JobService,
    private readonly gcpService: GcpService,
    private readonly mediaPipeService: MediaPipeService,
    private readonly googleVideoAIService: GoogleVideoAIService,
    private readonly thumborService: ThumborService,
    @InjectQueue(MEDIAPIPEPROCESSOR) private readonly mediapipeQueue: Queue
  ) {}

  @OnQueueFailed()
  async handleJobError(job: Job, err: Error) {
    if (err.message == JOB_CANCEL_MESSAGE) {
      // set it status as 'deleted' on redis
      await this.jobService.setJobStatus(job.id.toString(), {
        step: 'mediapipe',
        status: 'deleted',
        files: [],
        percentage: 0
      });
      // remove the job from the queue when it is failed by cancelling
      await job.remove();
      return;
    }
    this.logger.error(err.message || err, err.stack);
  }

  @OnQueueCompleted()
  async handleJobCompleted(job: Job, result: any) {
    this.logger.debug('media-pipe completed');
    this.logger.debug(result);
  }

  /**
   * do thumbor for image
   * @param item
   * @param tempDir
   * @param jobId
   */
  async processImage(item: Subtitle, tempDir: string, jobId: any): Promise<any> {
    // get file extension
    this.logger.debug('..processImage');
    const ext = getExt(item.rawContent);

    const dimensions = ['landscape', 'portrait', 'square'];
    item.content = {landscape: '', portrait: '', square: ''};

    try {
      for (let i = 0; i < dimensions.length; i++) {
        const profile = MEDIAPIPE_DIMENSIONS[dimensions[i]];

        this.logger.debug(`..calling thumborService.smartCrop for '${item.rawContent}' (${profile.dimension}`);

        await this.thumborService.smartCrop(
          item.rawContent,
          profile.dimension,
          `${tempDir}/thumbor_${profile.dimension}.${ext}`
        );
        const filename = uuid.v4();
        await this.gcpService.upload(`${tempDir}/thumbor_${profile.dimension}.${ext}`, `${jobId}/${filename}.${ext}`);
        item.content[dimensions[i]] = `${jobId}/${filename}.${ext}`;
      }
    } catch (e) {
      this.logger.error('processImage has failed!');
      throw new Error('Mediapipe has failed - error in processImage..');
    }

    return item;
  }

  async checkIfJobCancelled(jobId) {
    if ((await this.mediapipeQueue.getJob(jobId)).data.cancelled) {
      throw new Error(JOB_CANCEL_MESSAGE);
    }
  }

  @Process({
    name: 'mediaPipeProcess',
    concurrency: +process.env.MEDIAPIPE_PROCESS
  })
  async handleMediaPipeProcess(job: Job<any>): Promise<any> {
    this.logger.debug(` Starting media-pipe... job: ${job.id}`);

    const auth = new GoogleAuth({scopes: 'https://www.googleapis.com/auth/cloud-platform'});
    this.mediaPipeService.authClient = await auth.getClient();

    const videoRows = [];
    const imageRows = [];

    const tempDir: string = createTempDir();

    await this.checkIfJobCancelled(job.id);

    // download job data from gcs
    await this.gcpService.download(job.data.jsonUrl, `${tempDir}/input_media_pipe.json`);
    const jobData = JSON.parse(fs.readFileSync(`${tempDir}/input_media_pipe.json`).toLocaleString());

    await job.progress(5);
    //
    this.logger.debug('========JobData');
    // throw new Error(JOB_CANCEL_MESSAGE);

    // split distict video rows and image rows
    jobData.rows.forEach((item: Subtitle) => {
      if (item.endTime - item.startTime <= 0) {
        this.logger.error('Invalid scene duration for item!' + JSON.stringify(item));
        throw new Error('Invalid scene duration');
      }

      if (item.type == 'video') {
        videoRows.push(item);
      } else {
        imageRows.push(item);
      }
    });

    this.logger.debug('========forEach');

    const outputImageRows: Array<Subtitle> = [];
    for (let index = 0; index < imageRows.length; index++) {
      await this.checkIfJobCancelled(job.id);
      outputImageRows.push(await this.processImage(imageRows[index], tempDir, job.id));
    }

    this.logger.debug('========ready20');

    await job.progress(20);

    const outputVideoRows: Array<Subtitle> = await this.processVideos(videoRows, tempDir, job);

    //sort output items by startTime
    jobData.rows = [...outputImageRows, ...outputVideoRows].sort((a, b) => a.startTime - b.startTime);

    await job.progress(100);

    // // remove the temp folder
    // removeTempDir(tempDir);

    return jobData;
  }

  /**
   *
   * @param videos
   * @param tempDir
   * @param jobId
   */
  async processVideos(videos: Array<Subtitle>, tempDir: string, job): Promise<Array<Subtitle>> {
    // Detects objects in a video
    let promises = [];

    const jobId = job.id;

    await this.checkIfJobCancelled(job.id);

    promises = videos.map(item => {
      return this.mediaPipeService.addVAITask(item);
    });

    this.logger.debug('Starting VAI operations..');
    const operationUrls = await Promise.all(promises);
    this.logger.debug('Got operations:');
    this.logger.debug(operationUrls);

    await job.progress(25);

    let progressForEachVideo = Math.round((50 - 25) / videos.length);

    this.logger.debug('loading operation results..');

    await this.checkIfJobCancelled(job.id);
    promises = operationUrls.map(operationUrl => {
      return this.mediaPipeService.getOperationResult(operationUrl, job, progressForEachVideo);
    });
    const operationResults = await Promise.all(promises);
    this.logger.debug(`Got operationResults.. check ${tempDir}/operationResults.json`);

    await job.progress(50);

    //calc most activity time based on recognized data
    const videoObjects = operationResults.map((item, idx) => {
      /**
             * item:     [{
                inputUri: '/vsl/a3239c2b-550c-4569-a311-7af71c449c7d/23606224.mp4',
                segment: [Object],
                objectAnnotations: [Array]
              }]
             */

      //if there are no objectAnnotations - thread whole video as single object
      if (!item[0].objectAnnotations) {
        const st = item[0].segment.startTimeOffset;
        const et = item[0].segment.endTimeOffset;

        return [
          {
            description: 'objects not found',
            entityId: uuid.v4(),
            startTime: +st.substring(0, st.length - 1), //skip 's' at the end and convert to number
            endTime: +et.substring(0, et.length - 1)
          }
        ];

        this.logger.error(
          ` ====No objectAnnotations!! idx: ${idx}, video: ${JSON.stringify(videos[idx])}`,
          JSON.stringify(item)
        );
        // throw  new Error('No objectAnnotations for video!!')
      } else {
        return item[0].objectAnnotations.map(object => {
          const time = object.segment;
          return {
            description: object.entity.description,
            entityId: object.entity.entityId,
            startTime: +time.startTimeOffset.seconds || 0,
            endTime: +time.endTimeOffset.seconds || 0
          };
        });
      }
    });

    await job.progress(60);

    //download videos to local fs
    await this.checkIfJobCancelled(job.id);
    this.logger.debug('Downloading the videos..');
    promises = videos.map((item, index) => {
      return this.gcpService.download(item.rawContent, `${tempDir}/input_video-${index}.mp4`);
    });

    await Promise.all(promises);
    this.logger.debug('Downloaded');
    await job.progress(65);

    await this.checkIfJobCancelled(job.id);
    promises = videos.map((item, index) => {
      return getVideoAudioDuration(`${tempDir}/input_video-${index}.mp4`);
    });

    //calculate footage durations
    const footageDurations = await Promise.all(promises);

    await job.progress(70);

    //calculate scene durations
    const sceneDurations = videos.map(item => {
      return (item.endTime - item.startTime) / 1000.0;
    });

    await job.progress(75);

    progressForEachVideo = Math.round((100 - 75) / videos.length);

    const output: Array<Subtitle> = [];

    // each autoflip process starts few autoflip & ffmpeg treads.
    // we need to run cutVideo one by one to avoid large number of running  autoflip & ffmpeg treads,
    this.logger.debug(`Going to cut ${videos.length} videos`);

    for (let index = 0; index < videos.length; index++) {
      await this.checkIfJobCancelled(job.id);
      const item = videos[index];

      const res = await this.mediaPipeService.cutVideo(
        item,
        index,
        tempDir,
        videoObjects,
        sceneDurations,
        footageDurations,
        jobId
      );
      output.push(res);

      const currentProgress = await job.progress();
      await job.progress(+currentProgress + progressForEachVideo);
    }

    return output;
  }

  async handleMediaPipeProcess1(job: Job<any>): Promise<any> {
    // this.logger.debug('Start media-pipe...');
    //
    // // create a temp folder
    // const tempDir: string = createTempDir();
    //
    // let jobData: JobData;
    //
    // try {
    //   // download job data from gcs
    //   await this.gcpService.download(job.data.jsonUrl, `${tempDir}/input_media_pipe.json`);
    //   jobData = JSON.parse(fs.readFileSync(`${tempDir}/input_media_pipe.json`).toLocaleString());
    //
    //   await job.progress(5);
    //
    //   for (let i = 0; i < jobData.rows.length; i++) {
    //
    //     if ((await this.mediapipeQueue.getJob(job.id)).data.cancelled) {
    //       throw new Error(JOB_CANCEL_MESSAGE);
    //     }
    //
    //     const item:Subtitle = jobData.rows[i];
    //
    //     if ( (item.endTime - item.startTime) <= 0 ) {
    //       this.logger.error('Invalid scene duration for item!' + JSON.stringify(item) );
    //
    //       throw new Error("Invalid scene duration");
    //     }
    //
    //     if (item.type == 'video') {
    //       await this.processVideo(item, tempDir, i, job.id);
    //
    //       // TODO: is item used somewhere?
    //       // item = await this.processVideo(item, tempDir, i, job.id);
    //     } else if (item.type == 'image') {
    //       await this.processImage(item, tempDir, job.id);
    //       // item = await this.processImage(item, tempDir, job.id);
    //     }
    //
    //     await job.progress(Math.round(5 + ((i + 1) / jobData.rows.length) * 95));
    //   }
    //
    //   await job.progress(100);
    // } catch (err) {
    //   // remove the temp folder
    //   // removeTempDir(tempDir);
    //   throw err;
    // }
    //
    // // remove the temp folder
    // removeTempDir(tempDir);
    // return jobData;
  }
}
