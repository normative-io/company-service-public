import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());

  const config = new DocumentBuilder()
    .setTitle('Scraper Service')
    .setDescription('The scraper-service API description')
    .setVersion('1.0')
    .addTag('company')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  const apiSubpath = 'api';
  SwaggerModule.setup(apiSubpath, app, document);

  await app.listen(3001, '0.0.0.0');

  const url = await app.getUrl();

  console.log(`Application is running on: ${url}`);
  console.log(`See API: ${url}/${apiSubpath}`);
}
bootstrap();
