import {Injectable, Logger, HttpService} from '@nestjs/common';
import {AxiosResponse} from 'axios';
import * as fs from 'fs';
import * as ffmpeg from 'fluent-ffmpeg';
import {OpenaiResponse} from './musicai.interface';
import {
  OPENAI_API_URL,
  OPENAI_CONFIG_MODEL,
  OPENAI_CONFIG_STOP,
  OPENAI_CONFIG_TEMPERATURE,
  OPENAI_CONFIG_CONTENT_TYPE,
  OPENAI_INTENSITY_ANSWER_SEPARATOR,
  MUBERT_METHOD_GET_SERVICE_ACCESS,
  MUBERT_METHOD_TRACK_STATUS,
  MUBERT_METHOD_RECORD_TRACK,
  MUBERT_TASK_ID,
  MUBERT_TASK_STATUS_DONE,
  MUBERT_FALLBACK_MOOD,
  MUBERT_BEFORE,
  MUBERT_AFTER,
  MUBERT_TASK_CATEGORY_MOODS,
  MUBERT_TASK_STATUS_TEXT,
  MUBERT_TASK_DOWNLOAD_LINK,
  MUBERT_FALLBACK_INTENSITY
} from './musicai.constant';
import {GcpService} from '../shared/services/gcp/gcp.service';
import {JobData} from '../shared/shared.interface';

@Injectable()
export class MusicaiService {
  private readonly logger = new Logger(MusicaiService.name);
  private sheet: any;

  constructor(private httpService: HttpService, private readonly gcpService: GcpService) {}

  getIntensitySeq(start: any, arr: Array<any>, i: number, direction: string): number {
    const isBefore = direction === 'before';
    let seq = 0;
    let counter = isBefore ? i - 1 : i + 1;
    while (!!start && !!arr[counter] && start.intensity === arr[counter].intensity) {
      seq += 1;
      counter = isBefore ? counter - 1 : counter + 1;
    }
    return seq;
  }

  getParentMood(mood: string): string {
    const mapper = {
      Calm: 'Calm',
      Pumped: 'Energizing',
      Groovy: 'Energizing',
      Upbeat: 'Energizing',
      Night: 'Energizing',
      Extreme: 'Energizing',
      Motivation: 'Energizing',
      Happy: 'Joyful',
      Optimistic: 'Joyful',
      Sad: 'Sad',
      Sentimental: 'Sad',
      Serious: 'Tense',
      Dramatic: 'Tense',
      Beautiful: 'Beautiful',
      Peaceful: 'Beautiful',
      Friends: 'Beautiful',
      Gentle: 'Beautiful',
      Romantic: 'Erotic',
      Dreamy: 'Dreamy',
      Epic: 'Heroic',
      Spooky: 'Scary'
    };
    return mapper[mood] || MUBERT_FALLBACK_MOOD;
  }

  markByIntensity(arr: Array<any>): Array<any> {
    let _moodChannelCounter = 0;
    for (let i = 0; i < arr.length; i += 1) {
      const current = arr[i];
      const before = arr[i - 1];
      if (!before || before.intensity !== current.intensity) _moodChannelCounter += 1;
      arr[i].moodChannel = _moodChannelCounter;
    }
    return arr;
  }

  groupByIntensity(arr: Array<any>): Array<any> {
    const moodChannels = [];
    let moodChannelCounter = 1;
    let _moodChannels = [];
    for (let i = 0; i < arr.length; i += 1) {
      if (arr[i].moodChannel === moodChannelCounter) {
        _moodChannels.push(arr[i]);
      } else {
        moodChannels.push(_moodChannels);
        _moodChannels = [arr[i]];
        moodChannelCounter += 1;
      }
    }
    moodChannels.push(_moodChannels);
    return moodChannels;
  }

