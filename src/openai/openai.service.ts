import {Injectable, Logger, HttpService} from '@nestjs/common';
import {AxiosResponse} from 'axios';
import {OpenaiResponse} from './openai.interface';
import {extractSheets} from 'spreadsheet-to-json';
const GCP_CREDS = require('../../gcs_credential/cesar-osum-staging-281014-95179ae63068.json');
import {
  OPENAI_API_URL,
  OPENAI_CONFIG_MODEL,
  OPENAI_CONFIG_STOP,
  OPENAI_CONFIG_TEMPERATURE,
  OPENAI_CONFIG_CONTENT_TYPE,
  OPENAI_KEYWORDS_ANSWER_SEPARATOR,
  OPENAI_NO_KEYWORDS_ERROR,
  OPENAI_MIN_RESULTS_VIDUX,
  OPENAI_CHOSEN_CONTENT_ANSWER_SEPARATOR,
  OPENAI_MIN_RESULTS_SHUTTERSTOCK,
  OPENAI_DEFAULT_IMAGE_ASSET_PROP,
  OPENAI_DEFAULT_VIDEO_ASSET_PROP,
  OPENAI_MAX_RESULTS_CONTENT,
  OPENAI_FALLBACK_KEYWORD,
  OPENAI_FALLBACK_DURATION
} from './openai.constant';
import {ShutterstockService} from '../shared/services/shutterstock/shutterstock.service';
import {ShutterSearchResult} from '../shared/services/shutterstock/shutterstock.interface';
import {GcpService} from '../shared/services/gcp/gcp.service';
import * as uuid from 'uuid';
import {JobId, Job} from 'bull';
import {
  VIDEO_EXT,
  MIN_IMAGE_WIDTH,
  MIN_IMAGE_HEIGHT,
  VIDEO_DATA_TYPE,
  IMAGE_DATA_TYPE,
  IMAGE_EXT
} from '../shared/shared.constant';
import {OpenAIItem, JobData} from '../shared/shared.interface';

@Injectable()
export class OpenaiService {
  private readonly logger = new Logger(OpenaiService.name);
  private sheet: any;

  constructor(
    private httpService: HttpService,
    private readonly shutterstockService: ShutterstockService,
    private readonly gcpService: GcpService
  ) {}

  buildKeywordQuestion(sentence: string): string {
    const baseQuestion = 'What is the most important keyword of this sentence';
    const baseQnA = [
      `Q: ${baseQuestion}: "I want to eat more sugar"`,
      `A: sugar`,
      `Q: ${baseQuestion}: "As the warm summer days came around she would visit, like she always did to sunbathe with me."`,
      `A: summer`
    ].join('\n');
    return `${baseQnA}\nQ: ${baseQuestion}: "${sentence}"\n`;
  }

  buildContentChooserQuestion(before: string, current: string, after: string, sentences: Array<string>): string {
    return `Q: Considering the context of this sentences: \"I really love khinkali and khachapuri. I don't even guess what's happening. I'm ukrainian.\" Which of the sentences between 1-3 is the best match? Sentence 1: \"Georgian mountains just under the sky.\" Sentence 2: \"Person eating khachapuri with piano music on a background.\" Sentence 3: \"wo xiang yao baozi he pijiu\"\nA: Sentence 2\nQ: Considering the context of this sentences: \"I really love chinese food. Guo Bao Rou is a most loved dongbei dish for me.\" Which of the sentences between 1-3 is the best match? Sentence 1: \"Georgian mountains just under the sky.\" Sentence 2: \"Person eating khachapuri with piano music on a background.\" Sentence 3: \"wo xiang yao baozi he pijiu\"\nA: Sentence 3\nQ: Considering the context of this sentences: "${before} ${current} ${after}" Which of the sentences between 1-${
      sentences.length
    } is the best match? ${sentences.map((s, i) => `Sentence ${i + 1}: "${s.trim().replace('\n', '')}"`).join(' ')}\n`;
  }

  buildKeywordsAnalogsQuestion(keywords: Array<string>): string {
    return `Q: What words are synonyms to "big"?\nA: huge, giant, large\nQ: What words are synonyms to "${keywords.join(
      ' '
    )}"?\n`;
  }

  async askOpenAI(prompt: string): Promise<OpenaiResponse> {
    const result: AxiosResponse<OpenaiResponse> = await this.httpService
      .post(
        OPENAI_API_URL,
        {
          model: OPENAI_CONFIG_MODEL,
          temperature: OPENAI_CONFIG_TEMPERATURE,
          stop: OPENAI_CONFIG_STOP,
          prompt
        },
        {
          headers: {
            'Content-Type': OPENAI_CONFIG_CONTENT_TYPE,
            Authorization: `Bearer ${process.env.OPENAI_API_SECRET}`
          }
        }
      )
      .toPromise();

    return result.data;
  }

