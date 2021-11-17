import {Injectable} from '@nestjs/common';
import {Queue} from 'bull';
import {InjectQueue} from '@nestjs/bull';
import {
  MEDIAPIPEPROCESSOR,
  GENTLEPROCESSOR,
  GOOGLETTSPROCESSOR,
  OPENAIPROCESSOR,
  MUSICAIPROCESSOR,
  VIDEORENDERPROCESSOR,
  PIPERPROCESSOR
} from '../shared/processors.constant';

@Injectable()
export class AdminService {
  constructor(
    @InjectQueue(MEDIAPIPEPROCESSOR) private readonly mediapipeQueue: Queue,
    @InjectQueue(GENTLEPROCESSOR) private readonly gentleQueue: Queue,
    @InjectQueue(GOOGLETTSPROCESSOR) private readonly googleTTSQueue: Queue,
    @InjectQueue(OPENAIPROCESSOR) private readonly openAIQueue: Queue,
    @InjectQueue(MUSICAIPROCESSOR) private readonly musicAIQueue: Queue,
    @InjectQueue(VIDEORENDERPROCESSOR) private readonly videoRenderQueue: Queue,
    @InjectQueue(PIPERPROCESSOR) private readonly pipeQueue: Queue
  ) {}

  /**
   * Cancel Job in a specific queue
   * @param queue
   * @param jobId
   */
  async cancelJobInQueue(queue: Queue, jobId: string) {
    let job = await queue.getJob(jobId);
    if (!job) return;
    job.data.cancelled = 1;
    await job.update(job.data);
    if (!(await job.isActive())) {
      await job.remove();
    }
  }

  /**
   * Cancel Job for all the queues
   * @param jobId
   */
  async cancelJob(jobId: string) {
    await this.cancelJobInQueue(this.mediapipeQueue, jobId);
    await this.cancelJobInQueue(this.gentleQueue, jobId);
    await this.cancelJobInQueue(this.googleTTSQueue, jobId);
    await this.cancelJobInQueue(this.openAIQueue, jobId);
    await this.cancelJobInQueue(this.musicAIQueue, jobId);
    await this.cancelJobInQueue(this.videoRenderQueue, jobId);
    await this.cancelJobInQueue(this.pipeQueue, jobId);
  }
}
