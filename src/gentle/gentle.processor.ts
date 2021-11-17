import {Process, Processor, OnQueueFailed, InjectQueue, OnQueueCompleted} from '@nestjs/bull';
import {Logger} from '@nestjs/common';
import {Job, Queue} from 'bull';
import {GcpService} from '../shared/services/gcp/gcp.service';
import {GentleService} from './gentle.service';
import * as fs from 'fs';
import {
  Subtitle,
  SubtitleJson,
  OpenAIItem,
  JobData,
  GentleResponse,
  PollyWord,
  VoskWord, Image, Disclaimer, Citation
} from '../shared/shared.interface';
import {GENTLEPROCESSOR} from '../shared/processors.constant';
import {createTempDir, removeTempDir} from '../shared/helpers/xfs.helper';
import {SUBTITLE_CAP, SUBTITLE_TIMESHIFT_MS} from './gentle.constant';
import * as uuid from 'uuid';
import * as path from 'path';
import {getVideoAudioDuration} from '../shared/helpers/video.helper';
import {JOB_CANCEL_MESSAGE} from '../shared/shared.constant';
import {StoreService} from '../shared/services/store/store.service';
import * as pluralize from 'pluralize';
import {JobService} from 'src/api/job/job.service';

@Processor(GENTLEPROCESSOR)
export class GentleProcessor {
  private readonly logger = new Logger(GentleProcessor.name);

  constructor(
    private readonly gcpService: GcpService,
    private readonly gentleService: GentleService,
    private readonly jobService: JobService,
    @InjectQueue(GENTLEPROCESSOR) private readonly gentleQueue: Queue
  ) {}

