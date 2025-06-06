import { Module } from '@nestjs/common';
import { ChartService } from './chart.service';
import { ChartController } from './chart.controller';

@Module({
  providers: [ChartService],
  controllers: [ChartController],
  exports: [ChartService],
})
export class ChartModule {}
