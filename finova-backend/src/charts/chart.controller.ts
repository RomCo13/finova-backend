import { Controller, Get, Param } from '@nestjs/common';
import { ChartService } from './chart.service';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('charts')
@Controller('charts')
export class ChartController {
  constructor(private readonly chartService: ChartService) {}

  @Get(':symbol')
  @ApiOperation({ summary: 'Capture TradingView chart for a symbol' })
  @ApiParam({ name: 'symbol', description: 'Stock symbol (e.g., AAPL)' })
  @ApiResponse({
    status: 200,
    description: 'Returns the URL of the captured chart',
  })
  async captureChart(
    @Param('symbol') symbol: string,
  ): Promise<{ url: string }> {
    const url = await this.chartService.captureChart(symbol);
    return { url };
  }
}
