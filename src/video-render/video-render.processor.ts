import {Process, Processor, InjectQueue, OnQueueFailed} from '@nestjs/bull';
import {Logger, NotFoundException, Injectable} from '@nestjs/common';
import {Job, Queue} from 'bull';
import {basename} from 'path';

import {GcpService} from '../shared/services/gcp/gcp.service';
import {VideoRenderService} from './video-render.service';
import {createTempDir, removeTempDir} from '../shared/helpers/xfs.helper';
import {VIDEORENDERPROCESSOR} from '../shared/processors.constant';
import {
  LANDSCAPE_VIDEO_RENDER_PROFILE,
  PORTRAIT_VIDEO_RENDER_PROFILE,
  SQUARE_VIDEO_RENDER_PROFILE
} from './video-render-profile.constant';
import {isValid, uniqueArray} from './video-render.helper';
import {VideoRenderProfile} from './video-render-profile.interface';
import {JOB_CANCEL_MESSAGE} from '../shared/shared.constant';
import {StoreService} from '../shared/services/store/store.service';
import {Subtitle, Image, JobData, Audio, Disclaimer, Citation} from '../shared/shared.interface';
import * as fs from 'fs';
import {JobService} from 'src/api/job/job.service';

@Processor(VIDEORENDERPROCESSOR)
export class VideoRenderProcessor {
  private readonly logger = new Logger(VideoRenderProcessor.name);

  constructor(
    private readonly jobService: JobService,
    private readonly gcpService: GcpService,
    private readonly videoRenderService: VideoRenderService,
    @InjectQueue(VIDEORENDERPROCESSOR) private readonly videoRenderQueue: Queue
  ) {}

