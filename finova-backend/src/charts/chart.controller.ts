import { Controller, Get, Param } from '@nestjs/common';
import { ChartService } from './chart.service';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ChartAnalysisResponse } from './interfaces/chart-analysis.interface';

@ApiTags('charts')
@Controller('charts')
export class ChartController {
  constructor(private readonly chartService: ChartService) {}

  @Get(':symbol')
  @ApiOperation({
    summary: 'Capture TradingView chart for a symbol and get AI analysis',
  })
  @ApiParam({ name: 'symbol', description: 'Stock symbol (e.g., AAPL)' })
  @ApiResponse({
    status: 200,
    description: 'Returns the URL of the captured chart and AI analysis',
    type: ChartAnalysisResponse,
  })
  async captureChart(
    @Param('symbol') symbol: string,
  ): Promise<ChartAnalysisResponse> {
    return this.chartService.captureChart(symbol);
  }
}
