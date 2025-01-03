import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { StocksModule } from './stocks/stocks.module';
import { StocksController } from './stocks/stocks.controller';

@Module({
  imports: [StocksModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
