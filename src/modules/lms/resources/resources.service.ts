import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { createReadStream } from 'fs';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { Model, Types } from 'mongoose';
import * as path from 'path';
import * as crypto from 'crypto';
import type { Express } from 'express';
import type { Readable } from 'stream';
import { Resource, ResourceDocument, ResourceKind } from './resource.schema';
import {
  CourseModule as CourseModuleEntity,
  CourseModuleDocument,
} from '../modules/course-module.schema';
import { Lesson, LessonDocument } from '../lessons/lesson.schema';
import { CoursesService } from '../courses/courses.service';
import type { CreateResourceDto } from './dto/create-resource.dto';
import type { UpdateResourceDto } from './dto/update-resource.dto';
import type { UploadResourceMetaDto } from './dto/upload-resource-meta.dto';

const MAX_FILE_BYTES = 25 * 1024 * 1024;

@Injectable()
export class ResourcesService {
  constructor(
    @InjectModel(Resource.name)
    private readonly resourceModel: Model<ResourceDocument>,
    @InjectModel(CourseModuleEntity.name)
    private readonly moduleModel: Model<CourseModuleDocument>,
    @InjectModel(Lesson.name)
    private readonly lessonModel: Model<LessonDocument>,
    private readonly coursesService: CoursesService,
    private readonly config: ConfigService,
  ) {}

  private uploadsRoot(): string {
    return this.config.get<string>('UPLOAD_DIR') ?? 'uploads';
  }

  private absUploadPath(rel: string): string {
    return path.join(process.cwd(), this.uploadsRoot(), rel);
  }

