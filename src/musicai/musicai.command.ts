import {Command} from 'nestjs-command';
import {Logger} from '@nestjs/common';
import {Injectable} from '@nestjs/common';
import {Queue} from 'bull';
import {InjectQueue} from '@nestjs/bull';
import * as uuid from 'uuid';

@Injectable()
export class MusicaiCommand {
  private readonly logger = new Logger(MusicaiCommand.name);

  constructor(@InjectQueue('musicai') private readonly musicaiQueue: Queue) {}

  @Command({command: 'test:musicai', describe: 'test musicai job', autoExit: true})
  async test() {
    await this.musicaiQueue.add('generateMusic', {
      jobID: `${uuid.v4()}`,
      jsonUrl: '634fbf59-2c32-480b-ba95-57b92568d33b/5a9f44e0-e29e-4277-b60a-b56fca343a9e.json'
    });
  }
}
