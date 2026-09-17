import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Course, CourseDocument, CourseStatus } from '../courses/course.schema';
import {
  CourseModule as CourseModuleEntity,
  CourseModuleDocument,
} from '../modules/course-module.schema';
import { Lesson, LessonDocument } from '../lessons/lesson.schema';
import { Resource, ResourceDocument } from '../resources/resource.schema';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import type { JwtPayloadUser } from '../../../auth/decorators/current-user.decorator';

@Injectable()
export class CatalogService {
  constructor(
    @InjectModel(Course.name)
    private readonly courseModel: Model<CourseDocument>,
    @InjectModel(CourseModuleEntity.name)
    private readonly moduleModel: Model<CourseModuleDocument>,
    @InjectModel(Lesson.name)
    private readonly lessonModel: Model<LessonDocument>,
    @InjectModel(Resource.name)
    private readonly resourceModel: Model<ResourceDocument>,
    private readonly enrollmentsService: EnrollmentsService,
  ) {}

  private toId(id: string, label = 'Course'): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`${label} not found`);
    }
    return new Types.ObjectId(id);
  }

  async listPublished() {
    const courses = await this.courseModel
      .find({ status: CourseStatus.Published })
      .sort({ updatedAt: -1 })
      .lean()
      .exec();
    if (!courses.length) return [];
    const ids = courses.map((c) => c._id);
    const [moduleCounts, lessonCounts] = await Promise.all([
      this.moduleModel.aggregate<{ _id: Types.ObjectId; n: number }>([
        { $match: { courseId: { $in: ids } } },
        { $group: { _id: '$courseId', n: { $sum: 1 } } },
      ]),
      this.lessonModel.aggregate<{ _id: Types.ObjectId; n: number }>([
        { $match: { courseId: { $in: ids } } },
        { $group: { _id: '$courseId', n: { $sum: 1 } } },
      ]),
    ]);
    const mMap = new Map(moduleCounts.map((x) => [x._id.toString(), x.n]));
    const lMap = new Map(lessonCounts.map((x) => [x._id.toString(), x.n]));
    return courses.map((c) => ({
      ...c,
      modulesCount: mMap.get(c._id.toString()) ?? 0,
      lessonsCount: lMap.get(c._id.toString()) ?? 0,
    }));
  }

  async previewCourse(courseId: string) {
    const cid = this.toId(courseId);
    const course = await this.courseModel
      .findOne({ _id: cid, status: CourseStatus.Published })
      .lean()
      .exec();
    if (!course) throw new NotFoundException('Course not found');
    const [modules, lessonCounts] = await Promise.all([
      this.moduleModel.find({ courseId: cid }).sort({ order: 1 }).lean().exec(),
      this.lessonModel.aggregate<{ _id: Types.ObjectId; n: number }>([
        { $match: { courseId: cid } },
        { $group: { _id: '$moduleId', n: { $sum: 1 } } },
      ]),
    ]);
    const cnt = new Map(lessonCounts.map((x) => [x._id.toString(), x.n]));
    return {
      ...course,
      modules: modules.map((m) => ({
        ...m,
        lessonsCount: cnt.get(m._id.toString()) ?? 0,
      })),
    };
  }

  /** Full learning view: only available to enrolled students or admins/instructors. */
  async learnCourse(user: JwtPayloadUser, courseId: string) {
    const cid = this.toId(courseId);
    const course = await this.courseModel.findById(cid).lean().exec();
    if (!course) throw new NotFoundException('Course not found');

    const studentId = new Types.ObjectId(user.id);
    if (user.role === 'student') {
      if (course.status !== CourseStatus.Published) {
        throw new NotFoundException('Course not found');
      }
      const enrolled = await this.enrollmentsService.studentEnrollmentForCourse(
        user,
        courseId,
      );
      if (!enrolled) {
        throw new ForbiddenException('Enroll in this course to access content');
      }
    }

    const [modules, lessons, resources] = await Promise.all([
      this.moduleModel.find({ courseId: cid }).sort({ order: 1 }).lean().exec(),
      this.lessonModel.find({ courseId: cid }).sort({ order: 1 }).lean().exec(),
      this.resourceModel
        .find({ courseId: cid })
        .sort({ order: 1 })
        .lean()
        .exec(),
    ]);

    const lessonsByModule = new Map<string, typeof lessons>();
    for (const l of lessons) {
      const arr = lessonsByModule.get(l.moduleId.toString()) ?? [];
      arr.push(l);
      lessonsByModule.set(l.moduleId.toString(), arr);
    }

    const resByLesson = new Map<string, typeof resources>();
    const resByModule = new Map<string, typeof resources>();
    const courseResources: typeof resources = [];
    for (const r of resources) {
      if (r.lessonId) {
        const k = r.lessonId.toString();
        const a = resByLesson.get(k) ?? [];
        a.push(r);
        resByLesson.set(k, a);
      } else if (r.moduleId) {
        const k = r.moduleId.toString();
        const a = resByModule.get(k) ?? [];
        a.push(r);
        resByModule.set(k, a);
      } else {
        courseResources.push(r);
      }
    }

    return {
      ...course,
      resources: courseResources,
      modules: modules.map((m) => ({
        ...m,
        resources: resByModule.get(m._id.toString()) ?? [],
        lessons: (lessonsByModule.get(m._id.toString()) ?? []).map((l) => ({
          ...l,
          resources: resByLesson.get(l._id.toString()) ?? [],
        })),
      })),
      // Echo back whether the caller is enrolled (or staff).
      isEnrolled:
        user.role === 'student'
          ? !!(await this.enrollmentsService.studentEnrollmentForCourse(
              user,
              courseId,
            ))
          : true,
      studentId: user.role === 'student' ? studentId.toString() : null,
    };
  }
}
