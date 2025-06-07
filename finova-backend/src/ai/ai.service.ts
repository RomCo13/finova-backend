import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

interface TechnicalAnalysis {
  summary: {
    currentStatus: string;
    recommendation: 'BUY' | 'SELL' | 'HOLD';
    confidence: number; // 0-100
    shortExplanation: string;
    priceTargets: {
      supportPrice: number | null;
      resistancePrice: number | null;
      stopLossPrice: number | null;
      takeProfitPrice: number | null;
    };
  };
  detailedAnalysis: {
    trendAnalysis: string;
    supportResistance: string;
    technicalIndicators: string;
    patterns: string;
    riskAssessment: string;
    currentTechnicalPosition: string;
  };
  timestamp: string;
  model: string;
}

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

  private async makeGeminiRequest(
    prompt: string,
    base64Image: string,
  ): Promise<any> {
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
        temperature: 0,
        topK: 32,
        topP: 1,
        maxOutputTokens: 2048,
      },
    };

    const response = await this.httpService.axiosRef.post(
      `${this.geminiEndpoint}?key=${this.geminiApiKey}`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    return response.data.candidates[0].content.parts[0].text;
  }

  async analyzeChartImage(imagePath: string): Promise<TechnicalAnalysis> {
    try {
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

      // First attempt with detailed prompt
      const detailedPrompt = `
You are a professional stock analyst. Based strictly on the attached stock chart's candlestick patterns, trendlines, RSI, MACD, and Bollinger Bands, provide a precise technical analysis.

Think step-by-step, and validate each indicator against the chart. Do NOT invent data — use only what is visible. Use consistent logic. Then format your answer in the exact format below.

Current Status: [One-line status]
Recommendation: [BUY/SELL/HOLD]
Confidence: [0-100, whole number only]
Short Explanation: [2-3 sentences]
Support Price: [Exact number with 2 decimal places, e.g., 292.17]
Resistance Price: [Exact number with 2 decimal places]
Stop Loss Price: [Exact number with 2 decimal places]
Take Profit Price: [Exact number with 2 decimal places]

Trend Analysis: [Describe short- and long-term trends based on chart]
Support and Resistance: [Identify exact visible levels]
Technical Indicators: [Analyze RSI, MACD crossover, Bollinger Band behavior]
Patterns: [Mention any clear chart patterns: e.g., Double Bottom, Head & Shoulders]
Risk Assessment: [Assess based on volatility, volume, and stop loss range]
Current Technical Position: [Where is price relative to indicators and trend lines]

Your response will be parsed into this JSON structure:
{
  "summary": {
    "currentStatus": "string",
    "recommendation": "BUY/SELL/HOLD",
    "confidence": "number",
    "shortExplanation": "string",
    "priceTargets": {
      "supportPrice": "number with 2 decimal places",
      "resistancePrice": "number with 2 decimal places",
      "stopLossPrice": "number with 2 decimal places",
      "takeProfitPrice": "number with 2 decimal places"
    }
  },
  "detailedAnalysis": {
    "trendAnalysis": "string",
    "supportResistance": "string",
    "technicalIndicators": "string",
    "patterns": "string",
    "riskAssessment": "string",
    "currentTechnicalPosition": "string"
  }
}

IMPORTANT:
- Do NOT skip any fields.
- Do NOT round prices. Use exactly 2 decimal places.
- Follow the exact headers and format shown.
- Use only chart-visible data.
- Be consistent in logic across all sections.
`;

      let analysis = await this.makeGeminiRequest(detailedPrompt, base64Image);
      this.logger.debug('Raw AI Response:', analysis);

      // Try to parse as JSON first
      let parsedAnalysis = this.tryParseJson(analysis);

      // If JSON parsing fails, try text parsing
      if (!parsedAnalysis) {
        parsedAnalysis = this.parseTextAnalysis(analysis);
      }

      // Validate and fill in missing fields
      let validatedAnalysis = this.validateAndFillAnalysis(parsedAnalysis);

      // If we're missing too many critical fields, try with a simpler prompt
      const missingFields = this.validateAnalysis(validatedAnalysis);
      if (missingFields.length > 3) {
        this.logger.warn(
          `First attempt failed. Missing fields: ${missingFields.join(', ')}. Retrying with simpler prompt...`,
        );

        const simplePrompt = `Analyze this stock chart and provide a technical analysis. Your response MUST follow this EXACT format:

Current Status: [One line status]
Recommendation: [BUY/SELL/HOLD]
Confidence: [0-100]
Short Explanation: [2-3 sentences]
Support Price: [Key support level as a precise number with 2 decimal places, e.g., 292.17]
Resistance Price: [Key resistance level as a precise number with 2 decimal places, e.g., 335.42]
Stop Loss Price: [Recommended stop loss level as a precise number with 2 decimal places, e.g., 275.83]
Take Profit Price: [Recommended take profit level as a precise number with 2 decimal places, e.g., 375.25]

Trend Analysis: [Analyze trends]
Support and Resistance: [List levels]
Technical Indicators: [Analyze RSI, MACD, BB]
Patterns: [Identify patterns]
Risk Assessment: [Evaluate risk]
Current Technical Position: [Detail current position]

Your response will be parsed into this JSON structure:
{
  "summary": {
    "currentStatus": "string",
    "recommendation": "BUY/SELL/HOLD",
    "confidence": "number",
    "shortExplanation": "string",
    "priceTargets": {
      "supportPrice": "number with 2 decimal places",
      "resistancePrice": "number with 2 decimal places",
      "stopLossPrice": "number with 2 decimal places",
      "takeProfitPrice": "number with 2 decimal places"
    }
  },
  "detailedAnalysis": {
    "trendAnalysis": "string",
    "supportResistance": "string",
    "technicalIndicators": "string",
    "patterns": "string",
    "riskAssessment": "string",
    "currentTechnicalPosition": "string"
  }
}

IMPORTANT: Follow the exact format above. Each line must start with the exact header text shown. Price targets must be specific numbers with exactly 2 decimal places (e.g., 292.17, not 292 or 292.2). Do not round prices to whole numbers - always use 2 decimal places for precision.`;

        analysis = await this.makeGeminiRequest(simplePrompt, base64Image);
        this.logger.debug('Raw AI Response (Retry):', analysis);

        // Try to parse as JSON first
        parsedAnalysis = this.tryParseJson(analysis);

        // If JSON parsing fails, try text parsing
        if (!parsedAnalysis) {
          parsedAnalysis = this.parseTextAnalysis(analysis);
        }

        // Validate and fill in missing fields
        validatedAnalysis = this.validateAndFillAnalysis(parsedAnalysis);
      }

      return validatedAnalysis;
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

  private tryParseJson(analysis: string): TechnicalAnalysis | null {
    try {
      // Try to extract JSON from markdown code block if present
      const jsonMatch = analysis.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : analysis;

      const parsed = JSON.parse(jsonStr);

      // Validate the structure
      if (!parsed.summary || !parsed.detailedAnalysis) {
        return null;
      }

      return {
        summary: {
          currentStatus: parsed.summary.currentStatus || '',
          recommendation: parsed.summary.recommendation || 'HOLD',
          confidence:
            typeof parsed.summary.confidence === 'string'
              ? parseInt(parsed.summary.confidence)
              : parsed.summary.confidence || 50,
          shortExplanation: parsed.summary.shortExplanation || '',
          priceTargets: {
            supportPrice: this.extractPrice(
              parsed.summary.priceTargets?.supportPrice,
            ),
            resistancePrice: this.extractPrice(
              parsed.summary.priceTargets?.resistancePrice,
            ),
            stopLossPrice: this.extractPrice(
              parsed.summary.priceTargets?.stopLossPrice,
            ),
            takeProfitPrice: this.extractPrice(
              parsed.summary.priceTargets?.takeProfitPrice,
            ),
          },
        },
        detailedAnalysis: {
          trendAnalysis: parsed.detailedAnalysis.trendAnalysis || '',
          supportResistance: parsed.detailedAnalysis.supportResistance || '',
          technicalIndicators:
            parsed.detailedAnalysis.technicalIndicators || '',
          patterns: parsed.detailedAnalysis.patterns || '',
          riskAssessment: parsed.detailedAnalysis.riskAssessment || '',
          currentTechnicalPosition:
            parsed.detailedAnalysis.currentTechnicalPosition || '',
        },
        timestamp: new Date().toISOString(),
        model: 'gemini-1.5-flash',
      };
    } catch (error) {
      this.logger.debug('Failed to parse JSON response:', error.message);
      return null;
    }
  }

  private extractPrice(value: any): number | null {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      // Remove currency symbols and commas, then parse
      const cleanValue = value.replace(/[$,]/g, '');
      const num = parseFloat(cleanValue);
      return isNaN(num) ? null : num;
    }
    return null;
  }

  private parseTextAnalysis(analysis: string): TechnicalAnalysis {
    const sections = analysis.split('\n\n');
    const summarySection = sections.find(
      (s) => s.includes('SUMMARY SECTION') || s.includes('Current Status:'),
    );
    const detailedSection = sections.find(
      (s) =>
        s.includes('DETAILED ANALYSIS SECTION') ||
        s.includes('Trend Analysis:'),
    );

    const parsedAnalysis: TechnicalAnalysis = {
      summary: {
        currentStatus: '',
        recommendation: 'HOLD',
        confidence: 50,
        shortExplanation: '',
        priceTargets: {
          supportPrice: null,
          resistancePrice: null,
          stopLossPrice: null,
          takeProfitPrice: null,
        },
      },
      detailedAnalysis: {
        trendAnalysis: '',
        supportResistance: '',
        technicalIndicators: '',
        patterns: '',
        riskAssessment: '',
        currentTechnicalPosition: '',
      },
      timestamp: new Date().toISOString(),
      model: 'gemini-1.5-flash',
    };

    // Extract summary information
    if (summarySection) {
      const statusMatch = summarySection.match(/Current Status: (.*?)(?:\n|$)/);
      const recommendationMatch = summarySection.match(
        /Recommendation: (BUY|SELL|HOLD)/,
      );
      const confidenceMatch = summarySection.match(/Confidence: (\d+)/);
      const explanationMatch = summarySection.match(
        /Short Explanation: (.*?)(?:\n\n|$)/s,
      );

      // Extract price targets
      const supportMatch = summarySection.match(/Support Price: ([\d.,]+)/);
      const resistanceMatch = summarySection.match(
        /Resistance Price: ([\d.,]+)/,
      );
      const stopLossMatch = summarySection.match(/Stop Loss Price: ([\d.,]+)/);
      const takeProfitMatch = summarySection.match(
        /Take Profit Price: ([\d.,]+)/,
      );

      if (statusMatch)
        parsedAnalysis.summary.currentStatus = statusMatch[1].trim();
      if (recommendationMatch)
        parsedAnalysis.summary.recommendation = recommendationMatch[1] as
          | 'BUY'
          | 'SELL'
          | 'HOLD';
      if (confidenceMatch)
        parsedAnalysis.summary.confidence = parseInt(confidenceMatch[1]);
      if (explanationMatch)
        parsedAnalysis.summary.shortExplanation = explanationMatch[1].trim();

      if (supportMatch)
        parsedAnalysis.summary.priceTargets.supportPrice = this.extractPrice(
          supportMatch[1],
        );
      if (resistanceMatch)
        parsedAnalysis.summary.priceTargets.resistancePrice = this.extractPrice(
          resistanceMatch[1],
        );
      if (stopLossMatch)
        parsedAnalysis.summary.priceTargets.stopLossPrice = this.extractPrice(
          stopLossMatch[1],
        );
      if (takeProfitMatch)
        parsedAnalysis.summary.priceTargets.takeProfitPrice = this.extractPrice(
          takeProfitMatch[1],
        );
    }

    // Extract detailed analysis
    if (detailedSection) {
      const trendMatch = detailedSection.match(
        /Trend Analysis: (.*?)(?:\n(?:Support|Technical)|$)/s,
      );
      const supportMatch = detailedSection.match(
        /Support and Resistance: (.*?)(?:\n(?:Technical|Patterns)|$)/s,
      );
      const indicatorsMatch = detailedSection.match(
        /Technical Indicators: (.*?)(?:\n(?:Patterns|Risk)|$)/s,
      );
      const patternsMatch = detailedSection.match(
        /Patterns: (.*?)(?:\n(?:Risk|Current)|$)/s,
      );
      const riskMatch = detailedSection.match(
        /Risk Assessment: (.*?)(?:\n(?:Current|$)|$)/s,
      );
      const positionMatch = detailedSection.match(
        /Current Technical Position: (.*?)(?:\n\n|$)/s,
      );

      if (trendMatch)
        parsedAnalysis.detailedAnalysis.trendAnalysis = trendMatch[1].trim();
      if (supportMatch)
        parsedAnalysis.detailedAnalysis.supportResistance =
          supportMatch[1].trim();
      if (indicatorsMatch)
        parsedAnalysis.detailedAnalysis.technicalIndicators =
          indicatorsMatch[1].trim();
      if (patternsMatch)
        parsedAnalysis.detailedAnalysis.patterns = patternsMatch[1].trim();
      if (riskMatch)
        parsedAnalysis.detailedAnalysis.riskAssessment = riskMatch[1].trim();
      if (positionMatch)
        parsedAnalysis.detailedAnalysis.currentTechnicalPosition =
          positionMatch[1].trim();
    }

    return parsedAnalysis;
  }

  private validateAndFillAnalysis(
    analysis: TechnicalAnalysis,
  ): TechnicalAnalysis {
    // Ensure all fields have at least default values
    return {
      summary: {
        currentStatus: analysis.summary.currentStatus || 'Status not available',
        recommendation: analysis.summary.recommendation || 'HOLD',
        confidence: analysis.summary.confidence || 50,
        shortExplanation:
          analysis.summary.shortExplanation || 'No explanation available',
        priceTargets: {
          supportPrice: analysis.summary.priceTargets?.supportPrice || null,
          resistancePrice:
            analysis.summary.priceTargets?.resistancePrice || null,
          stopLossPrice: analysis.summary.priceTargets?.stopLossPrice || null,
          takeProfitPrice:
            analysis.summary.priceTargets?.takeProfitPrice || null,
        },
      },
      detailedAnalysis: {
        trendAnalysis:
          analysis.detailedAnalysis.trendAnalysis ||
          'Trend analysis not available',
        supportResistance:
          analysis.detailedAnalysis.supportResistance ||
          'Support and resistance levels not available',
        technicalIndicators:
          analysis.detailedAnalysis.technicalIndicators ||
          'Technical indicators analysis not available',
        patterns:
          analysis.detailedAnalysis.patterns || 'No patterns identified',
        riskAssessment:
          analysis.detailedAnalysis.riskAssessment ||
          'Risk assessment not available',
        currentTechnicalPosition:
          analysis.detailedAnalysis.currentTechnicalPosition ||
          'Current technical position not available',
      },
      timestamp: analysis.timestamp,
      model: analysis.model,
    };
  }

  private validateAnalysis(analysis: TechnicalAnalysis): string[] {
    const missingFields = [];
    if (!analysis.summary.currentStatus) missingFields.push('Current Status');
    if (!analysis.summary.shortExplanation)
      missingFields.push('Short Explanation');
    if (!analysis.detailedAnalysis.trendAnalysis)
      missingFields.push('Trend Analysis');
    if (!analysis.detailedAnalysis.supportResistance)
      missingFields.push('Support and Resistance');
    if (!analysis.detailedAnalysis.technicalIndicators)
      missingFields.push('Technical Indicators');
    if (!analysis.detailedAnalysis.patterns) missingFields.push('Patterns');
    if (!analysis.detailedAnalysis.riskAssessment)
      missingFields.push('Risk Assessment');
    if (!analysis.detailedAnalysis.currentTechnicalPosition)
      missingFields.push('Current Technical Position');
    return missingFields;
  }
}
