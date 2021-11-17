import {Controller, UseGuards, Req} from '@nestjs/common';
import {Crud, CrudController, ParsedBody, CrudRequest, ParsedRequest, Override, CreateManyDto} from '@nestjsx/crud';

import {Reference} from './reference.entity';
import {ReferenceService} from './reference.service';
import * as xss from 'xss';
import {Auth} from '../auth/auth.decorator';
import {ApiBody} from '@nestjs/swagger';

@Crud({
  model: {
    type: Reference
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
@Controller('reference')
export class ReferenceController implements CrudController<Reference> {
  constructor(public service: ReferenceService) {}

  get base(): CrudController<Reference> {
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

  @ApiBody({
    schema: {
      example: {
        text: 'this is reference',
        projectId: 0,
        createdById: 0
      }
    }
  })
  @Override()
  createOne(@Req() request, @ParsedRequest() req: CrudRequest, @ParsedBody() dto: Reference) {
    dto.text = xss.filterXSS(dto.text);
    dto.createdById = request.user.userId;
    return this.base.createOneBase(req, dto);
  }

  @Override()
  createMany(@Req() request, @ParsedRequest() req: CrudRequest, @ParsedBody() dto: CreateManyDto<Reference>) {
    for (let reference of dto.bulk) {
      reference.text = xss.filterXSS(reference.text);
      reference.createdById = request.user.userId;
    }
    return this.base.createManyBase(req, dto);
  }

  @Override()
  updateOne(@Req() request, @ParsedRequest() req: CrudRequest, @ParsedBody() dto: Reference) {
    this.setCompanyFilter(request, req);
    dto.text = xss.filterXSS(dto.text);
    return this.base.updateOneBase(req, dto);
  }

  @Override()
  replaceOne(@Req() request, @ParsedRequest() req: CrudRequest, @ParsedBody() dto: Reference) {
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
