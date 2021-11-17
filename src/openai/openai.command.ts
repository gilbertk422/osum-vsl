import {Command} from 'nestjs-command';
import {Logger} from '@nestjs/common';
import {Injectable} from '@nestjs/common';
import {Queue} from 'bull';
import {InjectQueue} from '@nestjs/bull';
import * as uuid from 'uuid';

@Injectable()
export class OpenaiCommand {
  private readonly logger = new Logger(OpenaiCommand.name);

  constructor(@InjectQueue('openai') private readonly openaiQueue: Queue) {}

  @Command({command: 'test:openai', describe: 'test openai job', autoExit: true})
  async test() {
    await this.openaiQueue.add('getVideosByContext', {
      jobID: `${uuid.v4()}`,
      jsonUrl: '29448502-9c9e-4ff0-9bbb-2bcff92571c2/4e43838a-2ea1-429f-ad1d-32faeb1317af.json', // shutterstock test
      // jsonUrl: 'test_openai_payload_timings_vidux.json', // vidux test
      // jsonUrl: 'openai-test-bad.json', // bad test
      videosPercent: 50
    });
  }
}
