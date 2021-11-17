import {Injectable, Logger} from '@nestjs/common';

import {v4} from 'uuid';
import {basename} from 'path';

import {
  getVideoSize,
  getImageSize,
  writeText,
  resizeImage,
  formatTimestamp,
  escapeDrawText,
  loadFontFromFile,
  text2lines
} from './video-render.helper';
import {execFFmpeg} from '../shared/helpers/ffmpeg.helper';

@Injectable()
export class VideoRenderService {

  private readonly logger = new Logger(VideoRenderService.name);

  /**
   * check ffmpeg if it's installed
   */
  async checkFFmpegVersion() {
    try {
      await execFFmpeg('ffmpeg -version');
      return 'FFmpeg is working';
    } catch (e) {
      return 'FFmpeg is not available';
    }
  }

  /**
   * cut clip out from the specific video
   * @param filePath
   * @param start
   * @param end
   * @param output
   * @param videoWidth
   * @param videoHeight
   */
  async cutClip(filePath: string, start: number, end: number, videoWidth: number, videoHeight: number, output: string) {
    const generateScale = (width, height) => `scale=${width}:${height}`;
    const generateCrop = (width, height) =>
      `crop=${videoWidth}:${videoHeight}:${(width - videoWidth) / 2}:${(height - videoHeight) / 2}`;

    const dimension = await getVideoSize(filePath);
    const outPath = `${output}/${v4()}.ts`;
    const ratio = Math.max(videoWidth / dimension.width, videoHeight / dimension.height);
    const width = dimension.width * ratio;
    const height = dimension.height * ratio;
    await execFFmpeg(
      `ffmpeg -loglevel error -i ${filePath} -vf "[in]${generateScale(width, height)}[v0];[v0]${generateCrop(
        width,
        height
      )}[out]" -ss ${formatTimestamp(start)} -t ${formatTimestamp(
        end - start
      )} -c:v libx264 -bsf:v h264_mp4toannexb -an -f mpegts ${outPath}`
    );
    return outPath;
  }

  /**
   * merge all clips into one video
   * @param {array} filePaths
   * @param {string} output
   */
  async mergeClips(filePaths: Array<string>, output: string): Promise<string> {
    const outPath = `${output}/${v4()}.mp4`;
    const combinePath = `${output}/${v4()}.txt`;
    writeText(combinePath, filePaths.map(filePath => `file ${basename(filePath)}`).join('\r\n'));
    await execFFmpeg(
      `ffmpeg -loglevel error -f concat -safe 0 -i ${combinePath} -c copy -bsf:a aac_adtstoasc ${outPath}`
    );
    return outPath;
  }

  // TODO: Refactor: merge overlayGuarantee & overlayProduct to one method
  /**
   * add guarantee image on the video
   * @param videoPath
   * @param imagePath
   * @param startTime
   * @param endTime
   * @param output
   * @param videoWidth
   * @param videoHeight
   * @param imageWidth
   * @param imageHeight
   * @param marginTop
   */
  async overlayGuarantee(
    videoPath: string,
    imagePath: string,
    startTime: number,
    endTime: number,
    videoWidth: number,
    videoHeight: number,
    imageWidth: number,
    imageHeight: number,
    marginTop: number,
    output: string
  ): Promise<string> {

    const generateOverlay = (x, y) => `overlay=${x}:${y}:shortest=1`;
    const generateFade = (start, end) => {
      const startFade = (start - 0.2) > 0 ? start - 0.2 : 0;
      return `format=rgba,fade=in:st=${startFade}:d=0.2:alpha=1,fade=out:st=${end}:d=0.2:alpha=1`;
    }

    const dimension = await getImageSize(imagePath);
    const outPath = `${output}/${v4()}.mp4`;
    const ratio = Math.min(imageWidth / dimension.width, imageHeight / dimension.height);
    const width = Math.floor(dimension.width * ratio);
    const height = Math.floor(dimension.height * ratio);
    const resizedImagePath = await resizeImage(imagePath, output, {width, height});
    await execFFmpeg(
      `ffmpeg -loglevel error -i ${videoPath} -loop 1 -i ${resizedImagePath} -filter_complex "[1]${generateFade(
        startTime / 1000.0,
        endTime / 1000.0
      )}[v1];[0][v1]${generateOverlay(
        (videoWidth - width) / 2,
        (videoHeight - height) / 2 + marginTop
      )}" -c:v libx264 ${outPath}`
    );
    return outPath;
  }

