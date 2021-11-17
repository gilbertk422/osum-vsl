import {Injectable} from '@nestjs/common';
import {TypeOrmCrudService} from '@nestjsx/crud-typeorm';
import {InjectRepository} from '@nestjs/typeorm';
import {Job} from './job.entity';
import {JobStatus} from 'src/shared/services/store/store.service';
import {JOB_STATUS, _JOB_STATUS} from './job.constant';
import {GcpService} from 'src/shared/services/gcp/gcp.service';
const tmp = require('tmp');
const fs = require('fs');

@Injectable()
export class JobService extends TypeOrmCrudService<Job> {
  constructor(@InjectRepository(Job) repo, private readonly gcpService: GcpService) {
    super(repo);
  }

  async saveJob(data: Job) {
    return this.repo.save(data);
  }

  async getJobById(id: number): Promise<Job> {
    return this.repo.findOne(id);
  }

  async getJobByJobId(jobId: string): Promise<Job> {
    return this.repo.findOne({
      where: {
        jobId
      }
    });
  }

  async getJobsOfCompany(companyId: number) {
    return this.repo.find({
      where: {
        companyId
      }
    });
  }

  public async setJobStatus(jobId: string, status: JobStatus): Promise<any> {
    let job = await this.getJobByJobId(jobId);
    job.step = status.step;
    job.status = _JOB_STATUS[status.status];
    job.files = JSON.stringify(status.files);
    job.progress = status.percentage;
    return this.saveJob(job);
  }

  /**
   * @param jobId
   * @param step
   * @param status
   * @return Promise<object|null>
   */
  public async getJobStatus(jobId: string): Promise<JobStatus> {
    const job = await this.getJobByJobId(jobId);

    let status: JobStatus = {
      step: job.step,
      status: JOB_STATUS[job.status],
      files: JSON.parse(job.files),
      percentage: job.progress
    };

    if (!status) {
      throw new Error('Missed status for job ' + jobId!);
    }
    return status;
  }
}
