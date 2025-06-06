import { Injectable, Logger } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs';
import { AiService } from '../ai/ai.service';
import {
  ChartAnalysisResponse,
  ChartAnalysisSummary,
} from './interfaces/chart-analysis.interface';

@Injectable()
export class ChartService {
  private readonly logger = new Logger(ChartService.name);
  private readonly snapshotsDir = 'public/snapshots';

  constructor(private readonly aiService: AiService) {
    if (!fs.existsSync(this.snapshotsDir)) {
      fs.mkdirSync(this.snapshotsDir, { recursive: true });
    }
  }

  private async wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private parseAnalysis(analysis: string): ChartAnalysisSummary {
    const lines = analysis.split('\n');
    const summary: ChartAnalysisSummary = {
      trend: '',
      supportResistance: {
        support: [],
        resistance: [],
      },
      indicators: {
        rsi: '',
        macd: '',
        bollingerBands: '',
      },
      recommendations: [],
    };

    let currentSection = '';
    for (const line of lines) {
      if (line.includes('Overall Trend Analysis:')) {
        currentSection = 'trend';
        continue;
      } else if (line.includes('Key Support and Resistance Levels:')) {
        currentSection = 'supportResistance';
        continue;
      } else if (line.includes('Technical Indicators Interpretation:')) {
        currentSection = 'indicators';
        continue;
      } else if (line.includes('Trading Recommendations:')) {
        currentSection = 'recommendations';
        continue;
      }

      if (line.trim() && !line.startsWith('**')) {
        switch (currentSection) {
          case 'trend':
            summary.trend += line.trim() + ' ';
            break;
          case 'supportResistance':
            if (line.includes('Support:')) {
              summary.supportResistance.support.push(
                line.replace('* Support:', '').trim(),
              );
            } else if (line.includes('Resistance:')) {
              summary.supportResistance.resistance.push(
                line.replace('* Resistance:', '').trim(),
              );
            }
            break;
          case 'indicators':
            if (line.includes('RSI')) {
              summary.indicators.rsi = line.replace('* RSI:', '').trim();
            } else if (line.includes('MACD')) {
              summary.indicators.macd = line.replace('* MACD:', '').trim();
            } else if (line.includes('Bollinger Bands')) {
              summary.indicators.bollingerBands = line
                .replace('* Bollinger Bands:', '')
                .trim();
            }
            break;
          case 'recommendations':
            if (line.startsWith('*')) {
              summary.recommendations.push(line.replace('*', '').trim());
            }
            break;
        }
      }
    }

    // Clean up any extra whitespace
    summary.trend = summary.trend.trim();
    return summary;
  }

  async captureChart(symbol: string): Promise<ChartAnalysisResponse> {
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--window-size=2560,1440',
      ],
    });

    try {
      const page = await browser.newPage();
      await page.setViewport({
        width: 2560,
        height: 1440,
        deviceScaleFactor: 1.5,
      });

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>TradingView Chart</title>
          <style>
            html, body {
              margin: 0;
              padding: 0;
              width: 100%;
              height: 100%;
              overflow: hidden;
            }
            #tradingview_widget {
              width: 100%;
              height: 100vh;
              min-height: 100vh;
            }
          </style>
        </head>
        <body>
          <div id="tradingview_widget"></div>
          <script src="https://s3.tradingview.com/tv.js"></script>
          <script>
            new TradingView.widget({
              container_id: "tradingview_widget",
              symbol: "${symbol}",
              interval: "D",
              timezone: "Etc/UTC",
              theme: "dark",
              style: "1",
              locale: "en",
              toolbar_bg: "#f1f3f6",
              enable_publishing: false,
              allow_symbol_change: true,
              save_image: false,
              height: "100%",
              width: "100%",
              autosize: true,
              studies: [
                "RSI@tv-basicstudies",
                "MACD@tv-basicstudies",
                "BB@tv-basicstudies",
                "MASimple@tv-basicstudies"
              ]
            });
          </script>
        </body>
        </html>
      `;

      const tempHtmlPath = path.resolve(this.snapshotsDir, 'temp_chart.html');
      fs.writeFileSync(tempHtmlPath, htmlContent);

      const fileUrl = `file://${tempHtmlPath}`;
      this.logger.debug(`Loading chart from: ${fileUrl}`);

      await page.goto(fileUrl, {
        waitUntil: 'networkidle0',
        timeout: 60000,
      });

      await page.waitForSelector('#tradingview_widget', { timeout: 30000 });
      await this.wait(10000);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${symbol}_${timestamp}.png`;
      const filepath = path.join(this.snapshotsDir, filename);

      await page.screenshot({
        path: filepath as `${string}.png`,
        fullPage: true,
        omitBackground: true,
      });

      fs.unlinkSync(tempHtmlPath);

      this.logger.log(`Screenshot saved: ${filepath}`);
      const url = `/snapshots/${filename}`;

      const analysis = await this.aiService.analyzeChartImage(url);
      const summary = this.parseAnalysis(analysis.analysis);

      return {
        url,
        summary,
        detailedAnalysis: analysis.analysis,
        timestamp: analysis.timestamp,
        model: analysis.model,
      };
    } catch (error) {
      this.logger.error(
        `Failed to capture chart for ${symbol}: ${error.message}`,
      );
      throw error;
    } finally {
      await browser.close();
    }
  }
}
