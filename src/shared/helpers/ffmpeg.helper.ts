import {exec} from './shell.helper';

/**
 *
 * @param cmd ffmpeg command
 */
export async function execFFmpeg(cmd: string) {
  console.log('ffmpeg ----->', cmd);
  const {stdout, stderr} = await exec(cmd);
  if (stderr) {
    console.log(stderr);
    throw 'FFmpeg command failed!';
  }
  return stdout;
}
