import {v4} from 'uuid';
import {execFFmpeg} from './ffmpeg.helper';
import * as ffprobe from 'ffprobe-client';

/**
 *
 * @param filePath video file path to be resized
 * @param width width for the resized video
 * @param height height for the resized video
 * @param output output folder path
 */
export async function resizeVideo(filePath: string, width: number, height: number, outPath: string): Promise<string> {
  await execFFmpeg(`ffmpeg -loglevel quiet -i ${filePath} -vf scale=${width}:${height} ${outPath}`);
  return outPath;
}

/**
 * Check video duration with ffprobe
 * @param filePath
 * @return Promise<number> duration in ms
 */
export async function getVideoAudioDuration(filePath: string): Promise<number> {
  const data = await ffprobe(filePath);
  return +data.format.duration;
}