  /**
   * add product image on the video
   * @param videoPath
   * @param imagePath
   * @param startTime
   * @param endTime
   * @param output
   * @param videoWidth
   * @param videoHeight
   * @param imageWidth
   * @param imageHeight
   * @param marginTop
   */
  async overlayProduct(
    videoPath: string,
    imagePath: string,
    startTime: number,
    endTime: number,
    videoWidth: number,
    videoHeight: number,
    imageWidth: number,
    imageHeight: number,
    marginTop: number,
    output: string
  ) {

    this.logger.debug('=====overlayProduct');
    this.logger.debug(startTime, '=====startTime');
    this.logger.debug(endTime, '=====endTime');

    const generateOverlay = (x, y) => `overlay=${x}:${y}:shortest=1`;

    const generateFade = (start, end) => {
      const startFade = (start - 0.2) > 0 ? start - 0.2 : 0;
      return `format=rgba,fade=in:st=${startFade}:d=0.2:alpha=1,fade=out:st=${end}:d=0.2:alpha=1`;
    }

    const dimension = await getImageSize(imagePath);
    const outPath = `${output}/${v4()}.mp4`;
    const ratio = Math.min(imageWidth / dimension.width, imageHeight / dimension.height);

    const width = Math.floor(dimension.width * ratio);
    const height = Math.floor(dimension.height * ratio);


    const resizedImagePath = await resizeImage(imagePath, output, {width, height});

    await execFFmpeg(
      `ffmpeg -loglevel error -i ${videoPath} -loop 1 -i ${resizedImagePath} -filter_complex "[1]${generateFade(
        startTime / 1000.0,
        endTime / 1000.0
      )}[v1];[0][v1]${generateOverlay(
        (videoWidth - width) / 2,
        (videoHeight - height) / 2 + marginTop
      )}" -c:v libx264 ${outPath}`
    );
    return outPath;
  }

  /**
   * break all overlapped disclaimers v2
   * @param disclaimers
   */
  breakDisclaimers(disclaimers: Array<any>) {
    const timeKeys = {};
    disclaimers.map(disclaimer => {
      if (!timeKeys.hasOwnProperty(disclaimer.startTime)) timeKeys[disclaimer.startTime] = 1;
      if (!timeKeys.hasOwnProperty(disclaimer.endTime)) timeKeys[disclaimer.endTime] = 1;
    });
    const times = Object.keys(timeKeys)
      .map(a => +a)
      .sort((a, b) => a - b);

    const result = [];
    for (let i = 0; i < times.length - 1; i++) {
      const startTime = times[i];
      const endTime = times[i + 1];
      const lines = disclaimers.reduce((lines, disclaimer) => {
        if (disclaimer.startTime <= startTime && disclaimer.endTime >= endTime) lines = lines.concat(disclaimer.lines);
        return lines;
      }, []);
      if (!lines.length) continue;
      result.push({startTime, endTime, lines});
    }
    return result;
  }

  /**
   * preprocess disclaimers for rendering v2
   * @param disclaimers
   * @param fontFile
   * @param fontSize
   * @param maxWidth
   */
  async preprocessDisclaimers(disclaimers: Array<any>, fontFile: string, fontSize: number, maxWidth: number) {
    const font = await loadFontFromFile(fontFile);

    disclaimers.map(disclaimer => {
      disclaimer.lines = text2lines(font, disclaimer.text, fontSize, maxWidth);
    });

    disclaimers = this.breakDisclaimers(disclaimers);

    return disclaimers;
  }

  /**
   * add disclaimers on the video v2
   * @param filePath
   * @param disclaimers
   * @param fontFile
   * @param fontSize
   * @param marginTop
   * @param marginRight
   * @param output
   */
  async addDisclaimers(
    filePath: string,
    disclaimers: Array<any>,
    fontFile: string,
    fontSize: number,
    marginTop: number,
    marginRight: number,
    output: string
  ) {
    const generateDrawText = (disclaimers, fontFile, fontSize, top, right) => {
      let drawText = '';
      disclaimers.map(disclaimer => {
        for (let i = 0; i < disclaimer.lines.length; i++) {
          drawText += `drawtext=fontfile=${fontFile}:text='${escapeDrawText(
            disclaimer.lines[i]
          )}':fontcolor=black:fontsize=${fontSize}:x=w-text_w-${right}:y=${top +
            (fontSize + 10) * i}:bordercolor=white@0.5:borderw=1:enable='between(t,${disclaimer.startTime /
            1000.0},${disclaimer.endTime / 1000.0})'`;
          if (i != disclaimer.lines.length - 1) drawText += ',';
        }
      });
      drawText = drawText.slice(0, -1);
      return drawText;
    };

    const outPath = `${output}/${v4()}.mp4`;
    const filterComplexScriptPath = `${output}/${v4()}.txt`;
    writeText(
      filterComplexScriptPath,
      `[0]${generateDrawText(disclaimers, fontFile, fontSize, marginTop, marginRight)}`
    );
    await execFFmpeg(
      `ffmpeg -loglevel error -i ${filePath} -filter_complex_script ${filterComplexScriptPath} -c:v libx264 ${outPath}`
    );
    return outPath;
  }

