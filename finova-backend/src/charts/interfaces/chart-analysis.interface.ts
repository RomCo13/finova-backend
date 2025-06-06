import { ApiProperty } from '@nestjs/swagger';

export class ChartAnalysisSummary {
  @ApiProperty({ description: 'Overall trend analysis of the stock' })
  trend: string;

  @ApiProperty({ description: 'Key support and resistance levels' })
  supportResistance: {
    support: string[];
    resistance: string[];
  };

  @ApiProperty({ description: 'Technical indicators interpretation' })
  indicators: {
    rsi: string;
    macd: string;
    bollingerBands: string;
  };

  @ApiProperty({ description: 'Trading recommendations' })
  recommendations: string[];
}

export class ChartAnalysisResponse {
  @ApiProperty({ description: 'URL of the captured chart image' })
  url: string;

  @ApiProperty({ description: 'Summary of the technical analysis' })
  summary: ChartAnalysisSummary;

  @ApiProperty({ description: 'Detailed analysis text' })
  detailedAnalysis: string;

  @ApiProperty({ description: 'Timestamp of the analysis' })
  timestamp: string;

  @ApiProperty({ description: 'AI model used for analysis' })
  model: string;
}