  @OnQueueFailed()
  async handleJobError(job: Job, err: Error) {
    if (err.message == JOB_CANCEL_MESSAGE) {
      // set it status as 'deleted' on redis
      await this.jobService.setJobStatus(job.id.toString(), {
        step: 'videorender',
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

  /**
   * download all assets for the given profiles
   * @param data Json data
   * @param profiles profile array to be rendered
   * @param tempDir
   */
  async downloadAssets(data: JobData, profiles: Array<VideoRenderProfile>, tempDir: string) {
    const assets = uniqueArray(
      [
        ...data.rows.reduce((c, row) => [...c, ...profiles.map(profile => `${row.content[profile.name]}`)], []),
        ...data.images.map(image => `${image.rawContent}`),
        data.backgroundAudioFileUrl,
        data.ttsWavFileUrl
      ].filter(asset => isValid(asset))
    );
    this.logger.debug(assets, 'assets');
    this.logger.debug('downloading assets is started');

    const promises = assets.map(asset => this.gcpService.download(asset, `${tempDir}/${basename(asset)}`));
    this.logger.debug(`downloading assets..`);
    await Promise.all(promises);

    this.logger.debug('downloading assets is completed');
  }

  /**
   * cut clips for the profile and upate rows
   * @param rows
   * @param profile
   * @param tempDir
   */
  async cutClips(rows: Array<Subtitle>, profile: VideoRenderProfile, tempDir: string): Promise<Array<Subtitle>> {
    this.logger.debug('cutting clips is started');
    for (const row of rows) {
      row.content[profile.name] = await this.videoRenderService.cutClip(
        `${tempDir}/${basename(row.content[profile.name])}`,
        0,
        row.endTime - row.startTime,
        profile.videoSize.width,
        profile.videoSize.height,
        tempDir
      );
    }
    this.logger.debug('cutting clips is completed');
    return rows;
  }

  /**
   * merge clips for the profile
   * @param rows
   * @param profile
   * @param tempDir
   * @return clipPath - path of resulted clip
   */
  async mergeClips(rows: Array<Subtitle>, profile: VideoRenderProfile, tempDir: string): Promise<string> {
    this.logger.debug('merging clips is started');
    const clipPath = await this.videoRenderService.mergeClips(
      rows.map(row => row.content[profile.name]),
      tempDir
    );
    this.logger.debug('merging clips is completed');
    return clipPath;
  }

  /**
   * add images to the video
   * @param videoPath
   * @param images
   * @param profile
   * @param tempDir
   */
  async overlayImages(videoPath: string, images: Array<Image>, profile: VideoRenderProfile, tempDir: string) {
    this.logger.debug('adding images is started');
    for (const product of images.filter(image => image.type === 'product')) {
      this.logger.debug(`${tempDir}/${basename(product.rawContent)}`, '${tempDir}/${basename(product.rawContent)}');

      videoPath = await this.videoRenderService.overlayProduct(
        videoPath,
        `${tempDir}/${basename(product.rawContent)}`,
        product.startTime,
        product.endTime,
        profile.videoSize.width,
        profile.videoSize.height,
        profile.productImageSize.width,
        profile.productImageSize.height,
        profile.productImageMargin.top,
        tempDir
      );
    }
    for (const guarantee of images.filter(image => image.type === 'guarantee')) {
      videoPath = await this.videoRenderService.overlayGuarantee(
        videoPath,
        `${tempDir}/${basename(guarantee.rawContent)}`,
        guarantee.startTime,
        guarantee.endTime,
        profile.videoSize.width,
        profile.videoSize.height,
        profile.guaranteeImageSize.width,
        profile.guaranteeImageSize.height,
        profile.guaranteeImageMargin.top,
        tempDir
      );
    }
    this.logger.debug('adding images is completed');
    return videoPath;
  }

  /**
   * add disclaimers, citataions, subtitles to the video
   * @param videoPath
   * @param disclaimers
   * @param citations
   * @param subtitles
   * @param profile
   * @param tempDir
   */
  async addTexts(
    videoPath: string,
    disclaimers: Array<Disclaimer>,
    citations: Array<Citation>,
    subtitles: Array<Subtitle>,
    profile: VideoRenderProfile,
    tempDir: string
  ) {
    this.logger.debug('adding texts is started');
    if (isValid(disclaimers)) {
      disclaimers = await this.videoRenderService.preprocessDisclaimers(
        disclaimers,
        profile.disclaimerFont.filepath,
        profile.disclaimerFont.size,
        profile.disclaimerSize.width
      );
      videoPath = await this.videoRenderService.addDisclaimers(
        videoPath,
        disclaimers,
        profile.disclaimerFont.filepath,
        profile.disclaimerFont.size,
        profile.disclaimerMargin.top,
        profile.disclaimerMargin.right,
        tempDir
      );
    }

    if (isValid(citations)) {
      console.log(citations);
      citations = await this.videoRenderService.preprocessCitations(
        citations,
        profile.citationFont.filepath,
        profile.citationFont.size,
        profile.citationSize.width
      );
      videoPath = await this.videoRenderService.addCitations(
        videoPath,
        citations,
        profile.citationFont.filepath,
        profile.citationFont.size,
        profile.videoSize.height,
        profile.citationMargin.bottom,
        profile.citationMargin.left,
        tempDir
      );
    }
    if (isValid(subtitles)) {
      subtitles = await this.videoRenderService.preprocessSubtitles(subtitles, citations, profile.citationFont.size);
      videoPath = await this.videoRenderService.addSubtitles(
        videoPath,
        subtitles,
        profile.subtitleFont.filepath,
        profile.subtitleFont.size,
        profile.videoSize.height,
        profile.subtitleMargin.bottom,
        tempDir
      );
    }
    this.logger.debug('adding texts is completed');
    return videoPath;
  }

  /**
   *
   * @param videoPath
   * @param jobData
   * @param profile
   * @param tempDir
   */
  async addAudios(videoPath: string, jobData: JobData, profile, tempDir): Promise<string> {
    this.logger.debug('adding audio is started');

    // add speech
    videoPath = await this.videoRenderService.addMusic(
      videoPath,
      `${tempDir}/${basename(jobData.ttsWavFileUrl)}`,
      profile.speechVolume,
      tempDir
    );

    // add background music
    videoPath = await this.videoRenderService.addMusic(
      videoPath,
      `${tempDir}/${basename(jobData.backgroundAudioFileUrl)}`,
      profile.speechVolume * 0.8,
      tempDir
    );

    this.logger.debug(videoPath, 'adding audios is completed');
    return videoPath;
  }

  /**
   * upload final video to gcs
   * @param jobId
   * @param videoPath
   */
  async uploadVideo(jobId: string, videoPath: string) {
    this.logger.debug('uploading to gcloud is started');
    await this.gcpService.upload(videoPath, `${jobId}/${basename(videoPath)}`);
    await this.gcpService.makePublic(`${jobId}/${basename(videoPath)}`);
    this.logger.debug('uploading to gcloud is completed');
    return `https://storage.googleapis.com/vsl/${jobId}/${basename(videoPath)}`;
  }

  /**
   * videorender
   * @param jobId
   * @param jsonUrl
   * @param setProgress
   */
  async render(jobId, jsonUrl, setProgress) {
    if (!jobId) throw new Error('UNDEFINED JOBID');
    if (!jsonUrl) throw new Error('UNDEFINED JSON FILE');

    const tempDir = createTempDir();
    const profiles = [LANDSCAPE_VIDEO_RENDER_PROFILE, PORTRAIT_VIDEO_RENDER_PROFILE, SQUARE_VIDEO_RENDER_PROFILE]; // TODO hardcode for profiles setting
    const output = {};
    let progress = 0;

    try {
      await this.gcpService.download(jsonUrl, `${tempDir}/input_renderer.json`);
      const jobData: JobData = JSON.parse(fs.readFileSync(`${tempDir}/input_renderer.json`).toLocaleString());

      progress = await setProgress(progress + 1);
      await this.downloadAssets(jobData, profiles, tempDir);

      progress = await setProgress(progress + 9);
      const step = 90 / 6 / profiles.length; // amount of progress per each process for all profiles

      for (const profile of profiles) {
        await this.cutClips(jobData.rows, profile, tempDir); // 1
        progress = await setProgress(progress + step);
        let result = await this.mergeClips(jobData.rows, profile, tempDir); // 2
        progress = await setProgress(progress + step);
        result = await this.overlayImages(result, jobData.images, profile, tempDir); // 3
        progress = await setProgress(progress + step);
        result = await this.addTexts(result, jobData.disclaimers, jobData.citations, jobData.rows, profile, tempDir); // 4
        progress = await setProgress(progress + step);

        result = await this.addAudios(result, jobData, profile, tempDir); // 5

        progress = await setProgress(progress + step);
        output[profile.name] = await this.uploadVideo(jobId, result); // 6
        progress = await setProgress(progress + step);
      }
    } catch (e) {
      this.logger.error(e);
      // removeTempDir(tempDir);
      throw e;
    }

    removeTempDir(tempDir);
    return output;
  }

  @Process({
    name: 'render',
    concurrency: +process.env.VIDEORENDER_PROCESS
  })
  async handleRender(job: Job) {
    this.logger.debug(`rendering is started: ${job.id}`);
    const result = await this.render(job.id, job.data.jsonUrl, async progress => {
      await job.progress(progress);
      if ((await this.videoRenderQueue.getJob(job.id)).data.cancelled) {
        throw new Error(JOB_CANCEL_MESSAGE);
      }
      return progress;
    });
    this.logger.debug(`rendering is completed: ${job.id}`);
    // update job result in mysql
    let dbJob = await this.jobService.getJobByJobId(job.id.toLocaleString());
    dbJob.result = JSON.stringify(result);
    await this.jobService.saveJob(dbJob);

    return result;
  }
}
