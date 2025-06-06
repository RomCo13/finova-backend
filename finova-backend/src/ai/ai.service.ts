import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly geminiApiKey: string;
  private readonly geminiEndpoint =
    'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.geminiApiKey = this.configService.get<string>('AI_API_KEY');
    this.logger.log(
      `Initialized AiService with Gemini API key: ${this.geminiApiKey ? 'Present' : 'Missing'}`,
    );
  }

  async analyzeChartImage(imagePath: string): Promise<any> {
    try {
      // Remove leading slash if present and ensure we're reading from public directory
      const relativePath = imagePath.startsWith('/')
        ? imagePath.slice(1)
        : imagePath;
      const absolutePath = path.join(process.cwd(), 'public', relativePath);

      this.logger.debug(`Attempting to read image from: ${absolutePath}`);

      if (!fs.existsSync(absolutePath)) {
        throw new Error(`Image file not found at path: ${absolutePath}`);
      }

      const imageBuffer = fs.readFileSync(absolutePath);
      const base64Image = imageBuffer.toString('base64');
      this.logger.debug(
        `Successfully read image file, size: ${imageBuffer.length} bytes`,
      );

      const prompt = `Analyze this stock chart and provide a detailed technical analysis. Include:
1. Overall trend analysis
2. Key support and resistance levels
3. Technical indicators (RSI, MACD, Bollinger Bands) interpretation
4. Potential patterns (if any)
5. Trading recommendations based on the analysis
Please be specific and professional in your analysis.`;

      const requestBody = {
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: 'image/png',
                  data: base64Image,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          topK: 32,
          topP: 1,
          maxOutputTokens: 2048,
        },
      };

      this.logger.debug(
        `Sending request to Gemini API: ${this.geminiEndpoint}`,
      );
      console.log(`Request body from ${this.geminiEndpoint}`);

      const response = await this.httpService.axiosRef.post(
        `${this.geminiEndpoint}?key=${this.geminiApiKey}`,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      this.logger.debug('Received response from Gemini API');
      console.log('Response data:', JSON.stringify(response.data, null, 2));

      // Extract the analysis text from Gemini's response
      const analysis = response.data.candidates[0].content.parts[0].text;

      return {
        analysis,
        timestamp: new Date().toISOString(),
        model: 'gemini-1.5-flash',
      };
    } catch (error) {
      this.logger.error(`Failed to analyze chart image: ${error.message}`);
      if (error.response) {
        this.logger.error(`Response status: ${error.response.status}`);
        this.logger.error(
          `Response data: ${JSON.stringify(error.response.data)}`,
        );
      }
      throw error;
    }
  }
}
