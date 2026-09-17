import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_EVALUATOR_PROMPT } from './gemini-evaluator.prompt';

export interface ImagePart {
  buffer: Buffer;
  mimeType: string;
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);

  constructor(private readonly config: ConfigService) {}

  async evaluateExamImages(images: ImagePart[]): Promise<string> {
    const apiKey = this.config.getOrThrow<string>('GEMINI_API_KEY');
    const modelId =
      this.config.get<string>('GEMINI_MODEL') ?? 'gemini-2.0-flash';

    const genAi = new GoogleGenerativeAI(apiKey);
    const model = genAi.getGenerativeModel({ model: modelId });

    const parts: Array<
      { text: string } | { inlineData: { data: string; mimeType: string } }
    > = [
      { text: GEMINI_EVALUATOR_PROMPT },
      ...images.map((img) => ({
        inlineData: {
          mimeType: img.mimeType,
          data: img.buffer.toString('base64'),
        },
      })),
    ];

    const result = await model.generateContent({
      contents: [{ role: 'user', parts }],
    });

    const text = result.response.text();
    if (!text?.trim()) {
      throw new Error('Empty response from Gemini');
    }
    return text;
  }
}
