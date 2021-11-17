import {InjectQueue} from '@nestjs/bull';
import {Controller, Get, Query} from '@nestjs/common';
import {Queue} from 'bull';
import {VIDEORENDERPROCESSOR} from '../shared/processors.constant';

@Controller('video-render')
export class VideoRenderController {
  constructor(@InjectQueue(VIDEORENDERPROCESSOR) private readonly videoRenderQueue: Queue) {}

  @Get('render')
  async render(@Query() query) {
    if (query && query.input) {
      await this.videoRenderQueue.add('render', {input: query.input});
      return 'Your request has successfully queued!';
    } else {
      return 'You must specify input json file!';
    }
  }
}
