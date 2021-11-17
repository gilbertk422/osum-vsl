import {Command} from 'nestjs-command';
import {Injectable, Logger} from '@nestjs/common';
import {Queue} from 'bull';
import {InjectQueue} from '@nestjs/bull';
import * as uuid from 'uuid';
import {GentleService} from './gentle.service';
import {GentleResponse, PollyWord, Subtitle, VoskWord} from '../shared/shared.interface';
import {getVideoAudioDuration} from '../shared/helpers/video.helper';
import {SUBTITLE_CAP, SUBTITLE_TIMESHIFT_MS} from './gentle.constant';
import * as fs from 'fs';
import {StoreService} from '../shared/services/store/store.service';
import {JOB_CANCEL_MESSAGE} from '../shared/shared.constant';
import * as pluralize from 'pluralize';
import * as path from 'path';
import {createTempDir} from '../shared/helpers/xfs.helper';
import {GcpService} from '../shared/services/gcp/gcp.service';
import {JobService} from 'src/api/job/job.service';

@Injectable()
export class GentleCommand {
  private readonly logger = new Logger(GentleCommand.name);

  constructor(
    private readonly gcpService: GcpService,
    private readonly jobService: JobService,
    private readonly gentleService: GentleService,
    @InjectQueue('gentle') private readonly gentleQueue: Queue
  ) {}

