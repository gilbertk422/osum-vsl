import {Injectable, Logger} from '@nestjs/common';
import {VideoIntelligenceServiceClient, v1, protos} from '@google-cloud/video-intelligence';
import * as util from 'util';
import * as fs from 'fs';
import {VIDEO_AI_LOCATION} from './google-video-ai.constant';
import {VideoObject} from './google-video-ai.interface';
import * as FFmpeg from 'fluent-ffmpeg';
import _ = require("lodash");

@Injectable()
export class GoogleVideoAIService {
  private readonly logger = new Logger(GoogleVideoAIService.name);

  videoClient: v1.VideoIntelligenceServiceClient;

  constructor() {
    this.videoClient = new VideoIntelligenceServiceClient();
  }

  /**
   * Get Object Tracting from Google Video Intelligence
   * @param videoPath video file path
   */
  async getObjects(videoPath: string): Promise<Array<VideoObject>> {

    this.logger.debug('getObjects - building request..');

    const request: protos.google.cloud.videointelligence.v1.IAnnotateVideoRequest = {
      inputUri: `gs://${process.env.GCS_BUCKET}/${videoPath}`,
      features: [protos.google.cloud.videointelligence.v1.Feature.OBJECT_TRACKING],
      // recommended to use us-east1 for the best latency due to different types of processors used in this region and others
      locationId: VIDEO_AI_LOCATION
    };

    this.logger.debug(`getObjects - sending 'annotateVideo' request for ${videoPath}`);

    let results;

    // Detects objects in a video
    try {
      const [operation] = await this.videoClient.annotateVideo(request);
      results = await operation.promise();
      this.logger.debug('Waiting for operation to complete...');

    }
    catch (e) {

      console.log('error:', e);
      throw e;
    }

    // Gets annotations for video
    const annotations: protos.google.cloud.videointelligence.v1.IVideoAnnotationResults =
      results[0].annotationResults[0];

    const objects: protos.google.cloud.videointelligence.v1.IObjectTrackingAnnotation[] = annotations.objectAnnotations;

    // extract data from annotations
    const returnObjects: Array<VideoObject> = [];
    for (let object of objects) {
      const time = object.segment;
      returnObjects.push({
        description: object.entity.description,
        entityId: object.entity.entityId,
        startTime: +time.startTimeOffset.seconds || 0,
        endTime: +time.endTimeOffset.seconds || 0
      });
    }
    this.logger.debug(returnObjects);

    return returnObjects;
  }

  /**
   * Calculate high-activity video clip interval of objects
   * cut scene with highest activity from given footage,  make duration of this video == scene duration
   * @param objects - find objects in the video
   * @param sceneDuration - scene duration duration ( ms )
   * @param footageDuration - given footage duration (video length, ms)
   */
  getHighActivityInterval(objects: Array<VideoObject>, sceneDuration: number, footageDuration: number) {

    this.logger.debug(`..getting highest ActivityInterval.  duration: ${sceneDuration}, footageDuration: ${footageDuration}`);
    // console.log(`..getting highest ActivityInterval.  duration: ${sceneDuration}, footageDuration: ${footageDuration}`);

    if (objects.length < 0) {
      return {
        startTime: 0,
        endTime: sceneDuration
      };
    }
    // get count of objects for each second
    const activityFrames = {};
    for (const object of objects) {
      for (let i = object.startTime; i <= object.endTime; i++) {
        if (activityFrames.hasOwnProperty(i)) {
          activityFrames[i]++;
        } else {
          activityFrames[i] = 1;
        }
      }
    }

    this.logger.debug(activityFrames,'Objects per second:');
    // console.log(activityFrames,'Objects per second:');

    let maxCount = 0;
    let maxCountSeconds: Array<number> = []; //fragments with most activity

    for (let second in activityFrames) {
      if (maxCount > activityFrames[second]) continue;
      if (maxCount == activityFrames[second]) {
        maxCountSeconds.push(+second);
      } else {
        maxCount = activityFrames[second];
        maxCountSeconds = [+second];
      }
    }

    this.logger.debug(maxCount, 'maxCount');
    this.logger.debug(maxCountSeconds, 'maxCountSeconds');

    const randomIndex = Math.floor(Math.random() * Math.floor(maxCountSeconds.length - 1));
    const usefulSecond = maxCountSeconds[randomIndex];
    if (usefulSecond - sceneDuration / 2 < 0) {
      return {
        startTime: 0,
        endTime: sceneDuration
      };
    }
    if (usefulSecond + sceneDuration / 2 > footageDuration) {
      return {
        startTime: footageDuration - sceneDuration,
        endTime: footageDuration
      };
    }

    return {
      startTime: usefulSecond - sceneDuration / 2,
      endTime: usefulSecond + sceneDuration / 2
    };
  }

  /**
   * get clip video of original one
   * @param inputPath
   * @param outputPath
   * @param startTime
   * @param endTime
   * @return path to processed video
   */
  async getClipVideo(inputPath: string, outputPath: string, startTime: number, endTime: number): Promise<string> {
    return await new Promise((resolve: (value: string) => any, reject) => {
      new FFmpeg({source: inputPath})
        .setStartTime(startTime)
        .setDuration(endTime - startTime)
        .on('error', function(err) {
          reject(err);
        })
        .on('end', function() {
          resolve(outputPath);
        })
        .saveToFile(outputPath);
    });
  }
}
