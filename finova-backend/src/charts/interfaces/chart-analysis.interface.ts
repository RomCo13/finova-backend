import { ApiProperty } from '@nestjs/swagger';

export class ChartAnalysisSummary {
  @ApiProperty({ description: 'Current status of the stock' })
  currentStatus: string;

  @ApiProperty({
    description: 'Trading recommendation',
    enum: ['BUY', 'SELL', 'HOLD'],
  })
  recommendation: 'BUY' | 'SELL' | 'HOLD';

  @ApiProperty({
    description: 'Confidence level of the recommendation (0-100)',
  })
  confidence: number;

  @ApiProperty({ description: 'Short explanation of the recommendation' })
  shortExplanation: string;
}

export class DetailedAnalysis {
  @ApiProperty({
    description: 'Trend analysis including short-term and long-term trends',
  })
  trendAnalysis: string;

  @ApiProperty({ description: 'Support and resistance levels analysis' })
  supportResistance: string;

  @ApiProperty({ description: 'Technical indicators analysis' })
  technicalIndicators: string;

  @ApiProperty({ description: 'Chart patterns identified' })
  patterns: string;

  @ApiProperty({ description: 'Risk assessment and potential price targets' })
  riskAssessment: string;
}

export class ChartAnalysisResponse {
  @ApiProperty({ description: 'URL of the captured chart image' })
  url: string;

  @ApiProperty({ description: 'Summary of the technical analysis' })
  summary: ChartAnalysisSummary;

  @ApiProperty({ description: 'Detailed technical analysis' })
  detailedAnalysis: DetailedAnalysis;

  @ApiProperty({ description: 'Timestamp of the analysis' })
  timestamp: string;

  @ApiProperty({ description: 'AI model used for analysis' })
  model: string;
}
