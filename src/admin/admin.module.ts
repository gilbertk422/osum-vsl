import {MiddlewareConsumer, Module} from '@nestjs/common';
import {AdminController} from './admin.controller';
import {AdminService} from './admin.service';
import {QueueUIProvider} from './queueui.provider';
import {BullModule} from '@nestjs/bull';
import {SharedModule} from '../shared/shared.module';
import {ConfigModule, ConfigService} from '@nestjs/config';
import {
  GENTLEPROCESSOR,
  GOOGLETTSPROCESSOR,
  MEDIAPIPEPROCESSOR,
  OPENAIPROCESSOR,
  MUSICAIPROCESSOR,
  PIPERPROCESSOR,
  VIDEORENDERPROCESSOR
} from '../shared/processors.constant';
import {UI} from 'bull-board';

@Module({
  imports: [
    SharedModule,
    BullModule.registerQueueAsync(
      {
        name: PIPERPROCESSOR,
        imports: [ConfigModule],
        useFactory: async (configService: ConfigService) => ({
          redis: {
            host: configService.get('QUEUE_HOST'),
            port: +configService.get('QUEUE_PORT')
          }
        }),

        inject: [ConfigService]
      },
      {
        name: VIDEORENDERPROCESSOR,
        imports: [ConfigModule],
        useFactory: async (configService: ConfigService) => ({
          redis: {
            host: configService.get('QUEUE_HOST'),
            port: +configService.get('QUEUE_PORT')
          }
        }),

        inject: [ConfigService]
      },
      {
        name: GENTLEPROCESSOR,
        imports: [ConfigModule],
        useFactory: async (configService: ConfigService) => ({
          redis: {
            host: configService.get('QUEUE_HOST'),
            port: +configService.get('QUEUE_PORT')
          }
        }),
        inject: [ConfigService]
      },
      {
        name: GOOGLETTSPROCESSOR,
        imports: [ConfigModule],
        useFactory: async (configService: ConfigService) => ({
          redis: {
            host: configService.get('QUEUE_HOST'),
            port: +configService.get('QUEUE_PORT')
          }
        }),
        inject: [ConfigService]
      },
      {
        name: OPENAIPROCESSOR,
        imports: [ConfigModule],
        useFactory: async (configService: ConfigService) => ({
          redis: {
            host: configService.get('QUEUE_HOST'),
            port: +configService.get('QUEUE_PORT')
          }
        }),
        inject: [ConfigService]
      },
      {
        name: MUSICAIPROCESSOR,
        imports: [ConfigModule],
        useFactory: async (configService: ConfigService) => ({
          redis: {
            host: configService.get('QUEUE_HOST'),
            port: +configService.get('QUEUE_PORT')
          }
        }),
        inject: [ConfigService]
      },
      {
        name: MEDIAPIPEPROCESSOR,
        imports: [ConfigModule],
        useFactory: async (configService: ConfigService) => ({
          redis: {
            host: configService.get('QUEUE_HOST'),
            port: +configService.get('QUEUE_PORT')
          }
        }),
        inject: [ConfigService]
      }
    )
  ],
  controllers: [AdminController],
  providers: [AdminService, QueueUIProvider],
  exports: [AdminService]
})
export class AdminModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(UI).forRoutes('/admin/queue');
  }
}
