import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import * as bodyParser from 'body-parser';
import * as Sentry from '@sentry/node';

async function bootstrap() {
  // Initialize Sentry if DSN provided
  if (process.env.SENTRY_DSN) {
    Sentry.init({ dsn: process.env.SENTRY_DSN });
  }

  const app = await NestFactory.create(AppModule);

  // Capture raw body for accurate HMAC verification. Stores string on request.rawBody
  app.use(bodyParser.json({
    verify: (req: any, _res, buf: Buffer) => {
      try {
        req.rawBody = buf.toString();
      } catch (e) {
        req.rawBody = '';
      }
    },
    limit: '1mb'
  }));
  app.use(bodyParser.urlencoded({
    verify: (req: any, _res, buf: Buffer) => {
      try { req.rawBody = buf.toString(); } catch (e) { req.rawBody = ''; }
    },
    extended: true,
    limit: '1mb'
  }));

  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  });
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
