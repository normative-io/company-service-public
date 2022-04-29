// Copyright 2022 Meta Mind AB
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
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
