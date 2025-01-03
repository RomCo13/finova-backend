import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StocksService {
  private readonly liveStocksBaseUrl: string;
  private readonly liveStockApiKey: string;
  private readonly historeyStocksBaseUrl: string;
  private readonly historeyStocksAPIKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.liveStocksBaseUrl = this.configService.get<string>('LIVE_STOCKS_BASE_URL');
    this.liveStockApiKey = this.configService.get<string>('LIVE_STOCKS_API_KEY');
    this.historeyStocksBaseUrl = this.configService.get<string>('HISTORY_STOCKS_BASE_URL');
    this.historeyStocksAPIKey = this.configService.get<string>('HISTORY_STOCKS_API_KEY');
  }

  async getStockProfile(symbol: string): Promise<any> {
    const url = `${this.liveStocksBaseUrl}/stock/profile2?symbol=${symbol}&token=${this.liveStockApiKey}`;
    const response = await this.httpService.axiosRef.get(url);
    return response.data;
  }

  async getStockLiveData(symbol: string): Promise<any> {
    const url = `${this.liveStocksBaseUrl}/quote?symbol=${symbol}&token=${this.liveStockApiKey}`;
    const response = await this.httpService.axiosRef.get(url);
    return response.data;
  }

  async getAlphaVantageData(symbol: string): Promise<any> {
    const url = `${this.historeyStocksBaseUrl}?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${this.historeyStocksAPIKey}&outputsize=compact`;
    const response = await this.httpService.axiosRef.get(url);
    return response.data;
  }
}