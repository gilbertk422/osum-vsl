import {Controller, UseGuards, Req} from '@nestjs/common';
import {Crud, CrudController, Override, ParsedRequest, ParsedBody, CrudRequest, CreateManyDto} from '@nestjsx/crud';

import {Image} from './image.entity';
import {ImageService} from './image.service';
import {Auth} from '../auth/auth.decorator';

@Crud({
  model: {
    type: Image
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
@Controller('image')
export class ImageController implements CrudController<Image> {
  constructor(public service: ImageService) {}

  get base(): CrudController<Image> {
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
  createOne(@Req() request, @ParsedRequest() req: CrudRequest, @ParsedBody() dto: Image) {
    dto.createdById = request.user.userId;
    return this.base.createOneBase(req, dto);
  }

  @Override()
  createMany(@Req() request, @ParsedRequest() req: CrudRequest, @ParsedBody() dto: CreateManyDto<Image>) {
    for (let image of dto.bulk) {
      image.createdById = request.user.userId;
    }
    return this.base.createManyBase(req, dto);
  }

  @Override()
  updateOne(@Req() request, @ParsedRequest() req: CrudRequest, @ParsedBody() dto: Image) {
    this.setCompanyFilter(request, req);
    return this.base.updateOneBase(req, dto);
  }

  @Override()
  replaceOne(@Req() request, @ParsedRequest() req: CrudRequest, @ParsedBody() dto: Image) {
    this.setCompanyFilter(request, req);
    return this.base.replaceOneBase(req, dto);
  }

  @Override()
  deleteOne(@Req() request, @ParsedRequest() req: CrudRequest) {
    this.setCompanyFilter(request, req);
    return this.base.deleteOneBase(req);
  }
}
