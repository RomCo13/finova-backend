import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StocksService {
  private finnhubBaseUrl = 'https://finnhub.io/api/v1';
  private alphaVantageBaseUrl = 'https://www.alphavantage.co/query';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async getStockProfile(symbol: string): Promise<any> {
    const apiKey = this.configService.get<string>('FINNHUB_API_KEY');
    const url = `${this.finnhubBaseUrl}/stock/profile2?symbol=${symbol}&token=${apiKey}`;
    console.log(url);
    const response = await this.httpService.axiosRef.get(url);
    return response.data;
  }

  async getAlphaVantageData(symbol: string): Promise<any> {
    const apiKey = this.configService.get<string>('ALPHA_VANTAGE_API_KEY');
    const url = `${this.alphaVantageBaseUrl}?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${apiKey}&outputsize=compact`;
    const response = await this.httpService.axiosRef.get(url);
    return response.data;
  }
}