import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MongooseModule } from '@nestjs/mongoose';
import { Paper, PaperSchema } from '../papers/paper.schema';
import { GeminiModule } from '../gemini/gemini.module';
import { PaperProcessingProcessor } from './paper-processing.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'paper-processing',
    }),
    MongooseModule.forFeature([{ name: Paper.name, schema: PaperSchema }]),
    GeminiModule,
  ],
  providers: [PaperProcessingProcessor],
})
export class PaperQueueModule {}
