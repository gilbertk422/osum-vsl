import {Module, HttpModule} from '@nestjs/common';
import {SharedModule} from '../shared/shared.module';
import {BullModule} from '@nestjs/bull';
import {ConfigModule, ConfigService} from '@nestjs/config';
import {MUSICAIPROCESSOR} from '../shared/processors.constant';
import {MusicaiCommand} from './musicai.command';
import {MusicaiProcessor} from './musicai.processor';
import {MusicaiService} from './musicai.service';

@Module({
  imports: [
    HttpModule,
    SharedModule,
    BullModule.registerQueueAsync({
      name: MUSICAIPROCESSOR,
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
  providers: [MusicaiCommand, MusicaiProcessor, MusicaiService]
})
export class MusicaiModule {}
