import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { JwtPayloadUser } from '../../../auth/decorators/current-user.decorator';
import {
  Course,
  CourseDocument,
  CourseLevel,
  CourseStatus,
} from './course.schema';
import {
  CourseModule as CourseModuleEntity,
  CourseModuleDocument,
} from '../modules/course-module.schema';
import { Lesson, LessonDocument } from '../lessons/lesson.schema';
import { Resource, ResourceDocument } from '../resources/resource.schema';
import {
  Enrollment,
  EnrollmentDocument,
} from '../enrollments/enrollment.schema';
import {
  LessonProgress,
  LessonProgressDocument,
} from '../progress/lesson-progress.schema';
import type { CreateCourseDto } from './dto/create-course.dto';
import type { UpdateCourseDto } from './dto/update-course.dto';

@Injectable()
export class CoursesService {
  constructor(
    @InjectModel(Course.name)
    private readonly courseModel: Model<CourseDocument>,
    @InjectModel(CourseModuleEntity.name)
    private readonly moduleModel: Model<CourseModuleDocument>,
    @InjectModel(Lesson.name)
    private readonly lessonModel: Model<LessonDocument>,
    @InjectModel(Resource.name)
    private readonly resourceModel: Model<ResourceDocument>,
    @InjectModel(Enrollment.name)
    private readonly enrollmentModel: Model<EnrollmentDocument>,
    @InjectModel(LessonProgress.name)
    private readonly progressModel: Model<LessonProgressDocument>,
  ) {}

  private normalizeTags(tags?: string[]): string[] {
    if (!tags?.length) return [];
    return [
      ...new Set(tags.map((t) => String(t).trim()).filter(Boolean)),
    ].slice(0, 40);
  }

