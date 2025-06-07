import { Module } from '@nestjs/common';
import { ChartService } from './chart.service';
import { ChartController } from './chart.controller';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  providers: [ChartService],
  controllers: [ChartController],
  exports: [ChartService],
})
export class ChartModule {}
