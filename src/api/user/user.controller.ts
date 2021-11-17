import {Controller, Post, Res, Req, UseGuards} from '@nestjs/common';
import {Crud, CrudController, Override, ParsedRequest, CrudRequest, ParsedBody} from '@nestjsx/crud';
import {User} from './user.entity';
import {UserService} from './user.service';
import {Auth} from '../auth/auth.decorator';
import {AuthGuard} from '@nestjs/passport';
import {CompanyService} from '../company/company.service';
import {AuthzManagementService} from 'src/authz/authz-management.service';
import {ApiBearerAuth, ApiProperty, ApiBody, ApiExtraModels, ApiProduces, ApiOperation} from '@nestjs/swagger';
import {Company} from '../company/company.entity';
import {existsSync} from 'fs';

@Crud({
  model: {
    type: User
  },
  routes: {
    exclude: ['createManyBase']
  }
})
@Controller('user')
export class UserController implements CrudController<User> {
  constructor(
    public service: UserService,
    public companyService: CompanyService,
    private authzManagementService: AuthzManagementService
  ) {}

  get base(): CrudController<User> {
    return this;
  }

  @Auth()
  @Override()
  getOne(@ParsedRequest() req: CrudRequest) {
    return this.base.getOneBase(req);
  }

  @Auth()
  @Override()
  getMany(@ParsedRequest() req: CrudRequest) {
    return this.base.getManyBase(req);
  }

  @Auth()
  @Override()
  createOne(@ParsedRequest() req: CrudRequest, @ParsedBody() dto: User) {
    return this.base.createOneBase(req, dto);
  }

  @Auth()
  @Override()
  updateOne(@ParsedRequest() req: CrudRequest, @ParsedBody() dto: User) {
    return this.base.updateOneBase(req, dto);
  }

  @Auth()
  @Override()
  replaceOne(@ParsedRequest() req: CrudRequest, @ParsedBody() dto: User) {
    return this.base.replaceOneBase(req, dto);
  }

  @Auth()
  @Override()
  deleteOne(@ParsedRequest() req: CrudRequest) {
    return this.base.deleteOneBase(req);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('register')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Register a user and create a company for it'
  })
  async register(@Req() req, @Res() res) {
    let companyName = null;
    let companyId: number = null,
      userId: number = null;

    let metaData = req.user[`${process.env.AUTH0_AUDIENCE}/user_meta_data`];
    if (metaData && metaData.companyId && metaData.userId) {
      companyId = metaData.companyId;
      userId = metaData.userId;
      return res.json({
        status: 'ok',
        payload: {
          userId,
          companyId
        }
      });
    }

    let user: User, company: Company;

    if (!userId) {
      let existUser = await this.service.getUserBySubWithCompany(req.user.sub);
      if (existUser) {
        user = existUser;
        userId = existUser.id;
      } else {
        user = await this.service.createUserWithSub(req.user.sub);
        userId = user.id;
      }
    }

    if (!companyId) {
      if (user.company) {
        companyId = user.company.id;
      } else {
        company = await this.companyService.createCompany({
          name: companyName,
          createdBy: user
        });
        companyId = company.id;
        user.company = company;
        await this.service.saveUser(user);
      }
    }

    let auth0User = await this.authzManagementService.updateUser(req.user.sub, {
      user_metadata: {
        userId: userId,
        companyId: companyId
      }
    });

    await this.authzManagementService.assignRoleToUser(req.user.sub, 'companyadmin');

    return res.json({
      status: 'ok',
      payload: {
        userId,
        companyId
      }
    });
  }
}
