import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CourseModule as CourseModuleEntity,
  CourseModuleDocument,
} from './course-module.schema';
import { Lesson, LessonDocument } from '../lessons/lesson.schema';
import { Resource, ResourceDocument } from '../resources/resource.schema';
import {
  LessonProgress,
  LessonProgressDocument,
} from '../progress/lesson-progress.schema';
import { CoursesService } from '../courses/courses.service';
import type { CreateModuleDto } from './dto/create-module.dto';
import type { UpdateModuleDto } from './dto/update-module.dto';

@Injectable()
export class ModulesService {
  constructor(
    @InjectModel(CourseModuleEntity.name)
    private readonly moduleModel: Model<CourseModuleDocument>,
    @InjectModel(Lesson.name)
    private readonly lessonModel: Model<LessonDocument>,
    @InjectModel(Resource.name)
    private readonly resourceModel: Model<ResourceDocument>,
    @InjectModel(LessonProgress.name)
    private readonly progressModel: Model<LessonProgressDocument>,
    private readonly coursesService: CoursesService,
  ) {}

  private toId(id: string, label = 'Module'): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`${label} not found`);
    }
    return new Types.ObjectId(id);
  }

  async create(courseId: string, dto: CreateModuleDto) {
    const cid = await this.coursesService.assertExists(courseId);
    const order =
      dto.order ??
      (await this.moduleModel.countDocuments({ courseId: cid }).exec());
    const doc = await this.moduleModel.create({
      courseId: cid,
      title: dto.title.trim(),
      description: dto.description?.trim() ?? '',
      order,
    });
    return doc.toJSON();
  }

  async listForCourse(courseId: string) {
    const cid = this.toId(courseId, 'Course');
    return this.moduleModel
      .find({ courseId: cid })
      .sort({ order: 1, createdAt: 1 })
      .lean()
      .exec();
  }

  async findOne(id: string) {
    const _id = this.toId(id);
    const doc = await this.moduleModel.findById(_id).lean().exec();
    if (!doc) throw new NotFoundException('Module not found');
    return doc;
  }

  async update(id: string, dto: UpdateModuleDto) {
    const _id = this.toId(id);
    const $set: Record<string, unknown> = {};
    if (dto.title !== undefined) $set.title = dto.title.trim();
    if (dto.description !== undefined) $set.description = dto.description.trim();
    if (dto.order !== undefined) $set.order = dto.order;
    if (!Object.keys($set).length) return this.findOne(id);
    const updated = await this.moduleModel
      .findByIdAndUpdate(_id, { $set }, { new: true })
      .lean()
      .exec();
    if (!updated) throw new NotFoundException('Module not found');
    return updated;
  }

  async remove(id: string) {
    const _id = this.toId(id);
    const m = await this.moduleModel.findById(_id).exec();
    if (!m) throw new NotFoundException('Module not found');
    const lessons = await this.lessonModel
      .find({ moduleId: _id }, { _id: 1 })
      .lean()
      .exec();
    const lessonIds = lessons.map((l) => l._id);
    await Promise.all([
      this.lessonModel.deleteMany({ moduleId: _id }).exec(),
      this.resourceModel.deleteMany({ moduleId: _id }).exec(),
      lessonIds.length
        ? this.progressModel.deleteMany({ lessonId: { $in: lessonIds } }).exec()
        : Promise.resolve(null),
    ]);
    await this.moduleModel.deleteOne({ _id }).exec();
    return { ok: true };
  }

  async reorder(courseId: string, moduleIds: string[]) {
    const cid = await this.coursesService.assertExists(courseId);
    const objectIds = moduleIds.map((id) => this.toId(id));
    const existing = await this.moduleModel
      .find({ _id: { $in: objectIds }, courseId: cid }, { _id: 1 })
      .lean()
      .exec();
    if (existing.length !== objectIds.length) {
      throw new BadRequestException('Some modules do not belong to this course');
    }
    const ops = objectIds.map((id, idx) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: { order: idx } },
      },
    }));
    if (ops.length) await this.moduleModel.bulkWrite(ops);
    return this.listForCourse(courseId);
  }
}