  splitVideosImages(arr: Array<any>, videosPercent: number): any {
    const getIndex = (_arr, usedIndexesArr) => {
      let index = Math.floor(Math.random() * _arr.length);
      while (usedIndexesArr.includes(index)) index = Math.floor(Math.random() * _arr.length);
      return index;
    };
    const mult = videosPercent >= 100 ? 1 : videosPercent <= 0 ? 0 : +`.${videosPercent}`;
    const videosCount = +(arr.length * mult).toFixed();
    const imagesCount = arr.length - videosCount;
    const videosCounter = new Array(videosCount).fill(null);
    const imagesCounter = new Array(imagesCount).fill(null);
    const videos = [];
    const images = [];
    const usedIndexes = [];
    for (const _ of videosCounter) {
      const index = getIndex(arr, usedIndexes);
      videos.push({initialIndex: index, item: arr[index]});
      usedIndexes.push(index);
    }
    for (const _ of imagesCounter) {
      const index = getIndex(arr, usedIndexes);
      images.push({initialIndex: index, item: arr[index]});
      usedIndexes.push(index);
    }
    return {videos, images};
  }

  restoreRowsOrder(arr: Array<any>): any {
    return arr.sort((x, y) => x.initialIndex - y.initialIndex);
  }

  async buildKeywords(text: string): Promise<any> {
    const keywordQuestion: string = this.buildKeywordQuestion(text); // prepare question for keywords
    const keywordsResponse: OpenaiResponse = await this.askOpenAI(keywordQuestion); // ask OpenAI for keywords
    let chosenKeywords: Array<string> = keywordsResponse.choices.map(
      c =>
        c.text
          .split(OPENAI_KEYWORDS_ANSWER_SEPARATOR)[1]
          .toLowerCase()
          .split(' ')[0]
    ); // parsing answer
    const _chosenKeywords = [];
    if (chosenKeywords.length === 0) {
      this.logger.warn(OPENAI_NO_KEYWORDS_ERROR);
      _chosenKeywords.push(...chosenKeywords);
      const words = this.separateWords(text);
      do {
        chosenKeywords = [
          words[Math.floor(Math.random() * words.length)].toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
        ];
      } while (_chosenKeywords.some(k => chosenKeywords.includes(k)));
      this.logger.warn(`Chosen random keyword ${chosenKeywords[0]}`);
    }
    return chosenKeywords;
  }

  async getViduxContent(chosenKeywords: Array<string>, fallbackKeywords: Array<string>): Promise<any> {
    let videosSearchResults = await this.search(chosenKeywords); // search videos in the Vidux DB
    if (videosSearchResults.length < OPENAI_MIN_RESULTS_VIDUX) {
      const keywordsAnalogsQuestion: string = this.buildKeywordsAnalogsQuestion(chosenKeywords);
      const keywordsAnalogsResponse: OpenaiResponse = await this.askOpenAI(keywordsAnalogsQuestion);
      const chosenKeywordsAnalogs = keywordsAnalogsResponse.choices.map(c =>
        c.text
          .split(OPENAI_KEYWORDS_ANSWER_SEPARATOR)[1]
          .toLowerCase()
          .split(',')
          .map(t => t.trim().split(' ')[0])
          .filter(t => !!t)
      )[0];

      let counter = 0;
      do {
        const altKeyword = chosenKeywordsAnalogs[counter];
        videosSearchResults = await this.search([altKeyword]);
        counter += 1;
      } while (chosenKeywordsAnalogs[counter] && videosSearchResults.length < OPENAI_MIN_RESULTS_VIDUX);

      // if STILL no results — getting random videos by fallbackKeywords
      if (videosSearchResults.length < OPENAI_MIN_RESULTS_VIDUX) {
        videosSearchResults = await this.search(fallbackKeywords);
      }
    }
    return videosSearchResults.slice(0, OPENAI_MAX_RESULTS_CONTENT);
  }

