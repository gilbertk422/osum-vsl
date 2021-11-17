import {Injectable} from '@nestjs/common';
import * as uuid from 'uuid';
import {GcpService} from '../gcp/gcp.service';
import {RedisService} from 'nestjs-redis';
import {JobData} from '../../shared.interface';
const tmp = require('tmp');
const fs = require('fs');

export interface JobStatus {
  step: 'videorender' | 'gentle' | 'openai' | 'musicai' | 'mediapipe' | 'googletts' | 'ssmlenhancer' | 'completed';
  status: 'in_progress' | 'completed' | 'failed' | 'deleted';
  percentage: number;
  files: object[];
}

@Injectable()
export class StoreService {
  public redisClient;
  private readonly JOBDATAKEY = 'jobData';

  constructor(private readonly gcpService: GcpService, private readonly redisService: RedisService) {
    this.redisClient = this.redisService.getClient();
  }

  /**
   * @param jobId
   * @param step
   * @param status
   * @return Promise<object|null>
   */
  public async getJobStatus(jobId: string): Promise<JobStatus> {
    const res = await this.redisClient.get(`status_${jobId}`);

    if (!res) {
      throw new Error('Missed status for job ' + jobId!);
    }
    return JSON.parse(res);
  }

  /**
   * @param jobId
   * @param status
   * @return Promise
   */
  public setJobStatus(jobId: string, status: JobStatus): Promise<any> {
    return this.redisClient.set(`status_${jobId}`, JSON.stringify(status));
  }

  /**
   * Store Job data to Redis and to GCS
   * @param jobId
   * @param data
   */
  public async storeJobData(jobId: string, data: JobData): Promise<string> {
    const jsonFileUrl = `${jobId}/${uuid.v4()}.json`;

    const tmpobj = tmp.fileSync();
    fs.writeFileSync(tmpobj.name, JSON.stringify(data));

    //upload result JSON to GCS
    await this.gcpService.upload(tmpobj.name, jsonFileUrl);

    console.debug(`-------stored jobdata at ${jobId}:`, data);
    tmpobj.removeCallback();

    return jsonFileUrl;
  }
}
