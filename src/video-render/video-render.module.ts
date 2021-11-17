import {BullModule} from '@nestjs/bull';
import {Module} from '@nestjs/common';
import {SharedModule} from '../shared/shared.module';
import {VideoRenderController} from './video-render.controller';
import {VideoRenderProcessor} from './video-render.processor';
import {VideoRenderCommand} from './video-render.command';
import {ConfigModule, ConfigService} from '@nestjs/config';
import {VideoRenderService} from './video-render.service';
import {VIDEORENDERPROCESSOR} from '../shared/processors.constant';
import {JobModule} from 'src/api/job/job.module';

@Module({
  imports: [
    SharedModule,
    JobModule,
    BullModule.registerQueueAsync({
      name: VIDEORENDERPROCESSOR,
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
  controllers: [VideoRenderController],
  providers: [VideoRenderProcessor, VideoRenderCommand, VideoRenderService]
})
export class VideoRenderModule {}
