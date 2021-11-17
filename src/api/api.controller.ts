import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Request,
  UploadedFiles,
  UseInterceptors,
  Res,
  HttpService,
  Delete,
  UseGuards
} from '@nestjs/common';
import {InjectQueue} from '@nestjs/bull';
import {Queue} from 'bull';
import {FileFieldsInterceptor} from '@nestjs/platform-express';
import {diskStorage} from 'multer';
import * as uuid from 'uuid';
import {ApiService} from './api.service';
import {extname} from 'path';
import {PIPERPROCESSOR} from '../shared/processors.constant';
import {JobStatus, StoreService} from '../shared/services/store/store.service';
import {Request as RequestExpress, Response as ResponseExpress} from 'express';
import {AxiosResponse} from 'axios';
import {AdminService} from '../admin/admin.service';
import {ApiVersion} from '@nestjsx/api-version';
import {ReplaySubject} from 'rxjs';
import {AuthGuard} from '@nestjs/passport';
import {ApiBearerAuth, ApiHeader} from '@nestjs/swagger';
import {uploadedImage} from '../shared/shared.interface';
import {JobService} from './job/job.service';
import {JOB_SOURCE, JOB_STATUS} from "./job/job.constant";
import { Job } from './job/job.entity';

@Controller('api')
export class ApiController {
  private readonly logger = new Logger(ApiController.name);

  constructor(
    private adminService: AdminService,
    private service: ApiService,
    private storeService: StoreService,
    private readonly jobService: JobService,
    private readonly httpService: HttpService,
    @InjectQueue(PIPERPROCESSOR) private readonly pipeQueue: Queue
  ) {}

  /**
     * receive multipart formdata:
     text (script)
     product images
     guarantee images
     videosPercent parameter (the rate "images vs videos" to use in final video)

     upload images to GCS
     store job data to Redis hash 'jobdata', key: jobID
     generate, return unique jobID (UUIDV4)
     set job status in Redis (JSON string, key: status_<job_id>):

     * @param request
     * @param body
     */
  // TODO: add validation: text param must present, videosPercent must present
  // TODO: describe input DTO
  @Post('start')
  @UseInterceptors(
    FileFieldsInterceptor(
      [{name: 'productimages', maxCount: 99}, {name: 'guaranteeimages', maxCount: 99}, {name: 'backgroundmusic'}],
      {
        storage: diskStorage({
          destination: './uploads',
          filename: (req, file, cb) => {
            //TODO: split folders in case of many files
            // if (!fs.existsSync(`./uploads/${subFolder}`)){
            //   fs.mkdirSync(`./uploads/${subFolder}`);
            // }

            const randomName = uuid.v4();
            return cb(null, `${randomName}${extname(file.originalname)}`);
          }
        })
      }
    )
  )
  async start(@Request() request, @Body() body, @UploadedFiles() uploadedFiles, @Res() res) {
    const jobId = uuid.v4();

    const uploadedImages: uploadedImage[] = [];

    if (uploadedFiles) {
      this.logger.debug('uploading files to GCS');
      await this.service.uploadFiles(jobId, uploadedFiles);

      if (uploadedFiles.productimages) {
        uploadedFiles.productimages.forEach(file => {
          uploadedImages.push({
            originalName: file.originalname,
            type: 'product',
            rawContent: `${jobId}/${file.filename}`
          });
        });
      }

      if (uploadedFiles.guaranteeimages) {
        uploadedFiles.guaranteeimages.forEach(file => {
          uploadedImages.push({
            originalName: file.originalname,
            type: 'guarantee',
            rawContent: `${jobId}/${file.filename}`
          });
        });
      }
    }

    const jobData = {...body, uploadedImages};

    let job = new Job();
    job.script = jobData.script;
    job.source = JOB_SOURCE.UI;
    job.status = JOB_STATUS.pending;
    job.projectId = null;
    job.companyId = null;
    job.createdById = null;
    job.jobId = jobId;
    job = await this.jobService.saveJob(job);


    const jsonUrl = await this.storeService.storeJobData(jobId, jobData);

    // start the pipe
    await this.pipeQueue.add('startPipe', {jsonUrl}, {jobId});

    return res.redirect(`/status.html?jobId=${jobId}`);
  }

  @Get('status/:jobId')
  async status(@Param('jobId') jobId: string): Promise<JobStatus> {
    // return {
    //   step:'videorender',
    //   status: 'completed',
    //   files:[]
    // }
    return this.jobService.getJobStatus(jobId);
  }

  /**
   * kill job in the queue
   * send 'abort' (job_id) message  to all queues
   * @param jobId
   */
  @Delete('/:jobId')
  async deleteJob(@Param('jobId') jobId: string, @Res() res): Promise<JobStatus> {
    try {
      await this.adminService.cancelJob(jobId);
    } catch (err) {
      return res.json({
        status: 'error',
        payload: {
          message: err.message || err
        }
      });
    }
    return res.json({
      status: 'ok',
      payload: {
        message: 'Job has been successfully cancelled.'
      }
    });
  }
}