  private assertId(id: string, label = 'Course'): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`${label} not found`);
    }
    return new Types.ObjectId(id);
  }

  async create(user: JwtPayloadUser, dto: CreateCourseDto) {
    const doc = await this.courseModel.create({
      title: dto.title.trim(),
      code: dto.code?.trim() ?? '',
      subtitle: dto.subtitle?.trim() ?? '',
      description: dto.description?.trim() ?? '',
      coverImageUrl: dto.coverImageUrl?.trim() ?? '',
      learningOutcomes: dto.learningOutcomes?.trim() ?? '',
      prerequisites: dto.prerequisites?.trim() ?? '',
      targetAudience: dto.targetAudience?.trim() ?? '',
      estimatedHours: dto.estimatedHours,
      language: dto.language?.trim() ? dto.language.trim() : 'English',
      level: dto.level ?? CourseLevel.Mixed,
      tags: this.normalizeTags(dto.tags),
      status: dto.status ?? CourseStatus.Draft,
      createdBy: new Types.ObjectId(user.id),
    });
    return doc.toJSON();
  }

  async findAll(opts: { onlyPublished?: boolean } = {}) {
    const query = opts.onlyPublished ? { status: CourseStatus.Published } : {};
    return this.courseModel
      .find(query)
      .sort({ updatedAt: -1 })
      .lean()
      .exec();
  }

  async findOne(id: string) {
    const _id = this.assertId(id);
    const course = await this.courseModel.findById(_id).lean().exec();
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  async findOnePublished(id: string) {
    const course = await this.findOne(id);
    if (course.status !== CourseStatus.Published) {
      throw new NotFoundException('Course not found');
    }
    return course;
  }

  async update(id: string, dto: UpdateCourseDto) {
    const _id = this.assertId(id);
    const $set: Record<string, unknown> = {};
    if (dto.title !== undefined) $set.title = dto.title.trim();
    if (dto.code !== undefined) $set.code = dto.code.trim();
    if (dto.subtitle !== undefined) $set.subtitle = dto.subtitle.trim();
    if (dto.description !== undefined) $set.description = dto.description.trim();
    if (dto.coverImageUrl !== undefined)
      $set.coverImageUrl = dto.coverImageUrl.trim();
    if (dto.learningOutcomes !== undefined)
      $set.learningOutcomes = dto.learningOutcomes.trim();
    if (dto.prerequisites !== undefined)
      $set.prerequisites = dto.prerequisites.trim();
    if (dto.targetAudience !== undefined)
      $set.targetAudience = dto.targetAudience.trim();
    if (dto.estimatedHours !== undefined) $set.estimatedHours = dto.estimatedHours;
    if (dto.language !== undefined) $set.language = dto.language.trim();
    if (dto.level !== undefined) $set.level = dto.level;
    if (dto.tags !== undefined) $set.tags = this.normalizeTags(dto.tags);
    if (dto.status !== undefined) $set.status = dto.status;

    if (!Object.keys($set).length) return this.findOne(id);

    const updated = await this.courseModel
      .findByIdAndUpdate(_id, { $set }, { new: true })
      .lean()
      .exec();
    if (!updated) throw new NotFoundException('Course not found');
    return updated;
  }

  async remove(id: string) {
    const _id = this.assertId(id);
    const existing = await this.courseModel.findById(_id).exec();
    if (!existing) throw new NotFoundException('Course not found');

    // Cascade clean-up. (No transactions because single-node Mongo is typical here.)
    await Promise.all([
      this.lessonModel.deleteMany({ courseId: _id }).exec(),
      this.moduleModel.deleteMany({ courseId: _id }).exec(),
      this.resourceModel.deleteMany({ courseId: _id }).exec(),
      this.enrollmentModel.deleteMany({ courseId: _id }).exec(),
      this.progressModel.deleteMany({ courseId: _id }).exec(),
    ]);
    await this.courseModel.deleteOne({ _id }).exec();
    return { ok: true };
  }

  /** Compose full curriculum tree (modules → lessons → resources). */
  async curriculum(id: string) {
    const _id = this.assertId(id);
    const [course, modules, lessons, resources] = await Promise.all([
      this.courseModel.findById(_id).lean().exec(),
      this.moduleModel.find({ courseId: _id }).sort({ order: 1 }).lean().exec(),
      this.lessonModel.find({ courseId: _id }).sort({ order: 1 }).lean().exec(),
      this.resourceModel
        .find({ courseId: _id })
        .sort({ order: 1 })
        .lean()
        .exec(),
    ]);
    if (!course) throw new NotFoundException('Course not found');

    const lessonsByModule = new Map<string, typeof lessons>();
    for (const l of lessons) {
      const key = l.moduleId.toString();
      const arr = lessonsByModule.get(key) ?? [];
      arr.push(l);
      lessonsByModule.set(key, arr);
    }

    const resourcesByLesson = new Map<string, typeof resources>();
    const resourcesByModule = new Map<string, typeof resources>();
    const courseResources: typeof resources = [];
    for (const r of resources) {
      if (r.lessonId) {
        const key = r.lessonId.toString();
        const arr = resourcesByLesson.get(key) ?? [];
        arr.push(r);
        resourcesByLesson.set(key, arr);
      } else if (r.moduleId) {
        const key = r.moduleId.toString();
        const arr = resourcesByModule.get(key) ?? [];
        arr.push(r);
        resourcesByModule.set(key, arr);
      } else {
        courseResources.push(r);
      }
    }

    return {
      ...course,
      resources: courseResources,
      modules: modules.map((m) => ({
        ...m,
        resources: resourcesByModule.get(m._id.toString()) ?? [],
        lessons: (lessonsByModule.get(m._id.toString()) ?? []).map((l) => ({
          ...l,
          resources: resourcesByLesson.get(l._id.toString()) ?? [],
        })),
      })),
    };
  }

  /** Quick stats used by admin dashboard listing. */
  async statsByCourse(courseIds: Types.ObjectId[]) {
    if (!courseIds.length) return new Map<string, { modules: number; lessons: number; enrollments: number }>();
    const [mods, lessons, enrolls] = await Promise.all([
      this.moduleModel.aggregate<{ _id: Types.ObjectId; n: number }>([
        { $match: { courseId: { $in: courseIds } } },
        { $group: { _id: '$courseId', n: { $sum: 1 } } },
      ]),
      this.lessonModel.aggregate<{ _id: Types.ObjectId; n: number }>([
        { $match: { courseId: { $in: courseIds } } },
        { $group: { _id: '$courseId', n: { $sum: 1 } } },
      ]),
      this.enrollmentModel.aggregate<{ _id: Types.ObjectId; n: number }>([
        { $match: { courseId: { $in: courseIds }, status: 'active' } },
        { $group: { _id: '$courseId', n: { $sum: 1 } } },
      ]),
    ]);
    const map = new Map<
      string,
      { modules: number; lessons: number; enrollments: number }
    >();
    for (const id of courseIds) {
      map.set(id.toString(), { modules: 0, lessons: 0, enrollments: 0 });
    }
    for (const m of mods) {
      const k = m._id.toString();
      const v = map.get(k);
      if (v) v.modules = m.n;
    }
    for (const l of lessons) {
      const k = l._id.toString();
      const v = map.get(k);
      if (v) v.lessons = l.n;
    }
    for (const e of enrolls) {
      const k = e._id.toString();
      const v = map.get(k);
      if (v) v.enrollments = e.n;
    }
    return map;
  }

  async findAllWithStats(opts: { onlyPublished?: boolean } = {}) {
    const courses = await this.findAll(opts);
    const ids = courses.map((c) => c._id);
    const stats = await this.statsByCourse(ids);
    return courses.map((c) => ({
      ...c,
      ...stats.get(c._id.toString()),
    }));
  }

  /** Ensures the given course exists; used by sub-resource controllers. */
  async assertExists(courseId: string): Promise<Types.ObjectId> {
    const _id = this.assertId(courseId);
    const exists = await this.courseModel.exists({ _id });
    if (!exists) throw new BadRequestException('Course not found');
    return _id;
  }
}