  calculateMubertOptions(arr: Array<any>): Array<any> {
    // PROCESSING intensity
    for (let i = 0; i < arr.length; i += 1) {
      const before = arr[i - 1];
      const current = arr[i];
      const after = arr[i + 1];
      arr[i].intensity =
        !!before && !!after && before.intensity === after.intensity && before.intensity !== current.intensity
          ? before.intensity
          : current.intensity;
    }
    for (let i = 0; i < arr.length; i += 1) {
      const current = arr[i];
      const before = arr[i - 1];
      const beforeSeq = this.getIntensitySeq(before, arr, i, MUBERT_BEFORE);
      const after = arr[i + 1];
      const afterSeq = this.getIntensitySeq(after, arr, i, MUBERT_AFTER);
      arr[i].intensity =
        beforeSeq < 2 && afterSeq < 2 ? current.intensity : beforeSeq > afterSeq ? before.intensity : after.intensity;
    }
    // PROCESSING MOOD
    // marking elements by intensity groups
    arr = this.markByIntensity(arr);

    // making arrays of elements by groups
    const moodChannels = this.groupByIntensity(arr);

    // normalizing moods
    for (let i = 0; i < moodChannels.length; i += 1) {
      const counts = [
        ...moodChannels[i]
          .reduce((acc, o) => {
            if (!acc.has(o.mood)) acc.set(o.mood, {mood: o.mood, count: 0});
            acc.get(o.mood).count += 1;
            return acc;
          }, new Map())
          .values()
      ];
      const dominant = counts.reduce((acc, current) => (acc.count > current.count ? acc : current));
      moodChannels[i].map(o => {
        o.mood = dominant.count !== 1 ? dominant.mood : MUBERT_FALLBACK_MOOD;
        // delete o.moodChannel;
        return o;
      });
    }
    arr = moodChannels.reduce((acc, o) => {
      acc.push(...o);
      return acc;
    }, []);
    // adding parent mood and category
    for (let i = 0; i < arr.length; i += 1) {
      arr[i].parentMood = this.getParentMood(arr[i].mood);
      arr[i].category = MUBERT_TASK_CATEGORY_MOODS;
    }
    return arr;
  }