  /**
   * break all overlapped citations v2
   * @param citations
   */
  breakCitations(citations: Array<any>) {
    const timeKeys = {};
    citations.map(citation => {
      if (!timeKeys.hasOwnProperty(citation.startTime)) timeKeys[citation.startTime] = 1;
      if (!timeKeys.hasOwnProperty(citation.endTime)) timeKeys[citation.endTime] = 1;
    });
    const times = Object.keys(timeKeys)
      .map(a => +a)
      .sort((a, b) => a - b);

    const result = [];
    for (let i = 0; i < times.length - 1; i++) {
      const startTime = times[i];
      const endTime = times[i + 1];
      const lines = citations.reduce((lines, citation) => {
        if (citation.startTime <= startTime && citation.endTime >= endTime) lines = lines.concat(citation.lines);
        return lines;
      }, []);
      if (!lines.length) continue;
      result.push({startTime, endTime, lines});
    }
    return result;
  }

  /**
   * preprocess citations for rendering v2
   * @param citations
   * @param fontFile
   * @param fontSize
   * @param maxWidth
   */
  async preprocessCitations(citations: Array<any>, fontFile: string, fontSize: number, maxWidth: number) {
    const font = await loadFontFromFile(fontFile);

    citations.map(citation => {
      citation.lines = text2lines(font, citation.text, fontSize, maxWidth);
    });

    citations = this.breakCitations(citations);

    return citations;
  }

  /**
   * add citations on the video v2
   * @param filePath
   * @param citations
   * @param fontFile
   * @param fontSize
   * @param marginTop
   * @param marginLeft
   * @param output
   */
  async addCitations(
    filePath: string,
    citations: Array<any>,
    fontFile: string,
    fontSize: number,
    videoHeight: number,
    marginBottom: number,
    marginLeft: number,
    output: string
  ) {
    const generateDrawText = (citations, fontFile, fontSize, top, left) => {
      let drawText = '';
      citations.map(citation => {
        for (let i = 0; i < citation.lines.length; i++) {
          drawText += `drawtext=fontfile=${fontFile}:text='${escapeDrawText(
            citation.lines[i]
          )}':fontcolor=black@0.8:fontsize=${fontSize}:x=${left}:y=${top -
            (fontSize + 6) *
              (citation.lines.length - 1 - i)}:bordercolor=white@0.5:borderw=1:enable='between(t,${citation.startTime /
            1000.0},${citation.endTime / 1000.0})',`;
        }
      });
      drawText = drawText.slice(0, -1);
      return drawText;
    };

    const outPath = `${output}/${v4()}.mp4`;
    const filterComplexScriptPath = `${output}/${v4()}.txt`;
    writeText(
      filterComplexScriptPath,
      `[0]${generateDrawText(citations, fontFile, fontSize, videoHeight - marginBottom, marginLeft)}`
    );
    await execFFmpeg(
      `ffmpeg -loglevel error -i ${filePath} -filter_complex_script ${filterComplexScriptPath} -c:v libx264 ${outPath}`
    );
    return outPath;
  }

