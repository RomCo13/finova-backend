import { Module } from '@nestjs/common';
import { StocksController } from './stocks.controller';
import { StocksService } from './stocks.service';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [HttpModule, ConfigModule], // Import HttpModule for API requests
  controllers: [StocksController],     // Register the controller
  providers: [StocksService],         // Register the service
})
export class StocksModule {}