  @Command({command: 'test:gentle', describe: 'test gentle job', autoExit: true})
  async test() {
    const jobId = uuid.v4();

    // await this.jobService.setJobStatus(jobId, {
    //   step: 'gentle',
    //   status: 'in_progress',
    //   files: [],
    //   percentage: 0
    // });

    await this.gentleQueue.add(
      'Gentle',
      {
        jsonUrl: '7fedd5a7-17e9-48c0-924e-e416bcf96499/a85ddbaa-b747-47ab-a76e-e69ce589de45.json'
      },
      {jobId}
    );

    // const jobData = {
    //   "plainText": "Yes, it's true! The Disciples Way will not change anyones beliefs. First and foremost, faith is a decision of the heart. Why does this matter? Let me explain. The reason why most diet programs fail is because they make us worry about overeating and make us obsess over food. When the first thing we need to get right as it says in: Matthew 6: 33: Is to Seek the kingdom of God first before Anything. This is what sets the foundation for transformation inside and out. Because when everything is set spiritually, it makes it easier to remove the 3 calorie burning blockers caused by western food by eating the Foods God mentioned in Scripture. Are you interested in The Disciples Way? If so, look at the Disciples Way Review by Doctor Josh Dex. And discover why The Disciples Way emphasizes eating calorie-burning foods to ignite metabolism. Click through below now to learn more.",
    //   "disclaimers": [],
    //   "citations": [],
    //   "images": [],
    //   "ttsWavFileUrl": "9050bbf1-ee62-4e34-9cb6-5fa0e4fc80fe/2114b630-d12f-49d2-b04b-92c24111e283.wav"
    // }
    //
    // // console.log(jobData)
    //
    //
    // // pre-process text
    // // TODO: move it to ssml enhancer
    // // TODO: refactor this ugly code!
    // const inputWords = this.gentleService.separateWords(jobData.plainText);
    // const outputWords = [];
    //
    // //replace words if necessary - process special cases
    // inputWords.forEach(word => {
    //
    //   if  (word === '&') word = 'and';
    //
    //   //convert '$400' to '400 dollars'
    //   if (word[0] == '$') {
    //
    //     const num = word.substr(1);
    //     outputWords.push( num )
    //     word =  pluralize('dollar', num)
    //   }
    //
    //   outputWords.push(word)
    // })

    // const tempDir: string = createTempDir();

    // download audio file from gcs
    // const audioFilePath = `${tempDir}/${path.basename(jobData.ttsWavFileUrl)}`;
    // await this.gcpService.download(jobData.ttsWavFileUrl, audioFilePath);

    // const audioFilePath = 'tmp/6fdd8873-b0eb-4e61-bbd6-8c99500412a1/2114b630-d12f-49d2-b04b-92c24111e283.wav';

    // const inputText = outputWords.join(' ');
    //
    //
    // const voskWords:Array<VoskWord> = [
    //   {
    //     "conf": 1,
    //     "end": 0.57,
    //     "start": 0,
    //     "word": "yes"
    //   },
    //   {
    //     "conf": 0.941605,
    //     "end": 0.96,
    //     "start": 0.69,
    //     "word": "it's"
    //   },
    //   {
    //     "conf": 0.990316,
    //     "end": 1.41,
    //     "start": 0.96,
    //     "word": "true"
    //   },
    //   {
    //     "conf": 0.832979,
    //     "end": 1.707406,
    //     "start": 1.59,
    //     "word": "the"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 2.37,
    //     "start": 1.707406,
    //     "word": "disciples"
    //   },
    //   {
    //     "conf": 0.976057,
    //     "end": 2.579817,
    //     "start": 2.37,
    //     "word": "way"
    //   },
    //   {
    //     "conf": 0.984878,
    //     "end": 2.76,
    //     "start": 2.580238,
    //     "word": "will"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 3.03,
    //     "start": 2.76,
    //     "word": "not"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 3.39,
    //     "start": 3.03,
    //     "word": "change"
    //   },
    //   {
    //     "conf": 0.995617,
    //     "end": 3.96,
    //     "start": 3.42,
    //     "word": "anyone's"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 4.56,
    //     "start": 3.96,
    //     "word": "beliefs"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 5.31,
    //     "start": 4.92,
    //     "word": "first"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 5.46,
    //     "start": 5.31,
    //     "word": "and"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 6.15,
    //     "start": 5.46,
    //     "word": "foremost"
    //   },
    //   {
    //     "conf": 0.391,
    //     "end": 6.57,
    //     "start": 6.27,
    //     "word": "face"
    //   },
    //   {
    //     "conf": 0.580977,
    //     "end": 6.711014,
    //     "start": 6.580783,
    //     "word": "as"
    //   },
    //   {
    //     "conf": 0.718959,
    //     "end": 6.78,
    //     "start": 6.72,
    //     "word": "a"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 7.29,
    //     "start": 6.780019,
    //     "word": "decision"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 7.44,
    //     "start": 7.29,
    //     "word": "of"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 7.5,
    //     "start": 7.44,
    //     "word": "the"
    //   },
    //   {
    //     "conf": 0.998851,
    //     "end": 7.98,
    //     "start": 7.5,
    //     "word": "heart"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 8.58,
    //     "start": 8.31,
    //     "word": "why"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 8.76,
    //     "start": 8.58,
    //     "word": "does"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 8.97,
    //     "start": 8.76,
    //     "word": "this"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 9.45,
    //     "start": 8.97,
    //     "word": "matter"
    //   },
    //   {
    //     "conf": 0.992421,
    //     "end": 9.9,
    //     "start": 9.63,
    //     "word": "let"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 10.11,
    //     "start": 9.9,
    //     "word": "me"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 10.8,
    //     "start": 10.11,
    //     "word": "explain"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 11.1,
    //     "start": 10.95,
    //     "word": "the"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 11.49,
    //     "start": 11.1,
    //     "word": "reason"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 11.73,
    //     "start": 11.49,
    //     "word": "why"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 12,
    //     "start": 11.73,
    //     "word": "most"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 12.36,
    //     "start": 12,
    //     "word": "diet"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 12.99,
    //     "start": 12.36,
    //     "word": "programs"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 13.290008,
    //     "start": 12.99,
    //     "word": "fail"
    //   },
    //   {
    //     "conf": 0.991862,
    //     "end": 13.44,
    //     "start": 13.290008,
    //     "word": "is"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 13.74,
    //     "start": 13.44,
    //     "word": "because"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 13.89,
    //     "start": 13.74,
    //     "word": "they"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 14.13,
    //     "start": 13.89,
    //     "word": "make"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 14.28,
    //     "start": 14.13,
    //     "word": "us"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 14.61,
    //     "start": 14.28,
    //     "word": "worry"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 14.88,
    //     "start": 14.61,
    //     "word": "about"
    //   },
    //   {
    //     "conf": 0.916435,
    //     "end": 15.48,
    //     "start": 14.88,
    //     "word": "overeating"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 15.63,
    //     "start": 15.48,
    //     "word": "and"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 15.87,
    //     "start": 15.63,
    //     "word": "make"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 16.013877,
    //     "start": 15.87,
    //     "word": "us"
    //   },
    //   {
    //     "conf": 0.571652,
    //     "end": 16.41,
    //     "start": 16.02,
    //     "word": "obsessed"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 16.68,
    //     "start": 16.410007,
    //     "word": "over"
    //   },
    //   {
    //     "conf": 0.995399,
    //     "end": 17.07,
    //     "start": 16.68,
    //     "word": "food"
    //   },
    //   {
    //     "conf": 0.993657,
    //     "end": 18,
    //     "start": 17.76,
    //     "word": "when"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 18.12,
    //     "start": 18,
    //     "word": "the"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 18.42,
    //     "start": 18.12,
    //     "word": "first"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 18.69,
    //     "start": 18.42,
    //     "word": "thing"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 18.81,
    //     "start": 18.69,
    //     "word": "we"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 18.96,
    //     "start": 18.81,
    //     "word": "need"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 19.08,
    //     "start": 18.96,
    //     "word": "to"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 19.29,
    //     "start": 19.08,
    //     "word": "get"
    //   },
    //   {
    //     "conf": 0.991897,
    //     "end": 19.559916,
    //     "start": 19.29,
    //     "word": "right"
    //   },
    //   {
    //     "conf": 0.938889,
    //     "end": 19.65,
    //     "start": 19.56,
    //     "word": "as"
    //   },
    //   {
    //     "conf": 0.999616,
    //     "end": 19.77,
    //     "start": 19.65,
    //     "word": "it"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 20.1,
    //     "start": 19.77,
    //     "word": "says"
    //   },
    //   {
    //     "conf": 0.999503,
    //     "end": 20.37,
    //     "start": 20.1,
    //     "word": "in"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 21.09,
    //     "start": 20.64,
    //     "word": "matthew"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 21.54,
    //     "start": 21.09,
    //     "word": "chapter"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 21.9,
    //     "start": 21.54,
    //     "word": "six"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 22.14,
    //     "start": 21.9,
    //     "word": "verse"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 22.44,
    //     "start": 22.14,
    //     "word": "thirty"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 22.86,
    //     "start": 22.44,
    //     "word": "three"
    //   },
    //   {
    //     "conf": 0.987633,
    //     "end": 23.22,
    //     "start": 23.04,
    //     "word": "is"
    //   },
    //   {
    //     "conf": 0.975116,
    //     "end": 23.37,
    //     "start": 23.22,
    //     "word": "to"
    //   },
    //   {
    //     "conf": 0.995543,
    //     "end": 23.609991,
    //     "start": 23.370694,
    //     "word": "seek"
    //   },
    //   {
    //     "conf": 0.999834,
    //     "end": 23.7,
    //     "start": 23.609991,
    //     "word": "the"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 24.06,
    //     "start": 23.7,
    //     "word": "kingdom"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 24.21,
    //     "start": 24.06,
    //     "word": "of"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 24.54,
    //     "start": 24.24,
    //     "word": "god"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 24.87,
    //     "start": 24.54,
    //     "word": "first"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 25.2,
    //     "start": 24.87,
    //     "word": "before"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 25.74,
    //     "start": 25.2,
    //     "word": "anything"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 26.7,
    //     "start": 26.46,
    //     "word": "this"
    //   },
    //   {
    //     "conf": 0.991409,
    //     "end": 26.85,
    //     "start": 26.7,
    //     "word": "is"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 27.06,
    //     "start": 26.85,
    //     "word": "what"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 27.359995,
    //     "start": 27.06,
    //     "word": "sets"
    //   },
    //   {
    //     "conf": 0.998891,
    //     "end": 27.45,
    //     "start": 27.360002,
    //     "word": "the"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 28.11,
    //     "start": 27.45,
    //     "word": "foundation"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 28.226396,
    //     "start": 28.11,
    //     "word": "for"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 29.13,
    //     "start": 28.23,
    //     "word": "transformation"
    //   },
    //   {
    //     "conf": 0.999143,
    //     "end": 29.64,
    //     "start": 29.13,
    //     "word": "inside"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 29.79,
    //     "start": 29.64,
    //     "word": "and"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 30.03,
    //     "start": 29.79,
    //     "word": "out"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 30.81,
    //     "start": 30.45,
    //     "word": "because"
    //   },
    //   {
    //     "conf": 0.999039,
    //     "end": 31.02,
    //     "start": 30.81,
    //     "word": "when"
    //   },
    //   {
    //     "conf": 0.996748,
    //     "end": 31.53,
    //     "start": 31.02,
    //     "word": "everything"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 31.65,
    //     "start": 31.53,
    //     "word": "is"
    //   },
    //   {
    //     "conf": 0.7339,
    //     "end": 31.919802,
    //     "start": 31.65,
    //     "word": "set"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 32.76,
    //     "start": 31.920143,
    //     "word": "spiritually"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 33.03,
    //     "start": 32.88,
    //     "word": "it"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 33.33,
    //     "start": 33.03,
    //     "word": "makes"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 33.42,
    //     "start": 33.33,
    //     "word": "it"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 33.87,
    //     "start": 33.42,
    //     "word": "easier"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 34.02,
    //     "start": 33.87,
    //     "word": "to"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 34.35,
    //     "start": 34.02,
    //     "word": "remove"
    //   },
    //   {
    //     "conf": 0.990622,
    //     "end": 34.47,
    //     "start": 34.35,
    //     "word": "the"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 34.77,
    //     "start": 34.47,
    //     "word": "three"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 35.22,
    //     "start": 34.77,
    //     "word": "calorie"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 35.55,
    //     "start": 35.22,
    //     "word": "burning"
    //   },
    //   {
    //     "conf": 0.894532,
    //     "end": 36.119663,
    //     "start": 35.55,
    //     "word": "blockers"
    //   },
    //   {
    //     "conf": 0.964257,
    //     "end": 36.479194,
    //     "start": 36.12,
    //     "word": "caused"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 36.6,
    //     "start": 36.479194,
    //     "word": "by"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 37.11,
    //     "start": 36.6,
    //     "word": "western"
    //   },
    //   {
    //     "conf": 0.957455,
    //     "end": 37.44,
    //     "start": 37.11,
    //     "word": "food"
    //   },
    //   {
    //     "conf": 0.998945,
    //     "end": 37.59,
    //     "start": 37.468722,
    //     "word": "by"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 37.89,
    //     "start": 37.590007,
    //     "word": "eating"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 37.98,
    //     "start": 37.89,
    //     "word": "the"
    //   },
    //   {
    //     "conf": 0.987425,
    //     "end": 38.340125,
    //     "start": 37.98,
    //     "word": "foods"
    //   },
    //   {
    //     "conf": 0.949299,
    //     "end": 38.639993,
    //     "start": 38.340125,
    //     "word": "god"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 39.06,
    //     "start": 38.640004,
    //     "word": "mentioned"
    //   },
    //   {
    //     "conf": 0.999477,
    //     "end": 39.21,
    //     "start": 39.06,
    //     "word": "in"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 39.81,
    //     "start": 39.210015,
    //     "word": "scripture"
    //   },
    //   {
    //     "conf": 0.840155,
    //     "end": 40.649985,
    //     "start": 40.5,
    //     "word": "are"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 40.83,
    //     "start": 40.649985,
    //     "word": "you"
    //   },
    //   {
    //     "conf": 0.942709,
    //     "end": 41.159359,
    //     "start": 40.86,
    //     "word": "enter"
    //   },
    //   {
    //     "conf": 0.481555,
    //     "end": 41.46,
    //     "start": 41.190026,
    //     "word": "stood"
    //   },
    //   {
    //     "conf": 0.54813,
    //     "end": 41.58,
    //     "start": 41.46,
    //     "word": "in"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 41.67,
    //     "start": 41.593557,
    //     "word": "the"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 42.27,
    //     "start": 41.67,
    //     "word": "disciples"
    //   },
    //   {
    //     "conf": 0.979004,
    //     "end": 42.6,
    //     "start": 42.27,
    //     "word": "way"
    //   },
    //   {
    //     "conf": 0.862153,
    //     "end": 43.139919,
    //     "start": 42.93,
    //     "word": "if"
    //   },
    //   {
    //     "conf": 0.988601,
    //     "end": 43.53,
    //     "start": 43.139919,
    //     "word": "so"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 43.89,
    //     "start": 43.650026,
    //     "word": "look"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 44.01,
    //     "start": 43.89,
    //     "word": "at"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 44.1,
    //     "start": 44.01,
    //     "word": "the"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 44.7,
    //     "start": 44.1,
    //     "word": "disciples"
    //   },
    //   {
    //     "conf": 0.93135,
    //     "end": 44.938004,
    //     "start": 44.7,
    //     "word": "way"
    //   },
    //   {
    //     "conf": 0.984677,
    //     "end": 45.33,
    //     "start": 44.94,
    //     "word": "review"
    //   },
    //   {
    //     "conf": 0.997419,
    //     "end": 45.57,
    //     "start": 45.36,
    //     "word": "by"
    //   },
    //   {
    //     "conf": 0.505285,
    //     "end": 45.99,
    //     "start": 45.6,
    //     "word": "dr"
    //   },
    //   {
    //     "conf": 0.9929,
    //     "end": 46.351124,
    //     "start": 45.99,
    //     "word": "josh"
    //   },
    //   {
    //     "conf": 0.730894,
    //     "end": 46.83,
    //     "start": 46.351124,
    //     "word": "decks"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 47.7,
    //     "start": 47.52,
    //     "word": "and"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 48.21,
    //     "start": 47.7,
    //     "word": "discover"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 48.419989,
    //     "start": 48.21,
    //     "word": "why"
    //   },
    //   {
    //     "conf": 0.956618,
    //     "end": 48.54,
    //     "start": 48.420011,
    //     "word": "the"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 49.14,
    //     "start": 48.54,
    //     "word": "disciples"
    //   },
    //   {
    //     "conf": 0.81503,
    //     "end": 49.35,
    //     "start": 49.14,
    //     "word": "way"
    //   },
    //   {
    //     "conf": 0.999157,
    //     "end": 50.1,
    //     "start": 49.38,
    //     "word": "emphasizes"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 50.37,
    //     "start": 50.1,
    //     "word": "eating"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 50.88,
    //     "start": 50.37,
    //     "word": "calorie"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 51.27,
    //     "start": 50.88,
    //     "word": "burning"
    //   },
    //   {
    //     "conf": 0.999703,
    //     "end": 51.63,
    //     "start": 51.27,
    //     "word": "foods"
    //   },
    //   {
    //     "conf": 0.998754,
    //     "end": 51.78,
    //     "start": 51.63,
    //     "word": "to"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 52.166239,
    //     "start": 51.78,
    //     "word": "ignite"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 52.98,
    //     "start": 52.171736,
    //     "word": "metabolism"
    //   },
    //   {
    //     "conf": 0.997455,
    //     "end": 53.94,
    //     "start": 53.7,
    //     "word": "click"
    //   },
    //   {
    //     "conf": 0.998845,
    //     "end": 54.18,
    //     "start": 53.940011,
    //     "word": "through"
    //   },
    //   {
    //     "conf": 0.999427,
    //     "end": 54.51,
    //     "start": 54.18,
    //     "word": "below"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 54.72,
    //     "start": 54.51,
    //     "word": "now"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 54.84,
    //     "start": 54.72,
    //     "word": "to"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 55.14,
    //     "start": 54.84,
    //     "word": "learn"
    //   },
    //   {
    //     "conf": 1,
    //     "end": 55.47,
    //     "start": 55.14,
    //     "word": "more"
    //   }
    // ]
    //
    // const rows:Array<string> = this.gentleService.buildRows(inputText);
    // const matchedRows:Array<Subtitle> = this.gentleService.matchVoskWords(rows, voskWords);
    // this.logger.debug(matchedRows, '...matchedRows' );
    //
    // // @link https://stackoverflow.com/questions/11761563/javascript-regexp-for-splitting-text-into-sentences-and-keeping-the-delimiter
    // const sentences:Array<string> = inputText.match(/[^.?!]+[.!?]+[\])'"`’”]*|.+/g).map(item=>item.trim());
    // // this.logger.debug(sentences, '...sentences' );
    //
    // const matchedSencences:Array<Subtitle> = this.gentleService.matchVoskWords(sentences, voskWords);
    // this.logger.debug(matchedSencences, '...matchedSencences' );
    //
    // // await job.progress(60);
    // // if ((await this.gentleQueue.getJob(job.id)).data.cancelled) {
    // //   throw new Error(JOB_CANCEL_MESSAGE);
    // // }
    //
    // this.logger.debug('-- Gentle 60');
  }
}