  @OnQueueFailed()
  async handleJobError(job: Job, err: Error) {
    if (err.message == JOB_CANCEL_MESSAGE) {
      // set it status as 'deleted' on redis
      await this.jobService.setJobStatus(job.id.toString(), {
        step: 'gentle',
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
  async handleJobCompleted(job: Job, result: SubtitleJson) {
    this.logger.debug('Gentle completed');
    this.logger.debug(result);
  }

  @Process({
    name: 'Gentle',
    concurrency: +process.env.GENTLE_PROCESS
  })
  async handleGentle(job: Job<any>): Promise<any> {
    this.logger.debug('Start Gentle...');

    let gcsFilename: string;

    // create a temp folder
    const tempDir: string = createTempDir();
    let outputData = {};

    try {
      // download job data from gcs
      await this.gcpService.download(job.data.jsonUrl, `${tempDir}/input_gentle.json`);
      const jobData: JobData = JSON.parse(fs.readFileSync(`${tempDir}/input_gentle.json`).toLocaleString());

      if (!jobData.ttsWavFileUrl) {
        throw new Error('Missed ttsWavFileUrl!');
      }

      // download audio file from gcs
      const audioFilePath = `${tempDir}/${path.basename(jobData.ttsWavFileUrl)}`;
      await this.gcpService.download(jobData.ttsWavFileUrl, audioFilePath);

      await job.progress(10);
      if ((await this.gentleQueue.getJob(job.id)).data.cancelled) {
        throw new Error(JOB_CANCEL_MESSAGE);
      }

      this.logger.debug('-- Gentle 10');

      const audioDurationMs = Math.round(await getVideoAudioDuration(audioFilePath))*1000;

      this.logger.debug('-- Gentle 60');

      // pre-process text
      // TODO: move it to ssml enhancer
      // TODO: refactor this ugly code!
      const inputWords = this.gentleService.separateWords(jobData.plainText);
      const outputWords = [];

      //replace words if necessary - process special cases
      inputWords.forEach(word => {
        if (word === '&') word = 'and';

        //convert '$400' to '400 dollars'
        if (word[0] == '$') {
          const num = word.substr(1);
          outputWords.push(num);
          word = pluralize('dollar', num);
        }

        outputWords.push(word);
      });

      const inputText = outputWords.join(' ');

      this.logger.debug('going to recognize at Vosk:' + audioFilePath);
      const voskWords: Array<VoskWord> = await this.gentleService.recognizeAtVosk(audioFilePath);
      // this.logger.debug(voskWords, '...voskWords' );

      this.logger.debug('Matching rows..');
      const rows: Array<string> = this.gentleService.buildRows(inputText);
      const matchedRows: Array<Subtitle> = this.gentleService.matchVoskWords(rows, voskWords);

      //as buildRows incorrectly determine end time of last row (we dont want to fix it now to save time!!)
      //we use hack - set end time of last row === end time of the audio
      matchedRows[matchedRows.length-1].endTime = audioDurationMs;

      // this.logger.debug(matchedRows, '...matchedRows' );

      this.logger.debug('Matching sentences..');
      // @link https://stackoverflow.com/questions/11761563/javascript-regexp-for-splitting-text-into-sentences-and-keeping-the-delimiter
      const sentences: Array<string> = inputText.match(/[^.?!]+[.!?]+[\])'"`’”]*|.+/g).map(text => text.trim());
      // this.logger.debug(sentences, '...sentences' );
      const matchedSencences: Array<Subtitle> = this.gentleService.matchVoskWords(sentences, voskWords);

      //as buildRows incorrectly determine end time of last sentence (we dont want to fix it now to save time!!)
      //we use hack - set end time of last row === end time of the audio
      matchedSencences[matchedSencences.length-1].endTime = audioDurationMs;

      // this.logger.debug(matchedSencences, '...matchedSencences' );

      //old obsolete code. will be removed in future. keept now for reference
      // const gentleData: GentleResponse = await this.gentleService.request(audioFilePath, inputText);
      // const gentleData: GentleResponse = JSON.parse(fs.readFileSync('tmp/gentle.txt').toLocaleString());
      // const gentleWords: Array<PollyWord> = this.gentleService.gentleToJson(gentleData.words, audioDuration);

      await job.progress(60);
      if ((await this.gentleQueue.getJob(job.id)).data.cancelled) {
        throw new Error(JOB_CANCEL_MESSAGE);
      }

      // const {
      //   linesArr: jsonByLines,
      //   subtitlesArr: jsonByRows,
      //   sentencesArr: jsonBySentences
      // } = await this.gentleService.buildWordsAndSubtitlesByRows(
      //     inputText,
      //   gentleWords,
      //   audioDuration,
      //   SUBTITLE_CAP,
      //   SUBTITLE_TIMESHIFT_MS
      // );

      this.logger.debug('build jsonByWords..');
      const jsonByWords: Array<Subtitle> = this.gentleService.buildSrtByWords(matchedRows);

      this.logger.debug('build stringSubtitles..');
      const stringSubtitles = this.gentleService.buildStringSubtitles(matchedRows);

      //set timings for  disclaimers, citations, images
      const images:Image[] = this.gentleService.matchStringsTimes(jobData.images, jobData.plainText, voskWords) as Image[];
      const disclaimers:Disclaimer[] = this.gentleService.matchStringsTimes(jobData.disclaimers, jobData.plainText,  voskWords) as Disclaimer[];
      const citations:Citation[] = this.gentleService.matchStringsTimes(jobData.citations, jobData.plainText, voskWords) as Citation[];

      // const {disclaimers, citations, images} = await this.gentleService.buildDisclaimerCitationImage(
      //     inputText,
      //   voskWords,
      //   jobData.disclaimers,
      //   jobData.citations,
      //   jobData.images
      // );

      await job.progress(70);
      if ((await this.gentleQueue.getJob(job.id)).data.cancelled) {
        throw new Error(JOB_CANCEL_MESSAGE);
      }

      this.logger.debug('-- Gentle 70');

      gcsFilename = `${uuid.v4()}`;

      // SRT file upload
      fs.writeFileSync(`${tempDir}/subtitle.srt`, stringSubtitles);
      await this.gcpService.upload(`${tempDir}/subtitle.srt`, `${job.id}/${gcsFilename}.srt`);

      // CSV file upload
      fs.writeFileSync(`${tempDir}/subtitle.csv`, await this.gentleService.toCSV(rows.map(text => ({text}))));
      await this.gcpService.upload(`${tempDir}/subtitle.csv`, `${job.id}/${gcsFilename}.csv`);

      // OpenAI Data
      this.logger.debug('build OpenAI Data..');
      const openAIRows = await this.gentleService.toOpenAIData(matchedRows);

      this.logger.debug('finished..');
      outputData = {
        voskWords,
        rows: openAIRows,
        sentences: matchedSencences,
        words: jsonByWords,
        disclaimers,
        citations,
        images,
        subtitleCSVUrl: `${job.id}/${gcsFilename}.csv`,
        subtitleSRTUrl: `${job.id}/${gcsFilename}.srt`
      };

      await job.progress(100);
      if ((await this.gentleQueue.getJob(job.id)).data.cancelled) {
        throw new Error(JOB_CANCEL_MESSAGE);
      }
    } catch (err) {
      // removeTempDir(tempDir);
      throw err;
    }
    // removeTempDir(tempDir);

    return outputData;
  }
}
