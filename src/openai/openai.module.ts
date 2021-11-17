import {Module, HttpModule} from '@nestjs/common';
import {SharedModule} from '../shared/shared.module';
import {BullModule} from '@nestjs/bull';
import {ConfigModule, ConfigService} from '@nestjs/config';
import {OPENAIPROCESSOR} from '../shared/processors.constant';
import {OpenaiCommand} from './openai.command';
import {OpenaiProcessor} from './openai.processor';
import {OpenaiService} from './openai.service';
import {ShutterstockService} from '../shared/services/shutterstock/shutterstock.service';
import {JobModule} from 'src/api/job/job.module';

@Module({
  imports: [
    HttpModule,
    SharedModule,
    JobModule,
    BullModule.registerQueueAsync({
      name: OPENAIPROCESSOR,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get('QUEUE_HOST'),
          port: +configService.get('QUEUE_PORT')
        }
      }),
      inject: [ConfigService]
    })
  ],
  controllers: [],
  providers: [OpenaiCommand, OpenaiProcessor, OpenaiService, ShutterstockService]
})
export class OpenaiModule {}
