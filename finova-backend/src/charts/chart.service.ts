import { Injectable, Logger } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs';
import { AiService } from '../ai/ai.service';
import {
  ChartAnalysisResponse,
  ChartAnalysisSummary,
  DetailedAnalysis,
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

  private cleanupSnapshot(filepath: string): void {
    try {
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        this.logger.debug(`Cleaned up snapshot: ${filepath}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to cleanup snapshot ${filepath}: ${error.message}`,
      );
    }
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

    let filepath: string;
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
      filepath = path.join(this.snapshotsDir, filename);

      await page.screenshot({
        path: filepath as `${string}.png`,
        fullPage: true,
        omitBackground: true,
      });

      fs.unlinkSync(tempHtmlPath);

      this.logger.log(`Screenshot saved: ${filepath}`);
      const url = `/snapshots/${filename}`;

      const analysis = await this.aiService.analyzeChartImage(url);

      // Clean up the snapshot after analysis is complete
      this.cleanupSnapshot(filepath);

      return {
        url,
        summary: analysis.summary,
        detailedAnalysis: analysis.detailedAnalysis,
        timestamp: analysis.timestamp,
        model: analysis.model,
      };
    } catch (error) {
      // Clean up the snapshot in case of error
      if (filepath) {
        this.cleanupSnapshot(filepath);
      }
      this.logger.error(
        `Failed to capture chart for ${symbol}: ${error.message}`,
      );
      throw error;
    } finally {
      await browser.close();
    }
  }
}
