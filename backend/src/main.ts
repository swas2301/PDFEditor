import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { PdfService } from './services/pdf.service';
import { PdfController } from './controllers/pdf.controller';
import * as express from 'express';
import * as path from 'path';
import { MulterModule } from '@nestjs/platform-express';

@Module({
  imports: [MulterModule.register()],
  controllers: [PdfController],
  providers: [PdfService],
})
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: 'http://localhost:3001', // frontend origin
    credentials: true,
  });
  await app.listen(3000);
}

bootstrap();
