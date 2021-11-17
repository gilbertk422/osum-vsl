import {Controller, UseGuards, Req} from '@nestjs/common';
import {Crud, CrudController, CreateManyDto, ParsedBody, CrudRequest, ParsedRequest, Override} from '@nestjsx/crud';

import {Disclaimer} from './disclaimer.entity';
import {DisclaimerService} from './disclaimer.service';
import * as xss from 'xss';
import {Auth} from '../auth/auth.decorator';

@Crud({
  model: {
    type: Disclaimer
  },
  query: {
    join: {
      project: {
        eager: false
      }
    }
  }
})
@Auth()
@Controller('disclaimer')
export class DisclaimerController implements CrudController<Disclaimer> {
  constructor(public service: DisclaimerService) {}

  get base(): CrudController<Disclaimer> {
    return this;
  }

  setCompanyFilter(request, req: CrudRequest) {
    req.parsed.join.push({field: 'project'});
    const companyFilter = {'project.companyId': request.user.companyId};

    if (!req.parsed.search['$and']) {
      req.parsed.search['$and'] = [companyFilter];
    } else {
      req.parsed.search['$and'].push(companyFilter);
    }
  }

  @Override()
  createOne(@Req() request, @ParsedRequest() req: CrudRequest, @ParsedBody() dto: Disclaimer) {
    dto.text = xss.filterXSS(dto.text);
    dto.createdById = request.user.userId;
    return this.base.createOneBase(req, dto);
  }

  @Override()
  createMany(@Req() request, @ParsedRequest() req: CrudRequest, @ParsedBody() dto: CreateManyDto<Disclaimer>) {
    for (let disclaimer of dto.bulk) {
      disclaimer.text = xss.filterXSS(disclaimer.text);
      disclaimer.createdById = request.user.userId;
    }
    return this.base.createManyBase(req, dto);
  }

  @Override()
  updateOne(@Req() request, @ParsedRequest() req: CrudRequest, @ParsedBody() dto: Disclaimer) {
    this.setCompanyFilter(request, req);
    dto.text = xss.filterXSS(dto.text);
    return this.base.updateOneBase(req, dto);
  }

  @Override()
  replaceOne(@Req() request, @ParsedRequest() req: CrudRequest, @ParsedBody() dto: Disclaimer) {
    this.setCompanyFilter(request, req);
    dto.text = xss.filterXSS(dto.text);
    return this.base.replaceOneBase(req, dto);
  }

  @Override()
  deleteOne(@Req() request, @ParsedRequest() req: CrudRequest) {
    this.setCompanyFilter(request, req);
    return this.base.deleteOneBase(req);
  }
}
