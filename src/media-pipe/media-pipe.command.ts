import {Command} from 'nestjs-command';
import {Injectable, Logger} from '@nestjs/common';
import * as fs from 'fs';
import {MediaPipeService} from './media-pipe.service';
import {InjectQueue} from '@nestjs/bull';
import {GOOGLETTSPROCESSOR, MEDIAPIPEPROCESSOR} from '../shared/processors.constant';
import {Queue} from 'bull';
import * as uuid from 'uuid';
import {Subtitle} from '../shared/shared.interface';
import {VideoIntelligenceServiceClient, v1, protos} from '@google-cloud/video-intelligence';
import {GoogleAuth} from 'google-auth-library';
import {VideoObject} from './google-video-ai.interface';
import {StoreService} from '../shared/services/store/store.service';
import {JobService} from 'src/api/job/job.service';

@Injectable()
export class MediaPipeCommand {
  private readonly logger = new Logger(MediaPipeCommand.name);

  constructor(
    private readonly jobService: JobService,
    @InjectQueue(MEDIAPIPEPROCESSOR) private readonly mediaPipeQueue: Queue,
    private readonly mediaPipeService: MediaPipeService
  ) {}
  @Command({command: 'test:mediapipe', describe: 'test media-pipe job', autoExit: true})
  async test() {
    let jobId = uuid.v4();

    await this.jobService.setJobStatus(jobId, {
      step: 'mediapipe',
      status: 'in_progress',
      files: [],
      percentage: 0
    });

    await this.mediaPipeQueue.add(
      'mediaPipeProcess',
      {
        jsonUrl: '75ce3e26-5202-429f-8e6d-026348094ca1/ce7bddee-a46c-4c45-a5e7-e2aedb425916.json'
        // jsonUrl: '00721aff-1a48-4513-b917-850dc8f28c17/input.json' // videos
        // jsonUrl: 'input_thumbor.json' // images
      },
      {jobId}
    );

    //
    // const auth = new GoogleAuth({scopes: 'https://www.googleapis.com/auth/cloud-platform'});
    // this.mediaPipeService.authClient = await auth.getClient();
    //
    // // const item0:Subtitle = {"text":"wellness. There is no extra charge for","startTime":145480,"endTime":148300,"textContext":{"current":"wellness. There is no extra charge for","before":"like, about all aspects of health and","after":"this. And you get free lifetime access to"},"type":"video","rawContent":"e8a7ff05-61e5-47bd-8eb6-728a6a5e6cbb/1010242673.mp4"}
    // // const item1:Subtitle = {"text":"wellness. There is no extra charge for","startTime":145480,"endTime":148300,"textContext":{"current":"wellness. There is no extra charge for","before":"like, about all aspects of health and","after":"this. And you get free lifetime access to"},"type":"video","rawContent":"e8a7ff05-61e5-47bd-8eb6-728a6a5e6cbb/1019642566.mp4"}
    //
    // // const videos = [item0, item1];
    //
    //
    // let promises = [];
    //
    // // promises = videos.map(item => {
    // //     return this.mediaPipeService.addVAITask(item)
    // // });
    //
    // // const operationUrls = await Promise.all(promises);
    //
    // const operationUrls = [
    //     'projects/172441279697/locations/us-east1/operations/8067702384812129567',
    //     'projects/172441279697/locations/us-east1/operations/15309268774409914646'
    // ]
    // promises = operationUrls.map(operationUrl => {
    //     return this.mediaPipeService.getOperationResult(operationUrl, null, 1)
    // })
    // const operationResults = await Promise.all(promises);
    //
    // const videoObjects = operationResults.map( (item, idx) => {
    //     /**
    //      * item:     [{
    //         inputUri: '/vsl/a3239c2b-550c-4569-a311-7af71c449c7d/23606224.mp4',
    //         segment: [Object],
    //         objectAnnotations: [Array]
    //       }]
    //      */
    //
    //
    //     //if there are no objectAnnotations - thread whole video as single object
    //     if (! item[0].objectAnnotations) {
    //
    //         const st = item[0].segment.startTimeOffset;
    //         const et = item[0].segment.endTimeOffset;
    //
    //         return [{
    //             description: 'objects not found',
    //             entityId: uuid.v4(),
    //             startTime: +st.substring(0, st.length-1), //skip 's' at the end and convert to number
    //             endTime: +et.substring(0, et.length-1)
    //         }];
    //
    //         // this.logger.error(` ====No objectAnnotations!! idx: ${idx}, video: ${ JSON.stringify(videos[idx])}`, JSON.stringify(item));
    //         // throw  new Error('No objectAnnotations for video!!')
    //     }
    //     else {
    //
    //         return item[0].objectAnnotations.map(object => {
    //             const time = object.segment;
    //             return {
    //                 description: object.entity.description,
    //                 entityId: object.entity.entityId,
    //                 startTime: +time.startTimeOffset.seconds || 0,
    //                 endTime: +time.endTimeOffset.seconds || 0
    //             }
    //         })
    //     }
    //
    // })
    //
    // console.debug('jobData1', videoObjects )
    // //
    // // const jobData = JSON.parse(fs.readFileSync(`input_media_pipe.json`).toLocaleString());
    // //
    // // const videos = jobData.rows;
    // //
    // // console.debug('jobData', jobData)
    // // // videos.push(jobData.rows[0]);
    // //
    // // const tempDir='tmp/9b85dfb7-9c6d-47ff-a833-e0e8fb755c1a', videoObjects=[], sceneDurations=[], footageDurations=[], jobId='123';
    // //
    // // for (let index = 0; index < videos.length; index++) {
    // //     const item = videos[index];
    // //
    // //     const res = await  this.mediaPipeService.cutVideo(item, index, tempDir, videoObjects, sceneDurations, footageDurations, jobId);
    // //     console.log(res)
    // // }
    //
  }
}
