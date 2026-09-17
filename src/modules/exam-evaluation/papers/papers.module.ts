import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MongooseModule } from '@nestjs/mongoose';
import { Paper, PaperSchema } from './paper.schema';
import { PapersService } from './papers.service';
import { PapersController } from './papers.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Paper.name, schema: PaperSchema }]),
    BullModule.registerQueue({
      name: 'paper-processing',
    }),
  ],
  controllers: [PapersController],
  providers: [PapersService],
  exports: [PapersService, MongooseModule],
})
export class PapersModule {}
