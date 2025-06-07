import { Injectable, Logger } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs';
import { AiService, ChartDateRange } from '../ai/ai.service';
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

  private getTradingViewInterval(dateRange: ChartDateRange): string {
    switch (dateRange) {
      case ChartDateRange.ONE_DAY:
        return '5'; // 5-minute intervals
      case ChartDateRange.FIVE_DAYS:
        return '15'; // 15-minute intervals
      case ChartDateRange.TEN_DAYS:
        return '30'; // 30-minute intervals
      case ChartDateRange.ONE_MONTH:
        return '60'; // 1-hour intervals
      case ChartDateRange.SIX_MONTHS:
        return 'D'; // Daily intervals
      case ChartDateRange.ONE_YEAR:
        return 'W'; // Weekly intervals
      case ChartDateRange.FIVE_YEARS:
        return 'M'; // Monthly intervals
      case ChartDateRange.ALL_TIME:
        return 'M'; // Monthly intervals
      default:
        return 'D'; // Default to daily
    }
  }

  private getTradingViewRange(dateRange: ChartDateRange): string {
    switch (dateRange) {
      case ChartDateRange.ONE_DAY:
        return '1D';
      case ChartDateRange.FIVE_DAYS:
        return '5D';
      case ChartDateRange.TEN_DAYS:
        return '10D';
      case ChartDateRange.ONE_MONTH:
        return '1M';
      case ChartDateRange.SIX_MONTHS:
        return '6M';
      case ChartDateRange.ONE_YEAR:
        return '12M';
      case ChartDateRange.FIVE_YEARS:
        return '60M';
      case ChartDateRange.ALL_TIME:
        return 'ALL';
      default:
        return '1M';
    }
  }

  private createTradingViewHtml(
    symbol: string,
    dateRange: ChartDateRange,
  ): string {
    const range = this.getTradingViewRange(dateRange);
    const interval = this.getTradingViewInterval(dateRange);

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>TradingView Chart</title>
          <script type="text/javascript" src="https://s3.tradingview.com/tv.js"></script>
          <style>
            html, body {
              margin: 0;
              padding: 0;
              width: 100%;
              height: 100%;
              background: #131722;
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
          <script type="text/javascript">
            new TradingView.widget({
              "container_id": "tradingview_widget",
              "symbol": "${symbol}",
              "interval": "${interval}",
              "timezone": "Etc/UTC",
              "theme": "dark",
              "style": "1",
              "locale": "en",
              "toolbar_bg": "#f1f3f6",
              "enable_publishing": false,
              "allow_symbol_change": true,
              "save_image": false,
              "height": "100%",
              "width": "100%",
              "autosize": true,
              "range": "${range}",
              "studies": [
                "RSI@tv-basicstudies",
                "MACD@tv-basicstudies",
                "BB@tv-basicstudies",
                "MASimple@tv-basicstudies"
              ],
              "hideideas": true,
              "show_popup_button": true,
              "popup_width": "1000",
              "popup_height": "650",
              "hide_side_toolbar": false,
              "withdateranges": true,
              "studies_overrides": {
                "volume.volume.color.0": "#ff0000",
                "volume.volume.color.1": "#00ff00"
              },
              "overrides": {
                "mainSeriesProperties.candleStyle.upColor": "#26a69a",
                "mainSeriesProperties.candleStyle.downColor": "#ef5350",
                "mainSeriesProperties.candleStyle.borderUpColor": "#26a69a",
                "mainSeriesProperties.candleStyle.borderDownColor": "#ef5350",
                "mainSeriesProperties.candleStyle.wickUpColor": "#26a69a",
                "mainSeriesProperties.candleStyle.wickDownColor": "#ef5350"
              },
              "loading_screen": { "backgroundColor": "#131722" }
            });
          </script>
        </body>
      </html>
    `;
  }

  async captureChart(
    symbol: string,
    dateRange: ChartDateRange = ChartDateRange.ONE_MONTH,
  ): Promise<ChartAnalysisResponse> {
    let browser;
    let filepath: string;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--start-maximized',
        ],
        defaultViewport: null,
      });

      const page = await browser.newPage();
      await page.setViewport({
        width: 2560,
        height: 1440,
        deviceScaleFactor: 1.5,
      });

      this.logger.debug(
        `Starting chart capture for ${symbol} with date range ${dateRange}`,
      );

      const htmlContent = this.createTradingViewHtml(symbol, dateRange);
      const tempHtmlPath = path.resolve(this.snapshotsDir, 'temp_chart.html');
      fs.writeFileSync(tempHtmlPath, htmlContent);

      const fileUrl = `file://${tempHtmlPath}`;
      this.logger.debug(`Loading chart from: ${fileUrl}`);

      await page.goto(fileUrl, {
        waitUntil: 'networkidle0',
        timeout: 60000,
      });

      await page.waitForSelector('#tradingview_widget', {
        timeout: 60000,
        visible: true,
      });

      // Ensure the chart is fully loaded
      this.logger.debug(`Ensuring chart is fully loaded...`);
      await this.wait(10000);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${symbol}_${timestamp}.png`;
      filepath = path.join(this.snapshotsDir, filename);

      this.logger.debug(`Taking screenshot...`);
      await page.screenshot({
        path: filepath as `${string}.png`,
        fullPage: true,
        omitBackground: true,
      });

      this.logger.debug(`Screenshot saved to ${filepath}`);

      const url = `/snapshots/${filename}`;
      this.logger.debug(`Starting AI analysis...`);
      const analysis = await this.aiService.analyzeChartImage(url, dateRange);

      // Clean up the snapshot after analysis is complete
      this.cleanupSnapshot(filepath);

      return {
        url,
        summary: analysis.summary,
        detailedAnalysis: analysis.detailedAnalysis,
        timestamp: analysis.timestamp,
        model: analysis.model,
        dateRange: analysis.dateRange,
      };
    } catch (error) {
      // Clean up the snapshot in case of error
      if (filepath) {
        this.cleanupSnapshot(filepath);
      }
      this.logger.error(`Failed to capture chart: ${error.message}`);
      throw error;
    } finally {
      if (browser) {
        this.logger.debug(`Closing browser...`);
        await browser.close();
      }
      // Clean up the temporary HTML file
      const tempHtmlPath = path.join(this.snapshotsDir, 'temp_chart.html');
      if (fs.existsSync(tempHtmlPath)) {
        this.logger.debug(`Cleaning up temporary HTML file...`);
        fs.unlinkSync(tempHtmlPath);
      }
    }
  }
}
