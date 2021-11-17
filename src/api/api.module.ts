import {HttpModule, Module} from '@nestjs/common';
import {ApiController} from './api.controller';
import {SharedModule} from '../shared/shared.module';
import {BullModule} from '@nestjs/bull';
import {PIPERPROCESSOR} from '../shared/processors.constant';
import {ConfigModule, ConfigService} from '@nestjs/config';
import {ApiService} from './api.service';
import {AdminModule} from '../admin/admin.module';
import {CompanyModule} from './company/company.module';
import {ProjectModule} from './project/project.module';
import {UserModule} from './user/user.module';
import {DisclaimerModule} from './disclaimer/disclaimer.module';
import {ImageModule} from './image/image.module';
import {ReferenceModule} from './reference/reference.module';
import {AuthzModule} from 'src/authz/authz.module';
import {JobModule} from './job/job.module';

@Module({
  imports: [
    SharedModule,
    HttpModule,
    ConfigModule,
    BullModule.registerQueueAsync({
      name: PIPERPROCESSOR,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get('QUEUE_HOST'),
          port: +configService.get('QUEUE_PORT')
        }
      }),

      inject: [ConfigService]
    }),
    AdminModule,
    CompanyModule,
    ProjectModule,
    UserModule,
    DisclaimerModule,
    ImageModule,
    ReferenceModule,
    AuthzModule,
    JobModule
  ],
  controllers: [ApiController],
  providers: [ApiService]
})
export class ApiModule {}