  private toId(id: string, label = 'Resource'): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`${label} not found`);
    }
    return new Types.ObjectId(id);
  }

  private async resolveScope(input: {
    courseId: string;
    moduleId?: string;
    lessonId?: string;
  }): Promise<{
    courseId: Types.ObjectId;
    moduleId?: Types.ObjectId;
    lessonId?: Types.ObjectId;
  }> {
    const courseId = await this.coursesService.assertExists(input.courseId);
    let moduleId: Types.ObjectId | undefined;
    let lessonId: Types.ObjectId | undefined;
    if (input.moduleId) {
      moduleId = this.toId(input.moduleId, 'Module');
      const mod = await this.moduleModel.exists({ _id: moduleId, courseId });
      if (!mod) throw new BadRequestException('Module not in this course');
    }
    if (input.lessonId) {
      lessonId = this.toId(input.lessonId, 'Lesson');
      const lesson = await this.lessonModel
        .findOne({ _id: lessonId, courseId })
        .lean()
        .exec();
      if (!lesson) throw new BadRequestException('Lesson not in this course');
      moduleId = moduleId ?? lesson.moduleId;
    }
    return { courseId, moduleId, lessonId };
  }

  async create(dto: CreateResourceDto) {
    const scope = await this.resolveScope(dto);
    if (dto.kind === ResourceKind.Link && !dto.url?.trim()) {
      throw new BadRequestException('url is required for link resources');
    }
    if (dto.kind === ResourceKind.Note && !dto.body?.trim()) {
      throw new BadRequestException('body is required for note resources');
    }
    if (dto.kind === ResourceKind.File) {
      throw new BadRequestException(
        'Use /resources/upload to attach a file resource',
      );
    }
    const order =
      dto.order ??
      (await this.resourceModel
        .countDocuments({
          courseId: scope.courseId,
          lessonId: scope.lessonId ?? { $exists: false },
          moduleId: scope.lessonId ? undefined : scope.moduleId ?? { $exists: false },
        })
        .exec());
    const doc = await this.resourceModel.create({
      ...scope,
      kind: dto.kind,
      title: dto.title.trim(),
      description: dto.description?.trim() ?? '',
      url: dto.kind === ResourceKind.Link ? dto.url?.trim() : undefined,
      body: dto.kind === ResourceKind.Note ? dto.body?.trim() ?? '' : '',
      order,
    });
    return doc.toJSON();
  }

  async upload(file: Express.Multer.File | undefined, meta: UploadResourceMetaDto) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('File is required');
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new BadRequestException('File too large (max 25MB)');
    }
    const scope = await this.resolveScope(meta);
    const resourceId = new Types.ObjectId();
    const relDir = path.join('resources', scope.courseId.toString()).replace(/\\/g, '/');
    await mkdir(this.absUploadPath(relDir), { recursive: true });

    const safeName =
      file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100) || 'file';
    const filename = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safeName}`;
    const rel = path.join(relDir, filename).replace(/\\/g, '/');
    await writeFile(this.absUploadPath(rel), file.buffer);

    const order = await this.resourceModel.countDocuments({
      courseId: scope.courseId,
      ...(scope.lessonId
        ? { lessonId: scope.lessonId }
        : scope.moduleId
          ? { moduleId: scope.moduleId, lessonId: { $exists: false } }
          : { moduleId: { $exists: false }, lessonId: { $exists: false } }),
    });

    const doc = await this.resourceModel.create({
      _id: resourceId,
      ...scope,
      kind: ResourceKind.File,
      title: meta.title.trim(),
      description: meta.description?.trim() ?? '',
      fileRel: rel,
      fileMimeType: file.mimetype,
      fileOriginalName: file.originalname,
      fileSizeBytes: file.size,
      order,
    });
    return doc.toJSON();
  }

  async findOne(id: string) {
    const _id = this.toId(id);
    const doc = await this.resourceModel.findById(_id).lean().exec();
    if (!doc) throw new NotFoundException('Resource not found');
    return doc;
  }

  async list(filter: { courseId?: string; moduleId?: string; lessonId?: string }) {
    const q: Record<string, unknown> = {};
    if (filter.courseId) {
      if (!Types.ObjectId.isValid(filter.courseId))
        throw new BadRequestException('Bad courseId');
      q.courseId = new Types.ObjectId(filter.courseId);
    }
    if (filter.moduleId) {
      if (!Types.ObjectId.isValid(filter.moduleId))
        throw new BadRequestException('Bad moduleId');
      q.moduleId = new Types.ObjectId(filter.moduleId);
    }
    if (filter.lessonId) {
      if (!Types.ObjectId.isValid(filter.lessonId))
        throw new BadRequestException('Bad lessonId');
      q.lessonId = new Types.ObjectId(filter.lessonId);
    }
    return this.resourceModel
      .find(q)
      .sort({ order: 1, createdAt: 1 })
      .lean()
      .exec();
  }

  async update(id: string, dto: UpdateResourceDto) {
    const _id = this.toId(id);
    const $set: Record<string, unknown> = {};
    if (dto.title !== undefined) $set.title = dto.title.trim();
    if (dto.description !== undefined) $set.description = dto.description.trim();
    if (dto.url !== undefined) $set.url = dto.url.trim();
    if (dto.body !== undefined) $set.body = dto.body.trim();
    if (dto.order !== undefined) $set.order = dto.order;
    if (!Object.keys($set).length) return this.findOne(id);
    const updated = await this.resourceModel
      .findByIdAndUpdate(_id, { $set }, { new: true })
      .lean()
      .exec();
    if (!updated) throw new NotFoundException('Resource not found');
    return updated;
  }

  async remove(id: string) {
    const _id = this.toId(id);
    const doc = await this.resourceModel.findById(_id).exec();
    if (!doc) throw new NotFoundException('Resource not found');
    if (doc.fileRel) {
      try {
        await unlink(this.absUploadPath(doc.fileRel));
      } catch {
        /* ignore missing file */
      }
    }
    await this.resourceModel.deleteOne({ _id }).exec();
    return { ok: true };
  }

  async streamFile(
    id: string,
  ): Promise<{ stream: Readable; mime: string; filename: string }> {
    const doc = await this.findOne(id);
    if (doc.kind !== ResourceKind.File || !doc.fileRel) {
      throw new NotFoundException('Resource has no downloadable file');
    }
    return {
      stream: createReadStream(this.absUploadPath(doc.fileRel)),
      mime: doc.fileMimeType ?? 'application/octet-stream',
      filename: doc.fileOriginalName ?? 'resource',
    };
  }
}