  /**
   * break subtitles for overlapping citations v2
   * @param subtitles
   * @param citations
   * @param fontSizeOfCitation
   */
  breakSubtitlesbyCitations(subtitles: Array<any>, citations: Array<any>, fontSizeOfCitation: number) {
    const timeKeys = {};
    subtitles.map(subtitle => {
      if (!timeKeys.hasOwnProperty(subtitle.startTime)) timeKeys[subtitle.startTime] = 1;
      if (!timeKeys.hasOwnProperty(subtitle.endTime)) timeKeys[subtitle.endTime] = 1;
    });
    citations
      .filter(citation => citation.lines.length > 1)
      .map(citation => {
        if (!timeKeys.hasOwnProperty(citation.startTime)) timeKeys[citation.startTime] = 1;
        if (!timeKeys.hasOwnProperty(citation.endTime)) timeKeys[citation.endTime] = 1;
      });
    const times = Object.keys(timeKeys)
      .map(a => +a)
      .sort((a, b) => a - b);

    const result = [];
    for (let i = 0; i < times.length - 1; i++) {
      const startTime = times[i];
      const endTime = times[i + 1];
      const matchedSubtitle = subtitles.find(
        subtitle => subtitle.startTime <= startTime && subtitle.endTime >= endTime
      );
      if (!matchedSubtitle) continue;
      const text = matchedSubtitle.text;
      const overlappedCitation = citations.find(
        citation => citation.startTime <= startTime && citation.endTime >= endTime
      );
      const offset =
        overlappedCitation && overlappedCitation.lines.length > 1
          ? (overlappedCitation.lines.length - 1) * fontSizeOfCitation
          : 0;
      result.push({startTime, endTime, text, offset});
    }
    return result;
  }

  /**
   * preprocess subtitles for rendering v2
   * @param rows
   * @param citations
   * @param fontSize
   */
  preprocessSubtitles(rows: Array<any>, citations: Array<any>, fontSize: number) {
    return this.breakSubtitlesbyCitations(rows, citations, fontSize);
  }

  /**
   * add subtitles on the video v2
   * @param filePath
   * @param subtitles
   * @param fontFile
   * @param fontSize
   * @param marginTop
   * @param output
   */
  async addSubtitles(
    filePath: string,
    subtitles: Array<any>,
    fontFile: string,
    fontSize: number,
    videoHeight: number,
    marginBottom: number,
    output: string
  ) {
    const generateDrawText = (subtitles, fontFile, fontSize, top) => {
      let drawText = '';
      subtitles.map(subtitle => {
        drawText += `drawtext=fontfile=${fontFile}:text='${escapeDrawText(
          subtitle.text
        )}':fontcolor=white:fontsize=${fontSize}:x=(w-text_w)/2:y=${top -
          subtitle.offset}:box=1:boxborderw=8:boxcolor=black@0.8:shadowcolor=gray@0.4:shadowx=2:shadowy=2:enable='between(t,${subtitle.startTime /
          1000.0},${subtitle.endTime / 1000.0})',`;
      });
      drawText = drawText.slice(0, -1);
      return drawText;
    };

    const outPath = `${output}/${v4()}.mp4`;
    const filterComplexScriptPath = `${output}/${v4()}.txt`;
    writeText(
      filterComplexScriptPath,
      `[0]${generateDrawText(subtitles, fontFile, fontSize, videoHeight - marginBottom)}`
    );
    await execFFmpeg(
      `ffmpeg -loglevel error -i ${filePath} -filter_complex_script ${filterComplexScriptPath} -c:v libx264 ${outPath}`
    );
    return outPath;
  }

  /**
   * add background music and speech on the video
   * @param videoPath
   * @param speechAudioFile
   * @param speechAudioVolume
   * @param output
   */
  async addMusic(
    videoPath: string,
    speechAudioFile: string,
    speechAudioVolume: number,
    output: string
  ) {
    const outPath = `${output}/${v4()}.mp4`;

    //TODO: add background music for each sentence
    await execFFmpeg(
        `ffmpeg -loglevel quiet -i ${videoPath} -i ${speechAudioFile} -filter_complex "[1:a]volume=${speechAudioVolume}[a1];[a1]apad" -c:v copy -c:a aac -shortest ${outPath}`
    );

    // if (backgroundAudioFile) {
    //   await execFFmpeg(
    //     `ffmpeg -loglevel error -i ${videoPath} -i ${backgroundAudioFile} -i ${speechAudioFile} -filter_complex "[1:a]volume=${backgroundAudioVolume}[a1];[2:a]volume=${speechAudioVolume}[a2];[a1][a2]amix=inputs=2:duration=longest[a]" -map 0:v -map "[a]" -c:v copy -c:a aac -shortest ${outPath}`
    //   );
    // } else {
    //   // TODO without background music
    //   await execFFmpeg(
    //     `ffmpeg -loglevel error -i ${videoPath} -i ${speechAudioFile} -filter_complex "[1:a]volume=${speechAudioVolume}[a1];[a1]apad" -c:v copy -c:a aac -shortest ${outPath}`
    //   );
    // }
    return outPath;
  }
}
