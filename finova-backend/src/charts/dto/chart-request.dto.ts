import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ChartDateRange } from '../../ai/ai.service';

export class ChartRequestDto {
  @ApiProperty({
    description: 'Date range for the chart analysis',
    enum: ChartDateRange,
    default: ChartDateRange.ONE_MONTH,
    required: false,
  })
  @IsEnum(ChartDateRange)
  @IsOptional()
  dateRange?: ChartDateRange;
}
