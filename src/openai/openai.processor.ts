import {Process, Processor, OnQueueFailed, InjectQueue, OnQueueCompleted} from '@nestjs/bull';
import {Logger} from '@nestjs/common';
import {Job, Queue} from 'bull';
import * as fs from 'fs';
import * as uuid from 'uuid';
import {GcpService} from '../shared/services/gcp/gcp.service';
import {OPENAIPROCESSOR} from '../shared/processors.constant';
import {JobData} from '../shared/shared.interface';
import {createTempDir, removeTempDir} from '../shared/helpers/xfs.helper';
import {OpenaiService} from './openai.service';
import {ShutterstockService} from '../shared/services/shutterstock/shutterstock.service';
import {ShutterSearchResult} from '../shared/services/shutterstock/shutterstock.interface';
import {OPENAI_FALLBACK_KEYWORD, OPENAI_FALLBACK_DURATION} from './openai.constant';
import {VIDEO_DATA_TYPE, IMAGE_DATA_TYPE, JOB_CANCEL_MESSAGE} from '../shared/shared.constant';
import {StoreService} from '../shared/services/store/store.service';
import {JobService} from 'src/api/job/job.service';

@Processor(OPENAIPROCESSOR)
export class OpenaiProcessor {
  private readonly logger = new Logger(OpenaiProcessor.name);
  constructor(
    private readonly jobService: JobService,
    private readonly gcpService: GcpService,
    private readonly openaiService: OpenaiService,
    private readonly shutterstockService: ShutterstockService,
    @InjectQueue(OPENAIPROCESSOR) private readonly openaiQueue: Queue
  ) {}

  @OnQueueFailed()
  async handleJobError(job: Job, err: Error): Promise<any> {
    if (err.message == JOB_CANCEL_MESSAGE) {
      // set it status as 'deleted' on redis
      await this.jobService.setJobStatus(job.id.toString(), {
        step: 'musicai',
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
    this.logger.debug('getVideosByContext completed');
    this.logger.debug(result);
  }

  @Process({
    name: 'getVideosByContext',
    concurrency: +process.env.OPENAI_PROCESS
  })
  async handleOpenaiVideosChooser(job: Job<any>): Promise<any> {
    this.logger.debug('Start getVideosByContext...');

    const tempDir: string = createTempDir();
    let jobData: JobData;
    const updatedRows: Array<any> = [];
    try {
      await this.gcpService.download(job.data.jsonUrl, `${tempDir}/openai_temp_input.json`); // download job data from gcs
      jobData = JSON.parse(fs.readFileSync(`${tempDir}/openai_temp_input.json`).toLocaleString());

      if (+jobData.useVidux === 1) {
        // OUR INNER VIDUX DB APPROACH
        this.logger.debug('VIDUX WAY');
        const _updatedRows = await this.openaiService.viduxWay(jobData, job, tempDir);
        updatedRows.push(..._updatedRows);
      } else {
        // SHUTTERSTOCK API APPROACH
        this.logger.debug('SHUTTER WAY');
        const _updatedRows = await this.openaiService.shutterstockWay(jobData, job, tempDir);
        updatedRows.push(..._updatedRows);
      }

      if ((await this.openaiQueue.getJob(job.id)).data.cancelled) {
        throw new Error(JOB_CANCEL_MESSAGE);
      }

      this.logger.debug('IMAGES/VIDEOS SELECTED!');
    } catch (e) {
      removeTempDir(tempDir);
      throw e;
    }
    removeTempDir(tempDir);
    job.progress(100);
    if ((await this.openaiQueue.getJob(job.id)).data.cancelled) {
      throw new Error(JOB_CANCEL_MESSAGE);
    }

    return {
      rows: updatedRows
    };
  }
}
