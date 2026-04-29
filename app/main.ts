import { generateKeyPairSync } from 'crypto';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { getQueueToken } from '@nestjs/bull';
import { Queue } from 'bull';
import { AppModule } from './app.module';
import { PROMPT_RUNS_QUEUE } from './prompt-engine/prompt-engine.constants';

function seedDevKeys(): void {
  if (process.env['JWT_PUBLIC_KEY']) return;
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  process.env['JWT_PRIVATE_KEY'] = Buffer.from(
    privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  ).toString('base64');
  process.env['JWT_PUBLIC_KEY'] = Buffer.from(
    publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  ).toString('base64');
  console.warn('[auth] JWT_PUBLIC_KEY not set — ephemeral dev key pair in use (tokens reset on restart)');
}

seedDevKeys();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.use(cookieParser());

  const origins = process.env['ALLOWED_ORIGINS']?.split(',') ?? [];
  app.enableCors({ origin: origins, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('AEO Suite API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  // BullBoard — mount before listen; protected by shared secret header
  const bullBoardAdapter = new ExpressAdapter();
  bullBoardAdapter.setBasePath('/admin/queues');
  createBullBoard({
    queues: [new BullAdapter(app.get<Queue>(getQueueToken(PROMPT_RUNS_QUEUE)))],
    serverAdapter: bullBoardAdapter,
  });
  app.use('/admin/queues', (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
    const secret = process.env['ADMIN_QUEUE_SECRET'];
    if (secret && req.headers['x-admin-secret'] !== secret) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    next();
  }, bullBoardAdapter.getRouter());

  const port = parseInt(process.env['PORT'] ?? '3000', 10);
  await app.listen(port);
}

void bootstrap();
