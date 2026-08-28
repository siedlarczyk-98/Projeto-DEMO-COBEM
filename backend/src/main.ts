import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Railway roda atrás de proxy: sem isso, @Ip() registra o IP do proxy
  // e não o do lead.
  app.set('trust proxy', 1);

  app.setGlobalPrefix('api', {
    exclude: [''], // deixa a raiz livre para a LP
  });

  // Em serviço único a LP é servida pela mesma origem, então CORS só é
  // necessário se você apontar um front externo para cá.
  const origins = process.env.CORS_ORIGIN?.split(',').filter(Boolean);
  if (origins?.length) {
    app.enableCors({ origin: origins });
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = Number(process.env.PORT) || 3000;
  // 0.0.0.0 é obrigatório no Railway; em localhost o container não seria alcançável.
  await app.listen(port, '0.0.0.0');
  console.log(`Rodando na porta ${port}`);
}
bootstrap();
