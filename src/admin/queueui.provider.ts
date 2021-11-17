import {setQueues} from 'bull-board';
import {Injectable} from '@nestjs/common';
import {InjectQueue} from '@nestjs/bull';
import {Queue} from 'bull';
import {
  GENTLEPROCESSOR,
  VIDEORENDERPROCESSOR,
  GOOGLETTSPROCESSOR,
  PIPERPROCESSOR,
  OPENAIPROCESSOR,
  MUSICAIPROCESSOR,
  MEDIAPIPEPROCESSOR
} from '../shared/processors.constant';

@Injectable()
export class QueueUIProvider {
  constructor(
    @InjectQueue(PIPERPROCESSOR) private readonly pipeQueue: Queue,
    @InjectQueue(OPENAIPROCESSOR) private readonly openAiQueue: Queue,
    @InjectQueue(MEDIAPIPEPROCESSOR) private readonly mediaAPIQueue: Queue,
    @InjectQueue(VIDEORENDERPROCESSOR) private readonly videoRenderQueue: Queue,
    @InjectQueue(GENTLEPROCESSOR) private readonly gentleQueue: Queue,
    @InjectQueue(GOOGLETTSPROCESSOR) private readonly googleTtsQueue: Queue,
    @InjectQueue(OPENAIPROCESSOR) private readonly openaiQueue: Queue,
    @InjectQueue(MUSICAIPROCESSOR) private readonly musicaiQueue: Queue
  ) {
    setQueues([pipeQueue, googleTtsQueue, gentleQueue, openAiQueue, musicaiQueue, mediaAPIQueue, videoRenderQueue]);
  }
}
