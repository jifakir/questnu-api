import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Lesson, LessonDocument, LessonKind } from './lesson.schema';
import {
  CourseModule as CourseModuleEntity,
  CourseModuleDocument,
} from '../modules/course-module.schema';
import { Resource, ResourceDocument } from '../resources/resource.schema';
import {
  LessonProgress,
  LessonProgressDocument,
} from '../progress/lesson-progress.schema';
import type { CreateLessonDto } from './dto/create-lesson.dto';
import type { UpdateLessonDto } from './dto/update-lesson.dto';

@Injectable()
export class LessonsService {
  constructor(
    @InjectModel(Lesson.name)
    private readonly lessonModel: Model<LessonDocument>,
    @InjectModel(CourseModuleEntity.name)
    private readonly moduleModel: Model<CourseModuleDocument>,
    @InjectModel(Resource.name)
    private readonly resourceModel: Model<ResourceDocument>,
    @InjectModel(LessonProgress.name)
    private readonly progressModel: Model<LessonProgressDocument>,
  ) {}

  private toId(id: string, label = 'Lesson'): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`${label} not found`);
    }
    return new Types.ObjectId(id);
  }

  private buildPayload(dto: CreateLessonDto | UpdateLessonDto, kind: LessonKind) {
    const out: Record<string, unknown> = {};
    if (dto.title !== undefined) out.title = String(dto.title).trim();
    if (dto.description !== undefined)
      out.description = String(dto.description).trim();
    if (dto.order !== undefined) out.order = dto.order;

    if (kind === LessonKind.LiveClass) {
      if (dto.scheduledAt !== undefined)
        out.scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : undefined;
      if (dto.durationMinutes !== undefined)
        out.durationMinutes = dto.durationMinutes;
      if (dto.meetingUrl !== undefined)
        out.meetingUrl = String(dto.meetingUrl).trim();
      if (dto.meetingProvider !== undefined)
        out.meetingProvider = String(dto.meetingProvider).trim();
      if (dto.studentPreparation !== undefined)
        out.studentPreparation = String(dto.studentPreparation).trim();
    } else if (kind === LessonKind.VideoClass) {
      if (dto.videoUrl !== undefined) out.videoUrl = String(dto.videoUrl).trim();
      if (dto.videoThumbnailUrl !== undefined)
        out.videoThumbnailUrl = String(dto.videoThumbnailUrl).trim();
      if (dto.videoDurationSeconds !== undefined)
        out.videoDurationSeconds = dto.videoDurationSeconds;
      if (dto.durationMinutes !== undefined)
        out.durationMinutes = dto.durationMinutes;
    } else if (kind === LessonKind.Exam) {
      if (dto.examInstructions !== undefined)
        out.examInstructions = String(dto.examInstructions).trim();
      if (dto.examDurationMinutes !== undefined)
        out.examDurationMinutes = dto.examDurationMinutes;
      if (dto.examDueAt !== undefined)
        out.examDueAt = dto.examDueAt ? new Date(dto.examDueAt) : undefined;
      if (dto.examAiEvaluation !== undefined)
        out.examAiEvaluation = dto.examAiEvaluation;
    }
    return out;
  }

  async create(moduleId: string, dto: CreateLessonDto) {
    const mid = this.toId(moduleId, 'Module');
    const mod = await this.moduleModel.findById(mid).lean().exec();
    if (!mod) throw new BadRequestException('Module not found');

    const order =
      dto.order ??
      (await this.lessonModel.countDocuments({ moduleId: mid }).exec());
    const payload = this.buildPayload(dto, dto.kind);
    const doc = await this.lessonModel.create({
      courseId: mod.courseId,
      moduleId: mid,
      kind: dto.kind,
      title: dto.title.trim(),
      order,
      ...payload,
    });
    return doc.toJSON();
  }

  async listForModule(moduleId: string) {
    const mid = this.toId(moduleId, 'Module');
    return this.lessonModel
      .find({ moduleId: mid })
      .sort({ order: 1, createdAt: 1 })
      .lean()
      .exec();
  }

  async listForCourse(courseId: string) {
    if (!Types.ObjectId.isValid(courseId)) {
      throw new NotFoundException('Course not found');
    }
    return this.lessonModel
      .find({ courseId: new Types.ObjectId(courseId) })
      .sort({ order: 1, createdAt: 1 })
      .lean()
      .exec();
  }

  async findOne(id: string) {
    const _id = this.toId(id);
    const doc = await this.lessonModel.findById(_id).lean().exec();
    if (!doc) throw new NotFoundException('Lesson not found');
    return doc;
  }

  async update(id: string, dto: UpdateLessonDto) {
    const _id = this.toId(id);
    const lesson = await this.lessonModel.findById(_id).exec();
    if (!lesson) throw new NotFoundException('Lesson not found');
    const kind = (dto.kind ?? lesson.kind) as LessonKind;
    if (dto.kind && dto.kind !== lesson.kind) {
      throw new BadRequestException(
        'Lesson kind cannot be changed; delete and re-create instead.',
      );
    }
    const $set = this.buildPayload(dto, kind);
    if (!Object.keys($set).length) return lesson.toJSON();
    const updated = await this.lessonModel
      .findByIdAndUpdate(_id, { $set }, { new: true })
      .lean()
      .exec();
    if (!updated) throw new NotFoundException('Lesson not found');
    return updated;
  }

  async remove(id: string) {
    const _id = this.toId(id);
    const lesson = await this.lessonModel.findById(_id).exec();
    if (!lesson) throw new NotFoundException('Lesson not found');
    await Promise.all([
      this.resourceModel.deleteMany({ lessonId: _id }).exec(),
      this.progressModel.deleteMany({ lessonId: _id }).exec(),
    ]);
    await this.lessonModel.deleteOne({ _id }).exec();
    return { ok: true };
  }

  async reorder(moduleId: string, lessonIds: string[]) {
    const mid = this.toId(moduleId, 'Module');
    const objectIds = lessonIds.map((id) => this.toId(id));
    const found = await this.lessonModel
      .find({ _id: { $in: objectIds }, moduleId: mid }, { _id: 1 })
      .lean()
      .exec();
    if (found.length !== objectIds.length) {
      throw new BadRequestException('Some lessons do not belong to this module');
    }
    const ops = objectIds.map((id, idx) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: { order: idx } },
      },
    }));
    if (ops.length) await this.lessonModel.bulkWrite(ops);
    return this.listForModule(moduleId);
  }
}
