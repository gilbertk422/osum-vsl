import {HttpService, Injectable, Logger} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {GcpService} from '../shared/services/gcp/gcp.service';
import {JobData, SSMLEnhanced} from '../shared/shared.interface';
import * as stringify from 'csv-stringify';
import {StoreService} from '../shared/services/store/store.service';
import {AxiosResponse} from 'axios';
import {EnhancerResponse} from './service-pipe.interface';
import * as fs from 'fs';
import {JobService} from 'src/api/job/job.service';
import {JOB_STATUS} from 'src/api/job/job.constant';
const tmp = require('tmp');

@Injectable()
export class ServicePipeService {
  constructor(
    private readonly httpService: HttpService,
    private readonly gcpService: GcpService,
    private readonly configService: ConfigService,
    private readonly storeService: StoreService,
    private readonly jobService: JobService
  ) {}

  /**
   * @param text
   * @return Promise
   */
  public async callSSMLEnhancer(script: string): Promise<any> {
    const result: AxiosResponse<EnhancerResponse> = await this.httpService
      .post(
        this.configService.get('SSML_ENHANCER_URL'),
        {text: script},
        {
          headers: {
            Authorization: `Basic ${Buffer.from(this.configService.get('SSML_ENHANCER_BASIC_AUTH')).toString('base64')}`
          }
        }
      )
      .toPromise();

    console.log({result});
    if (!result.data.success) throw new Error(result.data.error);
    const tempUpdated = {...result.data.data};
    return tempUpdated;

    // Old tesing data
    // return new Promise((resolve, reject) => {
    //   const output = {
    //     plaintext: script,
    //     ssml: `<speak>${script}</speak>`,
    //     enhancedText: script,
    //     plainText: script,
    //     disclaimers: [
    //       {
    //         text: 'Click the link below now',
    //         disclaimer: 'results may vary'
    //       }
    //     ],
    //     citations: [
    //       {
    //         text: 'Click the link below now',
    //         citation: 'results may vary'
    //       }
    //     ],
    //     images: [
    //       {
    //         text: 'Click the link below now',
    //         type: 'product',
    //         imageUrl: '123.jpg'
    //       },
    //       {
    //         text: 'Click the link below now',
    //         type: 'guarantee',
    //         imageUrl: '567.jpg'
    //       }
    //     ]
    //   };
    //
    //   resolve(output);
    // });
  }

  /** Read JSON file at GCS and return parsed JSON data
   * @param jsonUrl
   */
  public async readJsonAtGCS(jsonUrl: string): Promise<any> {
    const tempFname = tmp.tmpNameSync();

    let jobData;

    try {
      await this.gcpService.download(jsonUrl, tempFname);
      jobData = JSON.parse(fs.readFileSync(tempFname).toLocaleString());
    } catch (error) {
      throw error;
    } finally {
      fs.unlinkSync(tempFname);
    }

    return jobData;
  }

  public async handleJobFailed(jobId: string, error: Error, logger: Logger) {
    // update job status in mysql
    let job = await this.jobService.getJobByJobId(jobId);
    job.status = JOB_STATUS.failed;
    await this.jobService.saveJob(job);

    // update job status in redis
    const jobStatus = await this.jobService.getJobStatus(jobId);
    jobStatus.status = 'failed';
    await this.jobService.setJobStatus(jobId, jobStatus);
    logger.debug(`jobId: ${jobId} failed: ${error.message}`);
  }

  public async handleJobProgress(jobId: string, progress: number, logger: Logger) {
    const jobStatus = await this.jobService.getJobStatus(jobId);
    jobStatus.percentage = progress;
    await this.jobService.setJobStatus(jobId, jobStatus);
    logger.debug(`jobId: ${jobId} progress: ${progress}`);
  }
}