  async getShutterstockVideoContent(
    chosenKeywords: Array<string>,
    duration: number,
    fallbackKeywords: Array<string>
  ): Promise<any> {
    let videosSearchResults: ShutterSearchResult = await this.shutterstockService.search(
      chosenKeywords,
      VIDEO_DATA_TYPE,
      {
        videoOptions: {durationFrom: duration}
      }
    ); // search videos in Shutterstock by keywords
    if (videosSearchResults.length < OPENAI_MIN_RESULTS_SHUTTERSTOCK) {
      const keywordsAnalogsQuestion: string = this.buildKeywordsAnalogsQuestion(chosenKeywords);
      const keywordsAnalogsResponse: OpenaiResponse = await this.askOpenAI(keywordsAnalogsQuestion);
      const chosenKeywordsAnalogs = keywordsAnalogsResponse.choices.map(c =>
        c.text
          .split(OPENAI_KEYWORDS_ANSWER_SEPARATOR)[1]
          .toLowerCase()
          .split(',')
          .map(t => t.trim().split(' ')[0])
          .filter(t => !!t)
      )[0];

      let counter = 0;
      do {
        const altKeyword = chosenKeywordsAnalogs[counter];
        videosSearchResults = await this.shutterstockService.search([altKeyword], VIDEO_DATA_TYPE, {
          videoOptions: {durationFrom: duration}
        });
        counter += 1;
      } while (chosenKeywordsAnalogs[counter] && videosSearchResults.length < OPENAI_MIN_RESULTS_SHUTTERSTOCK);

      // if STILL no results — getting random videos by keyword "diet"
      if (videosSearchResults.length < OPENAI_MIN_RESULTS_SHUTTERSTOCK) {
        videosSearchResults = await this.shutterstockService.search(fallbackKeywords, VIDEO_DATA_TYPE, {
          videoOptions: {durationFrom: duration}
        });
      }
    }
    return videosSearchResults.slice(0, OPENAI_MAX_RESULTS_CONTENT);
  }

  async chooseViduxVideo(
    videosSearchResults: Array<any>,
    textContext: OpenAIItem,
    jobId: JobId,
    tempDir: string
  ): Promise<any> {
    const videoChooserQuestion: string = this.buildContentChooserQuestion(
      textContext.before,
      textContext.current,
      textContext.after,
      videosSearchResults.map(v => v.Title)
    ); // prepare question for choosing video
    this.logger.debug({s: 'chooseViduxVideo', videoChooserQuestion});
    const chosenVideoResponse: OpenaiResponse = await this.askOpenAI(videoChooserQuestion); // ask OpenAI for chosen video
    this.logger.debug({s: 'chooseViduxVideo', chosenVideoResponse});
    const chosenVideoVariant: string = chosenVideoResponse.choices.map(
      c => c.text.split(OPENAI_CHOSEN_CONTENT_ANSWER_SEPARATOR)[1]
    )[0]; // parsing answer
    this.logger.debug({s: 'chooseViduxVideo', chosenVideoVariant});
    const chosenVideoUrl: string = videosSearchResults[+chosenVideoVariant - 1]
      ? videosSearchResults[+chosenVideoVariant - 1]['Video URL']
      : videosSearchResults[Math.floor(Math.random() * videosSearchResults.length)]['Video URL'];
    this.logger.debug({s: 'chooseViduxVideo', chosenVideoUrl});
    const reUploadedToGcs = await this.gcpService.uploadFileByUrl(
      chosenVideoUrl,
      jobId,
      tempDir,
      `${uuid.v4()}.${VIDEO_EXT}`,
      false
    );
    this.logger.debug({s: 'chooseViduxVideo', reUploadedToGcs});
    return reUploadedToGcs;
  }

  async chooseShutterstockVideo(
    videosSearchResults: Array<any>,
    textContext: OpenAIItem,
    jobId: JobId,
    tempDir: string
  ): Promise<any> {
    const videoChooserQuestion: string = this.buildContentChooserQuestion(
      textContext.before,
      textContext.current,
      textContext.after,
      videosSearchResults.map(v => v.description)
    ); // prepare question for choosing video
    const chosenVideoResponse: OpenaiResponse = await this.askOpenAI(videoChooserQuestion); // ask OpenAI for chosen video
    const chosenVideoVariant: string = chosenVideoResponse.choices.map(
      c => c.text.split(OPENAI_CHOSEN_CONTENT_ANSWER_SEPARATOR)[1]
    )[0]; // parsing answer
    const chosenVideoUrl: string = videosSearchResults[+chosenVideoVariant - 1]
      ? videosSearchResults[+chosenVideoVariant - 1].assets[OPENAI_DEFAULT_VIDEO_ASSET_PROP].url
      : videosSearchResults[Math.floor(Math.random() * videosSearchResults.length)].assets[
          OPENAI_DEFAULT_VIDEO_ASSET_PROP
        ].url; // TODO: IMPLEMENT GETTING CONTENT WITHOUT WATERMARKS BEFORE GOING LIVE
    const reUploadedToGcs = await this.gcpService.uploadFileByUrl(
      chosenVideoUrl,
      jobId,
      tempDir,
      `${uuid.v4()}.${VIDEO_EXT}`,
      false
    );
    return reUploadedToGcs;
  }

