import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Job } from 'bullmq';
import { Model } from 'mongoose';
import { readFile } from 'fs/promises';
import * as path from 'path';
import { GeminiService } from '../gemini/gemini.service';
import { geminiResponseSchema } from '../gemini/gemini-response.schema';
import { extractJsonObjectFromModelText } from '../gemini/json.util';
import { Paper, PaperDocument, PaperStatus } from '../papers/paper.schema';

@Injectable()
@Processor('paper-processing')
export class PaperProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(PaperProcessingProcessor.name);

  constructor(
    @InjectModel(Paper.name)
    private readonly paperModel: Model<PaperDocument>,
    private readonly geminiService: GeminiService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async process(job: Job<{ paperId: string }>): Promise<void> {
    const paperId = job.data?.paperId;
    if (!paperId) return;

    const paper = await this.paperModel.findById(paperId).exec();
    if (!paper || paper.status !== PaperStatus.Processing) {
      return;
    }

    const uploadRoot = this.config.get<string>('UPLOAD_DIR') ?? 'uploads';

    let lastZodIssue = '';

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const images = await Promise.all(
          paper.imagePaths.map(async (rel, i) => ({
            buffer: await readFile(path.join(process.cwd(), uploadRoot, rel)),
            mimeType: paper.imageMimeTypes[i] ?? 'image/jpeg',
          })),
        );

        const rawText = await this.geminiService.evaluateExamImages(images);
        const parsedUnknown = extractJsonObjectFromModelText(rawText);
        const validated = geminiResponseSchema.safeParse(parsedUnknown);

        if (validated.success) {
          paper.geminiResponse = validated.data;
          paper.status = PaperStatus.PendingReview;
          paper.instructorFeedback = validated.data;
          await paper.save();
          return;
        }

        lastZodIssue = validated.error.message;
        this.logger.warn(
          `Paper ${paperId} Zod validation failed (attempt ${attempt + 1}): ${lastZodIssue}`,
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Paper ${paperId} Gemini / parse failed (attempt ${attempt + 1}): ${msg}`,
        );
        lastZodIssue = msg;
      }
    }

    paper.status = PaperStatus.AiFailed;
    await paper.save();
    this.logger.warn(
      `Paper ${paperId} marked ai_failed after retries: ${lastZodIssue}`,
    );
  }
}
