import {NestFactory} from '@nestjs/core';
import {SwaggerModule, DocumentBuilder} from '@nestjs/swagger';
import {AppModule} from './app.module';
import {NestExpressApplication} from '@nestjs/platform-express';
import * as rateLimit from 'express-rate-limit';
import * as RedisStore from 'rate-limit-redis';
import * as redis from 'redis';
import {ValidationPipe} from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: true
  });

  app.setGlobalPrefix('v1');

  const options = new DocumentBuilder()
    .setTitle('OSUM VSL')
    .setDescription('The osum-vsl API description')
    .setVersion('v1')
    .addTag('osum')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('api/docs', app, document);

  // Rate Limit
  app.use(
    rateLimit({
      store: new RedisStore({
        client: redis.createClient({
          host: process.env.QUEUE_HOST,
          port: +process.env.QUEUE_PORT
        })
      }),
      windowMs: parseInt(process.env.RATELIMIT_WINDOW) * 60 * 1000,
      max: parseInt(process.env.RATELIMIT_MAX)
    })
  );
  app.set('trust proxy', 1);

  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      disableErrorMessages: true
    })
  );

  await app.listen(3000);
}
bootstrap();
