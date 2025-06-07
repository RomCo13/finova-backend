import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

export enum ChartDateRange {
  ONE_DAY = '1D',
  FIVE_DAYS = '5D',
  TEN_DAYS = '10D',
  ONE_MONTH = '1M',
  SIX_MONTHS = '6M',
  ONE_YEAR = '1Y',
  FIVE_YEARS = '5Y',
  ALL_TIME = 'ALL',
}

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
    gapAnalysis: {
      hasGaps: boolean;
      gaps: Array<{
        type: 'UP' | 'DOWN';
        startPrice: number;
        endPrice: number;
        size: number;
        date?: string;
        isFilled: boolean;
      }>;
      analysis: string;
    };
  };
  timestamp: string;
  model: string;
  dateRange: ChartDateRange;
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

  async analyzeChartImage(
    imagePath: string,
    dateRange: ChartDateRange = ChartDateRange.ONE_MONTH,
  ): Promise<TechnicalAnalysis> {
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
You are a professional technical analyst. Your task is to analyze a stock chart based strictly on visible price action, candlestick patterns, RSI, MACD, Bollinger Bands, and trendlines.

📌 IMPORTANT:
- DO NOT guess or hallucinate data.
- Use only the visible data in the chart (or the provided data points).
- Reason step-by-step before giving the final output.
- All price targets must have EXACTLY 2 decimal places (e.g., 312.48, not 312 or 312.4).
- Follow the exact format below. Your response will be parsed into a JSON object.
- The chart shows data for the last ${this.getDateRangeDescription(dateRange)}.

👇 Begin your reasoning and analysis below.

1. **Indicator Review**:
   - RSI: [Insert RSI reading and whether it's overbought/neutral/oversold]
   - MACD: [State crossover status and histogram strength]
   - Bollinger Bands: [Is price near upper, lower, or middle band? Any squeeze/breakout?]
   - Trend: [Describe short-term and long-term trendlines]
   - Patterns: [Mention any visible patterns such as Double Bottom, Cup and Handle, Triangle, etc.]

2. **Support & Resistance Identification**:
   - Key Support Levels: [List specific levels]
   - Key Resistance Levels: [List specific levels]

3. **Gap Analysis**:
   - Identify any price gaps in the chart
   - For each gap, note:
     * Type (UP/DOWN)
     * Start and end prices (with 2 decimal places)
     * Gap size
     * Whether the gap has been filled
     * Approximate date if visible
   - Analyze the significance of gaps in the current context

4. **Recommendation Logic**:
   - Based on indicators, patterns, and levels, state if the stock is in a BUY / SELL / HOLD zone.
   - Consider risk-reward ratio.
   - If indicators are aligned, confidence increases. If conflicting, lower the confidence score.

5. **Confidence Scoring (0–100)**:
   Use the following rubric:
   - 90–100: All indicators aligned (very high confidence)
   - 70–89: Most indicators aligned, trend supports idea
   - 50–69: Mixed signals or medium conviction
   - Below 50: Indicators conflict or weak trend

📤 Final Output (fill this exactly):

Current Status: [One-line summary of the stock's position, e.g., "Stock is in a bullish breakout phase"]
Recommendation: [BUY / SELL / HOLD]
Confidence: [0–100]
Short Explanation: [2–3 sentences summarizing the logic]
Support Price: [e.g., 289.41]
Resistance Price: [e.g., 314.55]
Stop Loss Price: [e.g., 282.00]
Take Profit Price: [e.g., 331.75]

Trend Analysis: [Explain short-term and long-term trends]
Support and Resistance: [Explain how levels were determined]
Technical Indicators: [Summarize the RSI, MACD, and BB status]
Patterns: [Mention and describe any chart patterns]
Risk Assessment: [Comment on volatility, potential losses vs. gains, risk-reward]
Current Technical Position: [Describe the current position relative to major indicators/trendlines]
Gap Analysis: [Describe any price gaps found, their significance, and whether they've been filled]

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
    "currentTechnicalPosition": "string",
    "gapAnalysis": {
      "hasGaps": "boolean",
      "gaps": [
        {
          "type": "UP/DOWN",
          "startPrice": "number with 2 decimal places",
          "endPrice": "number with 2 decimal places",
          "size": "number with 2 decimal places",
          "date": "string (optional)",
          "isFilled": "boolean"
        }
      ],
      "analysis": "string"
    }
  }
}

DO NOT DEVIATE from the format. Use logic and consistency across all values.`;

      let analysis = await this.makeGeminiRequest(detailedPrompt, base64Image);
      this.logger.debug('Raw AI Response:', analysis);

      // Try to parse as JSON first
      let parsedAnalysis = this.tryParseJson(analysis);

      // If JSON parsing fails, try text parsing
      if (!parsedAnalysis) {
        parsedAnalysis = this.parseTextAnalysis(analysis);
      }

      // Add date range to the analysis
      parsedAnalysis.dateRange = dateRange;

      // Validate and fill in missing fields
      let validatedAnalysis = this.validateAndFillAnalysis(parsedAnalysis);

      // If we're missing too many critical fields, try with a simpler prompt
      const missingFields = this.validateAnalysis(validatedAnalysis);
      if (missingFields.length > 3) {
        this.logger.warn(
          `First attempt failed. Missing fields: ${missingFields.join(', ')}. Retrying with simpler prompt...`,
        );

        const simplePrompt = `Analyze this stock chart and provide a technical analysis. The chart shows data for the last ${this.getDateRangeDescription(dateRange)}. Your response MUST follow this EXACT format:

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

        // Add date range to the analysis
        parsedAnalysis.dateRange = dateRange;

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

  private getDateRangeDescription(dateRange: ChartDateRange): string {
    switch (dateRange) {
      case ChartDateRange.ONE_DAY:
        return '24 hours';
      case ChartDateRange.FIVE_DAYS:
        return '5 days';
      case ChartDateRange.TEN_DAYS:
        return '10 days';
      case ChartDateRange.ONE_MONTH:
        return '1 month';
      case ChartDateRange.SIX_MONTHS:
        return '6 months';
      case ChartDateRange.ONE_YEAR:
        return '1 year';
      case ChartDateRange.FIVE_YEARS:
        return '5 years';
      case ChartDateRange.ALL_TIME:
        return 'all available time';
      default:
        return '1 month';
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
          gapAnalysis: {
            hasGaps: parsed.detailedAnalysis.gapAnalysis?.hasGaps || false,
            gaps: parsed.detailedAnalysis.gapAnalysis?.gaps || [],
            analysis: parsed.detailedAnalysis.gapAnalysis?.analysis || '',
          },
        },
        timestamp: new Date().toISOString(),
        model: 'gemini-1.5-flash',
        dateRange: parsed.dateRange || ChartDateRange.ONE_MONTH,
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
        gapAnalysis: {
          hasGaps: false,
          gaps: [],
          analysis: '',
        },
      },
      timestamp: new Date().toISOString(),
      model: 'gemini-1.5-flash',
      dateRange: ChartDateRange.ONE_MONTH,
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
        /Risk Assessment: (.*?)(?:\n(?:Current|Gap)|$)/s,
      );
      const positionMatch = detailedSection.match(
        /Current Technical Position: (.*?)(?:\n(?:Gap|$)|$)/s,
      );
      const gapMatch = detailedSection.match(/Gap Analysis: (.*?)(?:\n\n|$)/s);

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
      if (gapMatch) {
        parsedAnalysis.detailedAnalysis.gapAnalysis.analysis =
          gapMatch[1].trim();
        // Try to extract gap information from the analysis
        const gapInfo = this.extractGapInfo(gapMatch[1]);
        parsedAnalysis.detailedAnalysis.gapAnalysis.hasGaps = gapInfo.hasGaps;
        parsedAnalysis.detailedAnalysis.gapAnalysis.gaps = gapInfo.gaps;
      }
    }

    return parsedAnalysis;
  }

  private extractGapInfo(gapAnalysis: string): {
    hasGaps: boolean;
    gaps: any[];
  } {
    const gaps: any[] = [];
    const gapMatches = gapAnalysis.matchAll(
      /(?:gap|break|jump)(?:\s+of\s+|\s+at\s+|\s+from\s+|\s+to\s+|\s+between\s+)([\d.]+)(?:\s+to\s+|\s+and\s+)([\d.]+)/gi,
    );

    for (const match of gapMatches) {
      const startPrice = this.extractPrice(match[1]);
      const endPrice = this.extractPrice(match[2]);

      if (startPrice !== null && endPrice !== null) {
        gaps.push({
          type: endPrice > startPrice ? 'UP' : 'DOWN',
          startPrice,
          endPrice,
          size: Math.abs(endPrice - startPrice),
          isFilled: gapAnalysis.toLowerCase().includes('filled'),
        });
      }
    }

    return {
      hasGaps: gaps.length > 0,
      gaps,
    };
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
        gapAnalysis: {
          hasGaps: analysis.detailedAnalysis.gapAnalysis?.hasGaps || false,
          gaps: analysis.detailedAnalysis.gapAnalysis?.gaps || [],
          analysis:
            analysis.detailedAnalysis.gapAnalysis?.analysis ||
            'No gap analysis available',
        },
      },
      timestamp: analysis.timestamp,
      model: analysis.model,
      dateRange: analysis.dateRange || ChartDateRange.ONE_MONTH,
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
