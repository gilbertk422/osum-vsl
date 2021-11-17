import {Module} from '@nestjs/common';
import {AppController} from './app.controller';
import {AppService} from './app.service';
import {ConfigModule} from '@nestjs/config';
import {CommandModule} from 'nestjs-command';
import {CoreModule} from './core/core.module';

import {VideoRenderModule} from './video-render/video-render.module';
import {GentleModule} from './gentle/gentle.module';
import {AdminModule} from './admin/admin.module';
import {GoogleTtsModule} from './google-tts/google-tts.module';
import {OpenaiModule} from './openai/openai.module';
import {MusicaiModule} from './musicai/musicai.module';
import {ApiModule} from './api/api.module';
import {RedisModule} from 'nestjs-redis';
import {ServicePipeModule} from './service-pipe/service-pipe.module';
import {ServeStaticModule} from '@nestjs/serve-static';
import {join} from 'path';
import {MediaPipeModule} from './media-pipe/media-pipe.module';
import {TypeOrmModule} from '@nestjs/typeorm';
import {Connection} from 'typeorm';
import {AuthzModule} from './authz/authz.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'requests')
    }),
    ConfigModule.forRoot({}),
    RedisModule.register({
      host: process.env.QUEUE_HOST,
      port: parseInt(process.env.QUEUE_PORT)
      // password: process.env.REDIS_PASSWORD,
      // keyPrefix: process.env.REDIS_PRIFIX,
    }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      entities: ['src/**/*.entity{.ts}'], // "dist/**/*.entity{.ts,.js}" for prod env
      autoLoadEntities: true,
      synchronize: process.env.NODE_ENV != 'production'
    }),
    CommandModule,
    CoreModule,
    VideoRenderModule,
    GentleModule,
    AdminModule,
    GoogleTtsModule,
    OpenaiModule,
    MusicaiModule,
    ApiModule,
    ServicePipeModule,
    MediaPipeModule,
    AuthzModule
  ],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {
  constructor(private connection: Connection) {}
}
