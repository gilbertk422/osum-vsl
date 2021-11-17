import {Injectable, Logger} from '@nestjs/common';
import * as Speech from '@google-cloud/text-to-speech';
import {verifyAndFix} from 'ssml-check-core';
import SSMLSplit from 'ssml-split';
import * as ffmpeg from 'fluent-ffmpeg';
import {
  SSML_SPLIT_SOFTLIMIT,
  SSML_SPLIT_HARDLIMIT,
  GOOGLETTS_LANGUAGE_CODE,
  GOOGLETTS_NAME,
  GOOGLETTS_SSML_GENDER_FEMALE,
  GOOGLETTS_SSML_GENDER_MALE,
  GOOGLETTS_AUDIO_ENCODING
} from './google-tts.constant';

@Injectable()
export class GoogleTtsService {
  private readonly logger = new Logger(GoogleTtsService.name);
  private ssmlSplit: SSMLSplit;

  constructor() {
    this.ssmlSplit = new SSMLSplit({
      // The service you are using: "google" or "aws"
      synthesizer: 'google',
      // Finds a possible split moment starting from 4000 characters
      softLimit: SSML_SPLIT_SOFTLIMIT,
      // Google Text to Speech limitation
      hardLimit: SSML_SPLIT_HARDLIMIT,
      // Allow to split large paragraphs, set to false to keep your <p></p> intact
      breakParagraphsAboveHardLimit: true
    });
  }

  /**
   * get google tts voice file from SSML
   * @param ssml
   * @param voiceGender
   */
  async googleSynthesizeSpeech(ssml: string, voiceGender = GOOGLETTS_SSML_GENDER_FEMALE): Promise<any> {
    const speaker = new Speech.TextToSpeechClient();
    const [response] = await speaker.synthesizeSpeech({
      input: {ssml},
      voice: {
        languageCode: GOOGLETTS_LANGUAGE_CODE,
        name: GOOGLETTS_NAME,
        ssmlGender: voiceGender === GOOGLETTS_SSML_GENDER_MALE ? GOOGLETTS_SSML_GENDER_MALE : GOOGLETTS_SSML_GENDER_FEMALE
      },
      audioConfig: {audioEncoding: GOOGLETTS_AUDIO_ENCODING}
    });
    return response;
  }

  /**
   * Verify and fix SSML
   * @param ssml
   */
  async verifyAndFix(ssml: string): Promise<string> {
    let result = await verifyAndFix(ssml, {platform: 'google'});

    if (result.fixedSSML) {
      return result.fixedSSML;
    } else if (result.errors) {
      this.logger.error(result.errors);
      throw 'ssml verifyAndFix error';
    } else {
      return ssml;
    }
  }

  /**
   * Split ssml into batches
   * @param ssml
   */
  splitSSML(ssml: string): Array<string> {
    return this.ssmlSplit.split(ssml);
  }

  async mergeAudios(audioFilesPaths: Array<string>, fileName: string, tempDir: string): Promise<string> {
    return new Promise((resolve: (value: string) => any, reject) => {
      const big = ffmpeg();
      for (const p of audioFilesPaths) big.mergeAdd(p);
      const mergedFilePath: string = `${tempDir}/merged-${fileName}.wav`;
      return big
        .mergeToFile(mergedFilePath, `${tempDir}`)
        .on('end', async () => resolve(mergedFilePath))
        .on('error', e => reject(e));
    }).catch(err => {
      throw err;
    });
  }
}