  buildIntensityMoodQuestion(sentence: string): string {
    const samples = [
      [
        `Q: Text: "fail is because they make us worry about"`,
        `[Mood options]: Calm, Pumped, Groovy, Upbeat, Night, Extreme, Motivation, Happy, Optimistic, Sad, Sentimental, Serious, Dramatic, Beautiful, Peaceful, Friends, Gentle, Dreamy, Romantic, Epic, Spooky`,
        `[Intensity Options]: Low, Medium, High`,
        `Define one mood from [Mood options] and one intensity from [Intensity Options]`,
        `A: ["Serious", "Low"]`
      ],
      [
        `Q: Text: "western food… By eating the Foods God"`,
        `[Mood options]: Calm, Pumped, Groovy, Upbeat, Night, Extreme, Motivation, Happy, Optimistic, Sad, Sentimental, Serious, Dramatic, Beautiful, Peaceful, Friends, Gentle, Dreamy, Romantic, Epic, Spooky`,
        `[Intensity Options]: Low, Medium, High`,
        `Define one mood from [Mood options] and one intensity from [Intensity Options]`,
        `A: ["Motivation", "Medium"]`
      ],
      [
        `Q: Text: "Yes, it's true! The Disciples Way won’t"`,
        `[Mood options]: Calm, Pumped, Groovy, Upbeat, Night, Extreme, Motivation, Happy, Optimistic, Sad, Sentimental, Serious, Dramatic, Beautiful, Peaceful, Friends, Gentle, Dreamy, Romantic, Epic, Spooky`,
        `[Intensity Options]: Low, Medium, High`,
        `Define one mood from [Mood options] and one intensity from [Intensity Options]`,
        `A: ["Optimistic", "High"]`
      ]
    ]
      .map(qna => qna.join('\n'))
      .join('\n\n');

    return `${samples}\n\nQ: Text: "${sentence}"\n[Mood options]: Calm, Pumped, Groovy, Upbeat, Night, Extreme, Motivation, Happy, Optimistic, Sad, Sentimental, Serious, Dramatic, Beautiful, Peaceful, Friends, Gentle, Dreamy, Romantic, Epic, Spooky\n[Intensity Options]: Low, Medium, High\nDefine one mood from [Mood options] and one intensity from [Intensity Options]\n`;
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

  getMubertPlaylist(group: string, channel: string): string {
    const mapper = [
      {group: 'Calm', channel: 'Calm', playlist: '0.0.0'},
      {group: 'Calm', channel: 'Acoustic', playlist: '0.0.1'},
      {group: 'Energizing', channel: 'Pumped', playlist: '0.1.0'},
      {group: 'Energizing', channel: 'Groovy', playlist: '0.1.1'},
      {group: 'Energizing', channel: 'Upbeat', playlist: '0.1.2'},
      {group: 'Energizing', channel: 'Night', playlist: '0.1.3'},
      {group: 'Energizing', channel: 'Extreme', playlist: '0.1.4'},
      {group: 'Energizing', channel: 'Motivation', playlist: '0.1.5'},
      {group: 'Joyful', channel: 'Happy', playlist: '0.2.0'},
      {group: 'Joyful', channel: 'Optimistic', playlist: '0.2.1'},
      {group: 'Sad', channel: 'Sad', playlist: '0.3.0'},
      {group: 'Sad', channel: 'Sentimental', playlist: '0.3.1'},
      {group: 'Tense', channel: 'Serious', playlist: '0.4.0'},
      {group: 'Tense', channel: 'Dramatic', playlist: '0.4.1'},
      {group: 'Beautiful', channel: 'Beautiful', playlist: '0.5.0'},
      {group: 'Beautiful', channel: 'Peaceful', playlist: '0.5.1'},
      {group: 'Beautiful', channel: 'Friends', playlist: '0.5.2'},
      {group: 'Beautiful', channel: 'Gentle', playlist: '0.5.3'},
      {group: 'Erotic', channel: 'Romantic', playlist: '0.6.0'},
      {group: 'Dreamy', channel: 'Dreamy', playlist: '0.7.0'},
      {group: 'Heroic', channel: 'Epic', playlist: '0.8.0'},
      {group: 'Scary', channel: 'Spooky', playlist: '0.10.0'}
    ];
    const final = mapper.find(
      m => m.group.toLowerCase() === group.toLowerCase() && m.channel.toLowerCase() === channel.toLowerCase()
    );
    return final ? final.playlist : mapper[0].playlist;
  }

  async getMubertPat(): Promise<any> {
    const result: AxiosResponse<any> = await this.httpService
      .post(`${process.env.MUBERT_API_URL}/${MUBERT_METHOD_GET_SERVICE_ACCESS}`, {
        method: MUBERT_METHOD_GET_SERVICE_ACCESS,
        params: {
          email: process.env.MUBERT_EMAIL,
          license: process.env.MUBERT_LICENSE,
          token: process.env.MUBERT_ACCESS_KEY
        }
      })
      .toPromise();
    return result.data.data.pat;
  }

  async submitMubertJob(params: any): Promise<any> {
    const result: AxiosResponse<any> = await this.httpService
      .post(`${process.env.MUBERT_API_URL}/${MUBERT_METHOD_RECORD_TRACK}`, {
        method: MUBERT_METHOD_RECORD_TRACK,
        params
      })
      .toPromise();
    return result.data.data?.tasks;
  }

  async getMubertJobs(pat: string): Promise<any> {
    const result: AxiosResponse<any> = await this.httpService
      .post(`${process.env.MUBERT_API_URL}/${MUBERT_METHOD_TRACK_STATUS}`, {
        method: MUBERT_METHOD_TRACK_STATUS,
        params: {pat}
      })
      .toPromise();
    return result.data.data?.tasks;
  }

  removeArrayElement(arr: Array<string>, targetValue: string): Array<string> {
    const index = arr.indexOf(targetValue);
    if (index !== -1) arr.splice(index, 1);
    return arr;
  }

  async timeout(ms: number): Promise<any> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async pollMubertJobsResults(_mubertJobs: Array<string>, mubertPat: string, interval: number): Promise<any> {
    let mubertJobs = [..._mubertJobs];
    const generatedAudios = [];
    return new Promise((resolve, reject) => {
      const poller = setInterval(async () => {
        if (mubertJobs.length === 0) {
          clearInterval(poller);
          return resolve(generatedAudios);
        }
        const mubertJobsResults = await this.getMubertJobs(mubertPat);
        for (const mubertJobResult of mubertJobsResults) {
          if (
            mubertJobs.includes(mubertJobResult[MUBERT_TASK_ID]) &&
            mubertJobResult[MUBERT_TASK_STATUS_TEXT] === MUBERT_TASK_STATUS_DONE
          ) {
            generatedAudios.push(mubertJobResult[MUBERT_TASK_DOWNLOAD_LINK]);
            mubertJobs = this.removeArrayElement(mubertJobs, mubertJobResult[MUBERT_TASK_ID]);
          }
        }
      }, interval);
    });
  }

  async downloadAndSaveAudio(audioUrl: string, tempDir: string): Promise<any> {
    return new Promise(async (resolve, reject) => {
      const fileName = new URL(audioUrl).pathname.slice(1);
      const filePath = `${tempDir}/${fileName}`;
      const writer = fs.createWriteStream(filePath);
      this.logger.log(`[Downloading...] ${audioUrl}`);
      let response: AxiosResponse;

      let retryCounter = 0;
      let isSucceed = false;
      do {
        try {
          await this.timeout(+process.env.MUBERT_DOWNLOAD_RETRY_INTERVAL);
          response = await this.httpService.get(audioUrl, {responseType: 'stream'}).toPromise();
          isSucceed = true;
        } catch (e) {
          if (e.response && e.response.status === 404) {
            if (retryCounter >= +process.env.MUBERT_DOWNLOAD_RETRY_MAX_COUNT) throw new Error(e);
            this.logger.warn(`[Got 404 error. Retrying to download...] ${audioUrl}`);
            retryCounter += 1;
          } else {
            throw new Error(e);
          }
        }
      } while (isSucceed === false);

      response.data.pipe(writer);
      writer.on('finish', () => resolve(filePath));
      writer.on('error', reject);
    });
  }

  async downloadMubertAudios(mubertAudioUrls: Array<string>, tempDir: string): Promise<any> {
    const audioFilesPaths = [];
    for (const audioUrl of mubertAudioUrls) {
      const filePath = await this.downloadAndSaveAudio(audioUrl, tempDir);
      audioFilesPaths.push(filePath);
    }
    return audioFilesPaths;
  }

  async mergeAudios(audioFilesPaths: Array<string>, fileName: string, tempDir: string): Promise<string> {
    return new Promise((resolve: (value: string) => any, reject) => {
      const big = ffmpeg();
      for (const p of audioFilesPaths) big.mergeAdd(p);
      const mergedFilePath = `${tempDir}/merged-${fileName}.wav`;
      return big
        .mergeToFile(mergedFilePath, `${tempDir}`)
        .on('end', async () => resolve(mergedFilePath))
        .on('error', e => reject(e));
    }).catch(err => {
      throw err;
    });
  }

  async prepareMoodsAndIntensities(jobData: JobData): Promise<any> {
    const calculatedOptions = [];
    for (let i = 0; i < jobData.rows.length; i += 1) {
      const row = jobData.rows[i];
      // this.logger.debug(`${i + 1}/${jobData.rows.length} Processing <${row.text}>`);
      const question = this.buildIntensityMoodQuestion(row.text);
      const answer = await this.askOpenAI(question);
      const [mood, intensity] = (() => {
        try {
          return JSON.parse(answer.choices[0].text.split(OPENAI_INTENSITY_ANSWER_SEPARATOR)[1]);
        } catch (e) {
          return [MUBERT_FALLBACK_MOOD, MUBERT_FALLBACK_INTENSITY];
        }
      })();
      const opts = {
        text: row.text,
        duration: +row.endTime - +row.startTime,
        intensity,
        mood
      };
      calculatedOptions.push(opts);
    }
    return calculatedOptions;
  }

  async sendMubertJobs(mubertOptionsArr: Array<any>): Promise<any> {
    const mubertJobs = [];
    for (const params of mubertOptionsArr) {
      const mubertJob = await this.submitMubertJob(params);
      mubertJobs.push(...mubertJob.map(j => j[MUBERT_TASK_ID]));
    }
    return mubertJobs;
  }

  prepareMubertRequests(intensityGroups: Array<any>, mubertPat: string): Array<any> {
    const mubertOptionsArr = [];
    for (const group of intensityGroups) {
      const duration = Math.ceil(
        group.reduce((acc, g) => {
          acc += +g.duration;
          return acc;
        }, 0) / 1000
      );
      const mubertOpts = {
        pat: mubertPat,
        duration,
        intensity: group[0].intensity.toLowerCase(),
        playlist: this.getMubertPlaylist(group[0].parentMood, group[0].mood),
        format: 'wav',
        mode: 'track'
      };
      mubertOptionsArr.push(mubertOpts);
      return mubertOptionsArr;
    }
  }
}
