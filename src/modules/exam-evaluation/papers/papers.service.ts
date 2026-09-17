import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { createReadStream } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { Model, Types } from 'mongoose';
import * as path from 'path';
import * as crypto from 'crypto';
import type { Express } from 'express';
import type { Readable } from 'stream';
import type { GeminiResponsePayload } from '../gemini/gemini-response.schema';
import { geminiResponseSchema } from '../gemini/gemini-response.schema';
import { JwtPayloadUser } from '../../../auth/decorators/current-user.decorator';
import type { UploadPaperBodyDto } from './dto/upload-paper-body.dto';
import { Paper, PaperDocument, PaperStatus } from './paper.schema';
import { UserRole } from '../../../users/user.schema';

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function mimeFromFilename(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

@Injectable()
export class PapersService {
  private readonly logger = new Logger(PapersService.name);

  constructor(
    @InjectModel(Paper.name) private readonly paperModel: Model<PaperDocument>,
    @InjectQueue('paper-processing') private readonly paperQueue: Queue,
    private readonly config: ConfigService,
  ) {}

  private uploadsRoot(): string {
    return this.config.get<string>('UPLOAD_DIR') ?? 'uploads';
  }

  private absUploadPath(relative: string): string {
    return path.join(process.cwd(), this.uploadsRoot(), relative);
  }

  private ensureStudentScope(user: JwtPayloadUser, paper: PaperDocument): void {
    if (
      user.role === UserRole.Student &&
      paper.studentId.toString() !== user.id
    ) {
      throw new ForbiddenException();
    }
  }

  private toObjectId(id: string | undefined): Types.ObjectId | undefined {
    if (!id) return undefined;
    if (!Types.ObjectId.isValid(id)) return undefined;
    return new Types.ObjectId(id);
  }

  async createFromUploads(
    user: JwtPayloadUser,
    files: Express.Multer.File[],
    body?: UploadPaperBodyDto,
  ): Promise<PaperDocument> {
    if (!files?.length) {
      throw new BadRequestException('At least one image is required');
    }

    for (const f of files) {
      if (!ALLOWED_MIMES.has(f.mimetype)) {
        throw new BadRequestException(`Unsupported file type: ${f.mimetype}`);
      }
    }

    const paperId = new Types.ObjectId();
    const relDir = path.join('papers', paperId.toString());
    const absDir = this.absUploadPath(relDir);
    await mkdir(absDir, { recursive: true });

    const imagePaths: string[] = [];
    const imageMimeTypes: string[] = [];

    for (const file of files) {
      const safeBase =
        file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) ||
        'page';
      const filename = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safeBase}`;
      const rel = path.join(relDir, filename).replace(/\\/g, '/');
      const abs = this.absUploadPath(rel);
      await writeFile(abs, file.buffer);

      imagePaths.push(rel);
      imageMimeTypes.push(file.mimetype);
    }

    const courseId = this.toObjectId(body?.courseId);
    const moduleId = this.toObjectId(body?.moduleId);
    const lessonId = this.toObjectId(body?.lessonId);
    const assignmentKey = body?.assignmentKey?.trim() || undefined;
    const courseTitle = body?.courseTitle?.trim() || undefined;
    const examTitle = body?.examTitle?.trim() || undefined;

    const paper = await this.paperModel.create({
      _id: paperId,
      studentId: new Types.ObjectId(user.id),
      imagePaths,
      imageMimeTypes,
      status: PaperStatus.Processing,
      ...(courseId ? { courseId } : {}),
      ...(moduleId ? { moduleId } : {}),
      ...(lessonId ? { lessonId } : {}),
      ...(assignmentKey ? { assignmentKey } : {}),
      ...(courseTitle ? { courseTitle } : {}),
      ...(examTitle ? { examTitle } : {}),
    });

    await this.paperQueue.add('process', { paperId: paperId.toString() });

    return paper;
  }

  async findAllForUser(user: JwtPayloadUser): Promise<PaperDocument[]> {
    if (user.role === UserRole.Student) {
      if (!Types.ObjectId.isValid(user.id)) {
        this.logger.warn(`papers list: invalid student id "${user.id}"`);
        return [];
      }
      return this.paperModel
        .find({ studentId: new Types.ObjectId(user.id) })
        .sort({ createdAt: -1 })
        .exec();
    }
    return this.paperModel.find().sort({ createdAt: -1 }).exec();
  }

  async findOneForUser(user: JwtPayloadUser, id: string): Promise<PaperDocument> {
    const paper = await this.paperModel.findById(id).exec();
    if (!paper) {
      throw new NotFoundException('Paper not found');
    }
    this.ensureStudentScope(user, paper);
    return paper;
  }

  async reviewPaper(
    user: JwtPayloadUser,
    id: string,
    feedback: GeminiResponsePayload,
    approve: boolean,
  ): Promise<PaperDocument> {
    const paper = await this.paperModel.findById(id).exec();
    if (!paper) {
      throw new NotFoundException('Paper not found');
    }

    if (paper.status !== PaperStatus.PendingReview) {
      throw new BadRequestException('Paper is not awaiting instructor review');
    }

    paper.instructorFeedback = feedback;

    if (approve) {
      paper.status = PaperStatus.Approved;
      paper.approvedAt = new Date();
      paper.reviewedBy = new Types.ObjectId(user.id);
    }

    return paper.save();
  }

  async getImageStream(
    user: JwtPayloadUser,
    paperId: string,
    index: number,
  ): Promise<{ stream: Readable; mime: string }> {
    const paper = await this.findOneForUser(user, paperId);

    const i = Number(index);
    if (!Number.isInteger(i) || i < 0 || i >= paper.imagePaths.length) {
      throw new NotFoundException('Image not found');
    }

    const rel = paper.imagePaths[i];
    const mime = paper.imageMimeTypes[i] ?? mimeFromFilename(rel);
    const abs = this.absUploadPath(rel);

    const stream = createReadStream(abs);
    return { stream, mime };
  }

  validateFeedbackPayload(feedback: unknown): GeminiResponsePayload {
    const result = geminiResponseSchema.safeParse(feedback);
    if (!result.success) {
      this.logger.warn(`Feedback validation: ${result.error.message}`);
      throw new BadRequestException('Feedback does not match expected AI JSON shape');
    }
    return result.data;
  }
}
