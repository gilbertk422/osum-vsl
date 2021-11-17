import {Module, HttpModule} from '@nestjs/common';
import {MediaPipeService} from './media-pipe.service';
import {SharedModule} from '../shared/shared.module';
import {BullModule} from '@nestjs/bull';
import {MEDIAPIPEPROCESSOR} from '../shared/processors.constant';
import {ConfigModule, ConfigService} from '@nestjs/config';
import {MediaPipeProcessor} from './media-pipe.processor';
import {GoogleVideoAIService} from './google-video-ai.service';
import {MediaPipeCommand} from './media-pipe.command';
import {ThumborService} from './thumbor.service';
import {JobModule} from 'src/api/job/job.module';

@Module({
  imports: [
    HttpModule,
    SharedModule,
    JobModule,
    BullModule.registerQueueAsync({
      name: MEDIAPIPEPROCESSOR,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        settings: {
          stalledInterval: 90000
        },
        redis: {
          host: configService.get('QUEUE_HOST'),
          port: +configService.get('QUEUE_PORT')
        }
      }),
      inject: [ConfigService]
    })
  ],
  providers: [MediaPipeService, MediaPipeProcessor, MediaPipeCommand, GoogleVideoAIService, ThumborService]
})
export class MediaPipeModule {}
