import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { config } from './config';
async function main() {
  config();
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  await app.listen(Number(process.env.API_PORT ?? 6000), process.env.API_HOST ?? '127.0.0.1');
}
main().catch(error => { console.error(error); process.exit(1); });
