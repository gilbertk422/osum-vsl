import {Module} from '@nestjs/common';
import {JobService} from './job.service';
import {JobController} from './job.controller';
import {Job} from './job.entity';
import {TypeOrmModule} from '@nestjs/typeorm';
import {SharedModule} from 'src/shared/shared.module';
import {BullModule} from '@nestjs/bull';
import {PIPERPROCESSOR} from 'src/shared/processors.constant';
import {ConfigModule, ConfigService} from '@nestjs/config';
import {ProjectModule} from '../project/project.module';
import {AdminModule} from 'src/admin/admin.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Job]),
    SharedModule,
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
    ProjectModule,
    AdminModule
  ],
  providers: [JobService],
  exports: [JobService],
  controllers: [JobController]
})
export class JobModule {}
