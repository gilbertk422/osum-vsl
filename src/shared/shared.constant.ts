import * as dotenv from 'dotenv';
dotenv.config();

export const VIDEO_EXT = 'mp4';
export const IMAGE_EXT = 'jpg';
export const MIN_IMAGE_WIDTH = 1280;
export const MIN_IMAGE_HEIGHT = 1280;
export const IMAGE_DATA_TYPE = 'image';
export const VIDEO_DATA_TYPE = 'video';
export const JOB_CANCEL_MESSAGE = 'Job has been cancelled by user.';

export const SERVICEPIPE_PROCESS = +process.env.SERVICEPIPE_PROCESS;
export const GENTLE_PROCESS = +process.env.GENTLE_PROCESS;
export const GOOGLETTS_PROCESS = +process.env.GOOGLETTS_PROCESS;
export const MEDIAPIPE_PROCESS = +process.env.MEDIAPIPE_PROCESS;
export const OPENAI_PROCESS = +process.env.OPENAI_PROCESS;
export const VIDEORENDER_PROCESS = +process.env.VIDEORENDER_PROCESS;