  async getShutterstockImageContent(chosenKeywords: Array<string>, fallbackKeywords: Array<string>): Promise<any> {
    let imagesSearchResults: ShutterSearchResult = await this.shutterstockService.search(
      chosenKeywords,
      IMAGE_DATA_TYPE,
      {imageOptions: {widthFrom: MIN_IMAGE_WIDTH, heightFrom: MIN_IMAGE_HEIGHT}} // hardcoded min w/h
    ); // search images in Shutterstock by keywords
    if (imagesSearchResults.length < OPENAI_MIN_RESULTS_SHUTTERSTOCK) {
      const keywordsAnalogsQuestion: string = this.buildKeywordsAnalogsQuestion(chosenKeywords);
      const keywordsAnalogsResponse: OpenaiResponse = await this.askOpenAI(keywordsAnalogsQuestion);
      const chosenKeywordsAnalogs = keywordsAnalogsResponse.choices.map(c =>
        c.text
          .split(OPENAI_KEYWORDS_ANSWER_SEPARATOR)[1]
          .toLowerCase()
          .split(',')
          .map(t => t.trim().split(' ')[0])
          .filter(t => !!t)
      )[0];

      let counter = 0;
      do {
        const altKeyword = chosenKeywordsAnalogs[counter];
        imagesSearchResults = await this.shutterstockService.search(
          [altKeyword],
          IMAGE_DATA_TYPE,
          {imageOptions: {widthFrom: MIN_IMAGE_WIDTH, heightFrom: MIN_IMAGE_HEIGHT}} // hardcoded min w/h
        );
        counter += 1;
      } while (chosenKeywordsAnalogs[counter] && imagesSearchResults.length < OPENAI_MIN_RESULTS_SHUTTERSTOCK);

      // if STILL no results — getting random videos by keyword "diet"
      if (imagesSearchResults.length < OPENAI_MIN_RESULTS_SHUTTERSTOCK) {
        imagesSearchResults = await this.shutterstockService.search(
          fallbackKeywords,
          IMAGE_DATA_TYPE,
          {imageOptions: {widthFrom: MIN_IMAGE_WIDTH, heightFrom: MIN_IMAGE_HEIGHT}} // hardcoded min w/h
        );
      }
    }
    return imagesSearchResults.slice(0, OPENAI_MAX_RESULTS_CONTENT);
  }

  async chooseShutterstockImage(
    imagesSearchResults: Array<any>,
    textContext: OpenAIItem,
    jobId: JobId,
    tempDir: string
  ): Promise<any> {
    const imageChooserQuestion: string = this.buildContentChooserQuestion(
      textContext.before,
      textContext.current,
      textContext.after,
      imagesSearchResults.map(v => v.description)
    ); // prepare question for choosing image
    const chosenImageResponse: OpenaiResponse = await this.askOpenAI(imageChooserQuestion); // ask OpenAI for chosen video
    const chosenImageVariant: string = chosenImageResponse.choices.map(
      c => c.text.split(OPENAI_CHOSEN_CONTENT_ANSWER_SEPARATOR)[1]
    )[0]; // parsing answer
    const chosenImageUrl: string = imagesSearchResults[+chosenImageVariant - 1]
      ? imagesSearchResults[+chosenImageVariant - 1].assets[OPENAI_DEFAULT_IMAGE_ASSET_PROP].url
      : imagesSearchResults[+chosenImageVariant - 1][Math.floor(Math.random() * imagesSearchResults.length)].assets[
          OPENAI_DEFAULT_IMAGE_ASSET_PROP
        ].url; // TODO: IMPLEMENT GETTING CONTENT WITHOUT WATERMARKS BEFORE GOING LIVE
    const reUploadedToGcs = await this.gcpService.uploadFileByUrl(
      chosenImageUrl,
      jobId,
      tempDir,
      `${uuid.v4()}.${IMAGE_EXT}`,
      true
    );
    const publicFileUrl = await this.gcpService.gcsUrlToDirectUrl(reUploadedToGcs);
    this.logger.debug(`${JSON.stringify({reUploadedToGcs, publicFileUrl})}`);
    return publicFileUrl;
  }

