import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StocksService {
  private liveStocksBaseUrl = this.configService.get<string>('LIVE_STOCKS_BASE_URL');
  private historeyStocksBaseUrl = this.configService.get<string>('HISTORY_STOCKS_BASE_URL');

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async getStockProfile(symbol: string): Promise<any> {
    const apiKey = this.configService.get<string>('FINNHUB_API_KEY');
    const url = `${this.liveStocksBaseUrl}/stock/profile2?symbol=${symbol}&token=${apiKey}`;
    const response = await this.httpService.axiosRef.get(url);
    return response.data;
  }

  async getAlphaVantageData(symbol: string): Promise<any> {
    const apiKey = this.configService.get<string>('ALPHA_VANTAGE_API_KEY');
    const url = `${this.historeyStocksBaseUrl}?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${apiKey}&outputsize=compact`;
    const response = await this.httpService.axiosRef.get(url);
    return response.data;
  }
}