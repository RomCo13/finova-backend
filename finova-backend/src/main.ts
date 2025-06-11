import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  console.log(process.env.MONGODB_URI);
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      disableErrorMessages: false,
    }),
  );

  // Serve static files from public directory
  app.useStaticAssets(join(__dirname, '..', 'public'));

  app.enableCors({
    origin: '*',
  });
    const config = new DocumentBuilder()
    .setTitle('Stock API')
    .setDescription('API for retrieving and managing stock data')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT ?? 5000;
  await app.listen(port);
  console.log(`Application is running on port: ${port}`);
}
bootstrap();