  separateWords(str: string): Array<string> {
    if (!str) return [];
    const match = str.match(/"(?:\\"|[^"])+"|[^\s]+/g);
    if (!match) return [];
    return match.map(word => word.replace(/^\"|\"$/g, ''));
  }

  async search(keywords: Array<string>): Promise<any> {
    if (!this.sheet) {
      this.logger.debug({s: 'VIDUX INIT...'});
      const sheets = await extractSheets({
        spreadsheetKey: process.env.VIDUX_SHEET_KEY,
        credentials: GCP_CREDS
      });

      this.sheet = sheets['Sheet1'];
    }
    return this.sheet.filter(row =>
      keywords.some(k => row.Title && this.separateWords(row.Title.toLowerCase()).includes(k.toLowerCase()))
    );
  }

  async viduxWay(jobData: JobData, job: Job<any>, tempDir: string): Promise<any> {
    const updatedRows = [];
    for (const item of jobData.rows) {
      this.logger.debug(`[VIDUX] Processing item for getting video ${JSON.stringify(item, null, 2)}`);

      const chosenKeywords: Array<string> = await this.buildKeywords(item.text);
      this.logger.debug({chosenKeywords});

      const videosSearchResults: Array<any> = await this.getViduxContent(chosenKeywords, [OPENAI_FALLBACK_KEYWORD]);
      this.logger.debug({videosSearchResults: videosSearchResults.length});

      const chosenVideoUrl: string = await this.chooseViduxVideo(
        videosSearchResults,
        item.textContext,
        job.id,
        tempDir
      );
      this.logger.debug({chosenVideoUrl});

      item.type = VIDEO_DATA_TYPE;
      item.rawContent = chosenVideoUrl;
      updatedRows.push(item);

      if (job.progress() < 100) job.progress(job.progress() + Math.floor(100 / jobData.rows.length)); // calculating how much to tick
    }
    return updatedRows;
  }

  async shutterstockWay(jobData: JobData, job: Job<any>, tempDir: string): Promise<any> {
    const updatedRows = [];
    const arrays = this.splitVideosImages(jobData.rows, jobData.videosPercent);
    // Processing videos
    for (const {initialIndex, item} of arrays.videos) {
      this.logger.debug(`[SHUTTER] Processing item for getting video ${JSON.stringify(item, null, 2)}`);

      const chosenKeywords: Array<string> = await this.buildKeywords(item.text);
      this.logger.debug({chosenKeywords});

      const duration = Math.floor((+item.endTime - +item.startTime) / 1000) || OPENAI_FALLBACK_DURATION; // calculate duration in seconds, fallback to 5 if no provided
      this.logger.debug({duration});

      const videosSearchResults: ShutterSearchResult = await this.getShutterstockVideoContent(
        chosenKeywords,
        duration,
        [OPENAI_FALLBACK_KEYWORD]
      );
      this.logger.debug({videosSearchResults: videosSearchResults.length});

      const chosenVideoUrl: string = await this.chooseShutterstockVideo(
        videosSearchResults,
        item.textContext,
        job.id,
        tempDir
      );
      this.logger.debug({chosenVideoUrl});

      item.type = VIDEO_DATA_TYPE;
      item.rawContent = chosenVideoUrl;
      updatedRows[initialIndex] = {...item};

      if (job.progress() < (arrays.videos.length * 100) / jobData.rows.length)
        job.progress(job.progress() + Math.floor(100 / jobData.rows.length)); // calculating how much to tick
    }

    // Processing images
    for (const {initialIndex, item} of arrays.images) {
      this.logger.debug(`[SHUTTER] Processing item for getting image ${JSON.stringify(item, null, 2)}`);

      const chosenKeywords = await this.buildKeywords(item.text);
      this.logger.debug({chosenKeywords});

      const imagesSearchResults: ShutterSearchResult = await this.getShutterstockImageContent(chosenKeywords, [
        OPENAI_FALLBACK_KEYWORD
      ]);
      this.logger.debug({imagesSearchResults: imagesSearchResults.length});

      const chosenImageUrl: string = await this.chooseShutterstockImage(
        imagesSearchResults,
        item.textContext,
        job.id,
        tempDir
      );
      this.logger.debug({chosenImageUrl});

      item.type = IMAGE_DATA_TYPE;
      item.rawContent = chosenImageUrl;
      updatedRows[initialIndex] = {...item};

      if (job.progress() < (arrays.images.length * 100) / jobData.rows.length)
        job.progress(job.progress() + Math.floor(100 / jobData.rows.length)); // calculating how much to tick
    }
    return updatedRows;
  }
}
