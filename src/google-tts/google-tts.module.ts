import {Module} from '@nestjs/common';
import {GoogleTtsService} from './google-tts.service';
import {BullModule} from '@nestjs/bull';
import {ConfigModule, ConfigService} from '@nestjs/config';
import {GOOGLETTSPROCESSOR} from '../shared/processors.constant';
import {SharedModule} from '../shared/shared.module';
import {GoogleTtsCommand} from './google-tts.command';
import {GoogleTtsProcessor} from './google-tts.processor';
import {JobModule} from 'src/api/job/job.module';

@Module({
  imports: [
    SharedModule,
    JobModule,
    BullModule.registerQueueAsync({
      name: GOOGLETTSPROCESSOR,
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
  providers: [GoogleTtsService, GoogleTtsCommand, GoogleTtsProcessor]
})
export class GoogleTtsModule {}
