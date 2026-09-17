import { Module } from '@nestjs/common';
import { PapersModule } from './papers/papers.module';
import { PaperQueueModule } from './queues/paper-queue.module';

@Module({
  imports: [PapersModule, PaperQueueModule],
})
export class ExamEvaluationModule {}
