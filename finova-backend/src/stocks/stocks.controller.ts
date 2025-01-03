import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { StocksService } from './stocks.service';

@ApiTags('Stocks')
@Controller('stocks')
export class StocksController {
  constructor(private readonly stocksService: StocksService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get stock profile from Finnhub' })
  @ApiQuery({ name: 'symbol', description: 'Stock symbol', required: true })
  async getStockProfile(@Query('symbol') symbol: string) {
    return this.stocksService.getStockProfile(symbol);
  }

  @Get('alpha-vantage')
  @ApiOperation({ summary: 'Get stock data from Alpha Vantage' })
  @ApiQuery({ name: 'symbol', description: 'Stock symbol', required: true })
  async getAlphaVantageData(@Query('symbol') symbol: string) {
    return this.stocksService.getAlphaVantageData(symbol);
  }
}