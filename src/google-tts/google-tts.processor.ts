import {InjectQueue, OnQueueCompleted, OnQueueFailed, Process, Processor} from '@nestjs/bull';
import {Logger} from '@nestjs/common';
import {Job, Queue} from 'bull';
import {GcpService} from '../shared/services/gcp/gcp.service';
import * as fs from 'fs';
import {GOOGLETTSPROCESSOR} from '../shared/processors.constant';
import {createTempDir, removeTempDir} from '../shared/helpers/xfs.helper';
import {GoogleTtsService} from './google-tts.service';
import * as uuid from 'uuid';
import {JOB_CANCEL_MESSAGE} from '../shared/shared.constant';
import {StoreService} from '../shared/services/store/store.service';
import {JobService} from 'src/api/job/job.service';

@Processor(GOOGLETTSPROCESSOR)
export class GoogleTtsProcessor {
  private readonly logger = new Logger(GoogleTtsProcessor.name);

  constructor(
    private readonly jobService: JobService,
    private readonly gcpService: GcpService,
    private readonly googleTtsService: GoogleTtsService,
    @InjectQueue(GOOGLETTSPROCESSOR) private readonly googleTtsQueue: Queue
  ) {}

  @OnQueueFailed()
  async handleJobError(job: Job, err: Error) {
    if (err.message == JOB_CANCEL_MESSAGE) {
      // set it status as 'deleted' on redis
      await this.jobService.setJobStatus(job.id.toString(), {
        step: 'googletts',
        status: 'deleted',
        files: [],
        percentage: 0
      });
      // remove the job from the queue when it is failed by cancelling
      await job.remove();
      return;
    }
    this.logger.error(err.message || err, err.stack);
  }

  @OnQueueCompleted()
  async handleJobCompleted(job: Job, result: any) {
    this.logger.debug('google-tts completed');
    this.logger.debug(result);
  }

  @Process({
    name: 'googleTtsProcess',
    concurrency: +process.env.GOOGLETTS_PROCESS
  })
  async handleGoogleTtsProcess(job: Job<any>): Promise<any> {
    this.logger.debug('Start google-tts...');

    // create a temp folder
    const tempDir: string = createTempDir();

    let audioUrl;

    // debugging stuff
    // return {audioUrl: 'audioUrl'};

    try {
      // download job data from gcs
      await this.gcpService.download(job.data.jsonUrl, `${tempDir}/input_google_tts.json`);
      const jobData = JSON.parse(fs.readFileSync(`${tempDir}/input_google_tts.json`).toLocaleString());

      await job.progress(10);
      if ((await this.googleTtsQueue.getJob(job.id)).data.cancelled) {
        throw new Error(JOB_CANCEL_MESSAGE);
      }

      this.logger.debug('input ssml is %s', jobData.ssml);
      const ssml: string = await this.googleTtsService.verifyAndFix(jobData.ssml);

      this.logger.debug('verifyAndFix ssml is %s', ssml);
      const batches = this.googleTtsService.splitSSML(ssml).filter(batch => batch !== '<speak></speak>'); // workaround: sometimes the splitter generates empty ssml like '<speak></speak>'. we do not need it

      this.logger.debug('batches ssml:', JSON.stringify(batches));

      await job.progress(20);
      if ((await this.googleTtsQueue.getJob(job.id)).data.cancelled) {
        throw new Error(JOB_CANCEL_MESSAGE);
      }

      const audioFilePathArr = [];
      for (let i = 0; i < batches.length; i++) {
        const _ssml = batches[i];
        const ssml = await this.googleTtsService.verifyAndFix(_ssml);
        const audioData = await this.googleTtsService.googleSynthesizeSpeech(ssml, jobData.voiceGender);
        fs.writeFileSync(`${tempDir}/temp-${i}.wav`, audioData.audioContent, 'binary');
        audioFilePathArr.push(`${tempDir}/temp-${i}.wav`);
      }

      await job.progress(70);
      if ((await this.googleTtsQueue.getJob(job.id)).data.cancelled) {
        throw new Error(JOB_CANCEL_MESSAGE);
      }

      const mergedAudioPath: string = await this.googleTtsService.mergeAudios(audioFilePathArr, 'tts', `${tempDir}`);
      await job.progress(90);
      if ((await this.googleTtsQueue.getJob(job.id)).data.cancelled) {
        throw new Error(JOB_CANCEL_MESSAGE);
      }

      // upload mergedAudio
      audioUrl = `${job.id}/${uuid.v4()}.wav`;
      await this.gcpService.upload(mergedAudioPath, audioUrl);

      await job.progress(100);
      if ((await this.googleTtsQueue.getJob(job.id)).data.cancelled) {
        throw new Error(JOB_CANCEL_MESSAGE);
      }
    } catch (err) {
      // remove the temp folder
      removeTempDir(tempDir);
      throw err;
    }

    // remove the temp folder
    removeTempDir(tempDir);

    return {
      audioUrl
    };
  }
}
