import { Controller, Get, Param, Query } from '@nestjs/common';
import { ChartService } from './chart.service';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ChartAnalysisResponse } from './interfaces/chart-analysis.interface';
import { ChartRequestDto } from './dto/chart-request.dto';
import { ChartDateRange } from '../ai/ai.service';

@ApiTags('charts')
@Controller('charts')
export class ChartController {
  constructor(private readonly chartService: ChartService) {}

  @Get(':symbol')
  @ApiOperation({
    summary: 'Capture TradingView chart for a symbol and get AI analysis',
  })
  @ApiParam({ name: 'symbol', description: 'Stock symbol (e.g., AAPL)' })
  @ApiQuery({
    name: 'dateRange',
    description: 'Date range for the chart analysis',
    enum: ChartDateRange,
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Returns the URL of the captured chart and AI analysis',
    type: ChartAnalysisResponse,
  })
  async captureChart(
    @Param('symbol') symbol: string,
    @Query() query: ChartRequestDto,
  ): Promise<ChartAnalysisResponse> {
    return this.chartService.captureChart(symbol, query.dateRange);
  }
}
