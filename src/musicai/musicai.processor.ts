import {Process, Processor, OnQueueFailed, InjectQueue, OnQueueCompleted} from '@nestjs/bull';
import {Logger} from '@nestjs/common';
import {Job, Queue} from 'bull';
import * as fs from 'fs';
import * as uuid from 'uuid';
import {GcpService} from '../shared/services/gcp/gcp.service';
import {MUSICAIPROCESSOR} from '../shared/processors.constant';
import {JobData} from '../shared/shared.interface';
import {createTempDir, removeTempDir} from '../shared/helpers/xfs.helper';
import {MusicaiService} from './musicai.service';
import {JOB_CANCEL_MESSAGE} from '../shared/shared.constant';
import {StoreService} from '../shared/services/store/store.service';

@Processor(MUSICAIPROCESSOR)
export class MusicaiProcessor {
  private readonly logger = new Logger(MusicaiProcessor.name);
  constructor(
    private readonly storeService: StoreService,
    private readonly gcpService: GcpService,
    private readonly musicaiService: MusicaiService,
    @InjectQueue(MUSICAIPROCESSOR) private readonly musicaiQueue: Queue
  ) {}

  @OnQueueFailed()
  async handleJobError(job: Job, err: Error): Promise<any> {
    if (err.message == JOB_CANCEL_MESSAGE) {
      // set it status as 'deleted' on redis
      await this.storeService.setJobStatus(job.id.toString(), {
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
  async handleJobCompleted(job: Job, result: any): Promise<any> {
    this.logger.debug('generateMusic completed');
    this.logger.debug(result);
  }

  @Process({
    name: 'generateMusic',
    concurrency: +process.env.MUSICAI_PROCESS
  })
  async handleMusicaiVideosChooser(job: Job<any>): Promise<any> {
    this.logger.debug('Start generateMusic...');

    const tempDir: string = createTempDir();
    const audioUrl = `${job.id}/${uuid.v4()}.wav`;

    try {
      if ((await this.musicaiQueue.getJob(job.id)).data.cancelled) throw new Error(JOB_CANCEL_MESSAGE); // JOB CHECKER-CANCELLATOR
      job.progress(1);

      const tempFileName = `${tempDir}/musicai_temp_input_${uuid.v4()}.json`;
      await this.gcpService.download(job.data.jsonUrl, tempFileName); // download job data from gcs
      const jobData: JobData = JSON.parse(fs.readFileSync(tempFileName).toLocaleString());

      if ((await this.musicaiQueue.getJob(job.id)).data.cancelled) throw new Error(JOB_CANCEL_MESSAGE); // JOB CHECKER-CANCELLATOR
      job.progress(10);

      this.logger.debug('Getting Mubert PAT credential...');
      const mubertPat = await this.musicaiService.getMubertPat();

      if ((await this.musicaiQueue.getJob(job.id)).data.cancelled) throw new Error(JOB_CANCEL_MESSAGE); // JOB CHECKER-CANCELLATOR
      job.progress(20);

      this.logger.debug('Preparing moods and intensities by OpenAI...');
      const calculatedOptions = await this.musicaiService.prepareMoodsAndIntensities(jobData);

      if ((await this.musicaiQueue.getJob(job.id)).data.cancelled) throw new Error(JOB_CANCEL_MESSAGE); // JOB CHECKER-CANCELLATOR
      job.progress(30);

      this.logger.debug('Calculating Mubert options...');
      const preparedOptions = await this.musicaiService.calculateMubertOptions(calculatedOptions);
      this.logger.debug(`[calculateMubertOptions] ${JSON.stringify(preparedOptions, null, 2)}`);

      if ((await this.musicaiQueue.getJob(job.id)).data.cancelled) throw new Error(JOB_CANCEL_MESSAGE); // JOB CHECKER-CANCELLATOR
      job.progress(40);

      this.logger.debug('Grouping options by intensity...');
      const intensityGroups = this.musicaiService.groupByIntensity(preparedOptions);

      if ((await this.musicaiQueue.getJob(job.id)).data.cancelled) throw new Error(JOB_CANCEL_MESSAGE); // JOB CHECKER-CANCELLATOR
      job.progress(50);

      this.logger.debug('Preparing Mubert requests params...');
      const mubertOptionsArr = this.musicaiService.prepareMubertRequests(intensityGroups, mubertPat);
      this.logger.debug(`[prepareMubertRequests] ${JSON.stringify(mubertOptionsArr, null, 2)}`);

      if ((await this.musicaiQueue.getJob(job.id)).data.cancelled) throw new Error(JOB_CANCEL_MESSAGE); // JOB CHECKER-CANCELLATOR
      job.progress(60);

      this.logger.debug('Sending Mubert jobs...');
      const mubertJobs = await this.musicaiService.sendMubertJobs(mubertOptionsArr);

      if ((await this.musicaiQueue.getJob(job.id)).data.cancelled) throw new Error(JOB_CANCEL_MESSAGE); // JOB CHECKER-CANCELLATOR
      job.progress(70);

      this.logger.debug('Polling Mubert jobs results...');
      const mubertAudioUrls = await this.musicaiService.pollMubertJobsResults(
        mubertJobs,
        mubertPat,
        +process.env.MUBERT_POLL_INTERVAL
      );

      if ((await this.musicaiQueue.getJob(job.id)).data.cancelled) throw new Error(JOB_CANCEL_MESSAGE); // JOB CHECKER-CANCELLATOR
      job.progress(80);

      this.logger.debug('Downloading Mubert audios...');
      const audioFilesPaths = await this.musicaiService.downloadMubertAudios(mubertAudioUrls, tempDir);

      if ((await this.musicaiQueue.getJob(job.id)).data.cancelled) throw new Error(JOB_CANCEL_MESSAGE); // JOB CHECKER-CANCELLATOR
      job.progress(90);

      this.logger.debug('Merging audios...');
      const mergedAudioPath = await this.musicaiService.mergeAudios(audioFilesPaths, uuid.v4(), tempDir);

      if ((await this.musicaiQueue.getJob(job.id)).data.cancelled) throw new Error(JOB_CANCEL_MESSAGE); // JOB CHECKER-CANCELLATOR
      job.progress(99);

      this.logger.debug('Uploading merged audio...');
      await this.gcpService.upload(mergedAudioPath, audioUrl);
    } catch (e) {
      removeTempDir(tempDir);
      throw e;
    }
    removeTempDir(tempDir);
    job.progress(100);

    if ((await this.musicaiQueue.getJob(job.id)).data.cancelled) {
      throw new Error(JOB_CANCEL_MESSAGE);
    }

    return {
      audioUrl
    };
  }
}
