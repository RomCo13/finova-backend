import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configure Swagger
  const config = new DocumentBuilder()
    .setTitle('Stock API')
    .setDescription('API for retrieving and managing stock data')
    .setVersion('1.0')
    .addBearerAuth() // Add authorization if required
    .build(); //

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document); // Swagger UI available at /api-docs

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

}
bootstrap();