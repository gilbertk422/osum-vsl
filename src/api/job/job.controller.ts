import {
  Controller,
  Post,
  Request,
  Body,
  UploadedFiles,
  Res,
  Logger,
  Param,
  Req,
  Get,
  ForbiddenException,
  NotFoundException,
  Delete
} from '@nestjs/common';
import {Crud, CrudController, CrudRequest, Override, ParsedRequest} from '@nestjsx/crud';
import {Auth} from '../auth/auth.decorator';
import {Job} from './job.entity';
import {JobService} from './job.service';
import * as uuid from 'uuid';
import {StoreService} from 'src/shared/services/store/store.service';
import {InjectQueue} from '@nestjs/bull';
import {PIPERPROCESSOR} from 'src/shared/processors.constant';
import {Queue} from 'bull';
import {ProjectService} from '../project/project.service';
import {JOB_SOURCE, JOB_STATUS} from './job.constant';
import {AdminService} from 'src/admin/admin.service';
import {ApiOperation} from '@nestjs/swagger';

@Crud({
  model: {
    type: Job
  },
  routes: {
    exclude: ['createManyBase', 'createOneBase', 'replaceOneBase', 'getOneBase', 'updateOneBase', 'deleteOneBase']
  }
})
@Auth()
@Controller('job')
export class JobController implements CrudController<Job> {
  private readonly logger = new Logger(JobController.name);

  constructor(
    public service: JobService,
    private storeService: StoreService,
    private projectService: ProjectService,
    private adminService: AdminService,
    @InjectQueue(PIPERPROCESSOR) private readonly pipeQueue: Queue
  ) {}

  get base(): CrudController<Job> {
    return this;
  }

  setCompanyFilter(request, req: CrudRequest) {
    const companyFilter = {companyId: request.user.companyId};

    if (!req.parsed.search['$and']) {
      req.parsed.search['$and'] = [companyFilter];
    } else {
      req.parsed.search['$and'].push(companyFilter);
    }
  }

  /**
   * start a new job for the project
   * @param projectId
   * @param request
   * @param body
   * @param res
   */
  @ApiOperation({
    summary: 'Get the jobs of the company'
  })
  @Post(':projectId/start')
  async start(@Param('projectId') projectId: number, @Request() request, @Body() body, @Res() res) {
    let jobData, jobId, job;
    try {
      // validate request
      const project = await this.projectService.getProject(projectId);
      if (!project || project.companyId != request.user.companyId) {
        throw new NotFoundException('Project not found');
      }

      jobId = uuid.v4();

      // create a job record in database
      job = new Job();
      job.script = project.script;
      job.source = JOB_SOURCE.UI;
      job.status = JOB_STATUS.pending;
      job.projectId = projectId;
      job.companyId = request.user.companyId;
      job.createdById = request.user.userId;
      job.jobId = jobId;
      job = await this.service.saveJob(job);

      // push the job to bull queue
      jobData = {
        projectName: project.name,
        projectId: project.id,
        script: project.script,
        useVidux: project.useVidux,
        voiceGender: project.voiceGender,
        videosPercent: project.videosPercent
      };
      const jsonUrl = await this.storeService.storeJobData(jobId, jobData);
      await this.pipeQueue.add('startPipe', {jsonUrl}, {jobId});
    } catch (err) {
      this.logger.error(err.message, err.stack, err);
      throw err;
    }

    return res.json({
      status: 'ok',
      payload: {
        message: 'The Job has been successfully started.',
        job: {
          id: job.id,
          jobId: job.jobId,
          ...jobData
        }
      }
    });
  }

  /**
   * cancel the job and set status 'cancelled'
   * @param request
   * @param req
   */
  @ApiOperation({
    summary: "Cancel the job and set status 'cancelled'"
  })
  @Delete(':jobId')
  async deleteOne(@Param('jobId') jobId: string, @Req() request, @ParsedRequest() req: CrudRequest, @Res() res) {
    try {
      // validate request
      let job = await this.service.getJobByJobId(jobId);
      if (!job) {
        throw new NotFoundException('Job not found');
      }
      const project = await this.projectService.getProject(job.projectId);
      if (!project || project.companyId != request.user.companyId) {
        throw new NotFoundException('Project not found');
      }

      // update status
      job.status = JOB_STATUS.deleted;
      await this.service.saveJob(job);

      // cancel job
      await this.adminService.cancelJob(job.jobId);
    } catch (err) {
      this.logger.error(err.message, err.stack, err);
      throw err;
    }

    return res.json({
      status: 'ok',
      payload: {
        message: 'The Job has been successfully cancelled.'
      }
    });
  }

  /**
   * get jobs for the company
   * @param request
   * @param req
   */
  @Override()
  getMany(@Request() request, @ParsedRequest() req: CrudRequest) {
    this.setCompanyFilter(request, req);
    return this.base.getManyBase(req);
  }

  /**
   * get the job
   * @param jobId
   * @param request
   * @param body
   * @param res
   */
  @ApiOperation({
    summary: 'Get the job by jobId'
  })
  @Get(':jobId')
  async getJob(@Param('jobId') jobId: string, @Request() request, @Body() body, @Res() res) {
    // validate request
    const job = await this.service.getJobByJobId(jobId);
    if (!job || job.companyId != request.user.companyId) {
      throw new NotFoundException('Job not found');
    }
    if (job.files) {
      job.files = JSON.parse(job.files);
    }

    return res.json({
      status: 'ok',
      payload: {
        job
      }
    });
  }
}
