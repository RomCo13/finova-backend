import { Injectable, Logger } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs';

interface DateRange {
  from?: string;
  to?: string;
}

@Injectable()
export class ChartService {
  private readonly logger = new Logger(ChartService.name);
  private readonly snapshotsDir = 'public/snapshots';

  constructor() {
    if (!fs.existsSync(this.snapshotsDir)) {
      fs.mkdirSync(this.snapshotsDir, { recursive: true });
    }
  }

  private async wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private validateDateRange(dateRange: DateRange): void {
    if (dateRange.from && !this.isValidDate(dateRange.from)) {
      throw new Error('Invalid from date format. Use YYYY-MM-DD');
    }
    if (dateRange.to && !this.isValidDate(dateRange.to)) {
      throw new Error('Invalid to date format. Use YYYY-MM-DD');
    }
    if (dateRange.from && dateRange.to) {
      const fromDate = new Date(dateRange.from);
      const toDate = new Date(dateRange.to);
      if (fromDate > toDate) {
        throw new Error('From date must be before to date');
      }
    }
  }

  private isValidDate(dateString: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) return false;

    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  }

  async captureChart(symbol: string, dateRange?: DateRange): Promise<string> {
    if (dateRange) {
      this.validateDateRange(dateRange);
    }

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--window-size=2560,1440', // Set initial window size
      ],
    });

    try {
      const page = await browser.newPage();
      // Set a larger viewport size for better quality
      await page.setViewport({
        width: 2560,
        height: 1440,
        deviceScaleFactor: 1.5, // Increase resolution
      });

      // Create a temporary HTML file with the TradingView widget
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
            const widget = new TradingView.widget({
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
              ],
              ${
                dateRange
                  ? `
              range: "${dateRange.from ? dateRange.from : ''} - ${dateRange.to ? dateRange.to : ''}",
              `
                  : ''
              }
            });

            // Wait for the chart to be ready
            widget.onChartReady(() => {
              console.log('Chart is ready');
            });
          </script>
        </body>
        </html>
      `;

      // Use absolute path for the temporary file
      const tempHtmlPath = path.resolve(this.snapshotsDir, 'temp_chart.html');
      fs.writeFileSync(tempHtmlPath, htmlContent);

      // Load the temporary HTML file using file:// protocol with absolute path
      const fileUrl = `file://${tempHtmlPath}`;
      this.logger.debug(`Loading chart from: ${fileUrl}`);

      await page.goto(fileUrl, {
        waitUntil: 'networkidle0',
        timeout: 60000,
      });

      // Wait for the chart to load
      await page.waitForSelector('#tradingview_widget', { timeout: 30000 });

      // Wait for indicators to load
      await this.wait(10000);

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${symbol}_${timestamp}.png`;
      const filepath = path.join(this.snapshotsDir, filename);

      // Take screenshot of the chart with full page
      await page.screenshot({
        path: filepath as `${string}.png`,
        fullPage: true,
        omitBackground: true, // Remove background for better quality
      });

      // Clean up temporary file
      fs.unlinkSync(tempHtmlPath);

      this.logger.log(`Screenshot saved: ${filepath}`);
      return `/snapshots/${filename}`;
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
