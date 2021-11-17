import {Command} from 'nestjs-command';
import {Logger} from '@nestjs/common';
import {Injectable} from '@nestjs/common';
import {Queue} from 'bull';
import {InjectQueue} from '@nestjs/bull';
import {VIDEORENDERPROCESSOR} from '../shared/processors.constant';
import {StoreService} from '../shared/services/store/store.service';
import {v4} from 'uuid';
import {JobService} from 'src/api/job/job.service';

@Injectable()
export class VideoRenderCommand {
  private readonly logger = new Logger(VideoRenderCommand.name);

  constructor(
    private readonly jobService: JobService,
    @InjectQueue(VIDEORENDERPROCESSOR) private readonly videoRenderQueue: Queue
  ) {}

  @Command({command: 'test:videorender', describe: 'test a video render job', autoExit: true})
  async test() {
    const jsonUrl = '84fdd7c8-d47d-4808-9eb7-b0f16f8435c2/d69eaffd-b1e9-4f69-97e8-fe51fe1548c6.json';
    const jobId = v4();

    //set current step
    await this.jobService.setJobStatus(jobId, {
      step: 'videorender',
      status: 'in_progress',
      files: [],
      percentage: 0
    });

    await this.videoRenderQueue.add('render', {jsonUrl}, {jobId});
  }
}
