import * as getDimensions from 'get-video-dimensions';
import {imageSize} from 'image-size';
import {v4} from 'uuid';
import {extname} from 'path';
import * as resizeImg from 'resize-img';
import * as fs from 'fs';
import * as getBounds from 'svg-path-bounds';
import {load as loadFont} from 'opentype.js';

import {Size} from './video-render-profile.interface';

/**
 * get width, height of the video
 * @param filePath string
 */
export async function getVideoSize(filePath): Promise<Size> {
  return await getDimensions(filePath);
}

/**
 * get width, height of the image
 * @param filePath string
 */
export async function getImageSize(filePath): Promise<Size> {
  return await imageSize(filePath);
}

/**
 * resize image by given width, height
 * @param filePath string
 * @param output string
 * @param size Size
 */
export async function resizeImage(filePath, output, size: Size): Promise<string> {
  const resizedImagePath = `${output}/${v4()}${extname(filePath)}`;
  const image = await resizeImg(fs.readFileSync(filePath), size);
  fs.writeFileSync(resizedImagePath, image);
  return resizedImagePath;
}

/**
 * save content to text file
 * @param output string
 * @param content string
 */
export function writeText(outPath, content) {
  return fs.writeFileSync(`${outPath}`, content);
}

/**
 * get bounding rectangle for text and fontsize
 * @param font Font
 * @param text string
 * @param fontSize number
 */
export function getBoundingRect(font, text, fontSize) {
  const path = font.getPath(text, 0, 0, fontSize);
  const [left, top, right, bottom] = getBounds(path.toPathData());
  return {
    width: Math.floor(right - left),
    height: Math.floor(bottom - top)
  };
}

/**
 * convert milliseconds to readable timeformat for ffmpeg
 * @param milliseconds number
 */
export function formatTimestamp(milliseconds: number) {
  const convert2digits = x => (x < 10 ? `0${x}` : x);
  const convert2int = x => (x.toString().includes('.') ? convert2int(x * 10) : x);
  const xx = convert2int(milliseconds % 1000);
  const ss = convert2digits(Math.floor(milliseconds / 1000) % 60);
  const mm = convert2digits(Math.floor(milliseconds / 1000 / 60) % 60);
  const hh = convert2digits(Math.floor(milliseconds / 1000 / 60 / 60));
  return `${hh}:${mm}:${ss}.${xx}`;
}

/**
 * escape special characters for ffmpeg filter_complex
 * @param text string
 */
export function escapeDrawText(text) {
  text = text
    .replace(new RegExp("'", 'g'), '’')
    .replace(new RegExp('"', 'g'), '”')
    .replace(new RegExp('%', 'g'), '\\\\\\%')
    .replace(new RegExp(':', 'g'), '\\\\\\:');
  return text;
}

/**
 * load font from the font file
 * @param fontFile string
 */
export function loadFontFromFile(fontFile) {
  return new Promise(resolve => {
    loadFont(fontFile, (e, font) => {
      resolve(font);
    });
  });
}

/**
 * split lines from the text using font and font size to adjust max-width
 * @param font Font
 * @param text string
 * @param fontSize number
 * @param maxWidth number
 */
export function text2lines(font, text, fontSize, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  var line = '';
  for (const word of words) {
    line += word;
    if (this.getBoundingRect(font, line, fontSize).width > maxWidth) {
      lines.push(line.trim());
      line = '';
    } else {
      line += ' ';
    }
  }
  line != '' ? lines.push(line.trim()) : 0;
  return lines;
}

export function isValid(value) {
  return value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0);
}

// /**
//  * TODO: based on sample JSON
//  * @param data
//  */
// export function parseJson(data): VideoRenderJson {
//   const {rows, disclaimers, citations, images} = data;
//   return {
//     rows,
//     disclaimers,
//     citations,
//     images,
//     speechAudio: {
//       audioUrl: data.ttsWavFileUrl ? data.ttsWavFileUrl : '',
//       startTime: 0,
//       endTime: 0
//     } as Audio,
//     backgroundAudio: {
//       audioUrl: data.musicFileUrl ? data.musicFileUrl : '',
//       startTime: 0,
//       endTime: 0
//     } as Audio
//   };
// }

export function uniqueArray(a: Array<string>): Array<string> {
  return [...new Set(a.map(o => o))];
}
