import {Command} from 'nestjs-command';
import {Logger, ParseUUIDPipe} from '@nestjs/common';
import {Injectable} from '@nestjs/common';
import {Queue} from 'bull';
import {InjectQueue} from '@nestjs/bull';
import {GOOGLETTSPROCESSOR} from '../shared/processors.constant';
import * as uuid from 'uuid';
import {StoreService} from '../shared/services/store/store.service';
import {GoogleTtsService} from './google-tts.service';
import {JobService} from 'src/api/job/job.service';

@Injectable()
export class GoogleTtsCommand {
  private readonly logger = new Logger(GoogleTtsCommand.name);

  constructor(
    private readonly jobService: JobService,
    private readonly googleTtsService: GoogleTtsService,
    @InjectQueue(GOOGLETTSPROCESSOR) private readonly googleTtsQueue: Queue
  ) {}

  @Command({command: 'test:googletts', describe: 'test google-tts job', autoExit: true})
  async test() {
    let jobId = uuid.v4();

    await this.jobService.setJobStatus(jobId, {
      step: 'googletts',
      status: 'in_progress',
      files: [],
      percentage: 0
    });

    await this.googleTtsQueue.add(
      'googleTtsProcess',
      {
        jsonUrl: '013fde6e-f2ae-47e6-93f9-759af283590a/46d7dd6d-5bab-4bec-935e-5236861c8ee6.json',
        cancelled: 0
      },
      {
        jobId: uuid.v4()
      }
    );
  }
}
