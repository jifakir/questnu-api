import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  LessonProgress,
  LessonProgressDocument,
  LessonProgressStatus,
} from './lesson-progress.schema';
import { Lesson, LessonDocument } from '../lessons/lesson.schema';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import type { JwtPayloadUser } from '../../../auth/decorators/current-user.decorator';

@Injectable()
export class ProgressService {
  constructor(
    @InjectModel(LessonProgress.name)
    private readonly progressModel: Model<LessonProgressDocument>,
    @InjectModel(Lesson.name)
    private readonly lessonModel: Model<LessonDocument>,
    private readonly enrollmentsService: EnrollmentsService,
  ) {}

  private toId(id: string, label = 'Lesson'): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`${label} not found`);
    }
    return new Types.ObjectId(id);
  }

  async setForLesson(
    user: JwtPayloadUser,
    lessonId: string,
    status: LessonProgressStatus,
  ) {
    const lid = this.toId(lessonId);
    const lesson = await this.lessonModel.findById(lid).lean().exec();
    if (!lesson) throw new NotFoundException('Lesson not found');

    const studentId = new Types.ObjectId(user.id);
    await this.enrollmentsService.assertEnrolled(studentId, lesson.courseId);

    const now = new Date();
    const patch: Record<string, unknown> = { status };
    if (status === LessonProgressStatus.InProgress) {
      patch.startedAt = now;
      patch.completedAt = undefined;
    } else if (status === LessonProgressStatus.Completed) {
      patch.completedAt = now;
    } else {
      patch.completedAt = undefined;
    }

    const doc = await this.progressModel
      .findOneAndUpdate(
        { studentId, lessonId: lid },
        {
          $set: patch,
          $setOnInsert: {
            studentId,
            lessonId: lid,
            courseId: lesson.courseId,
            moduleId: lesson.moduleId,
          },
        },
        { upsert: true, new: true },
      )
      .lean()
      .exec();

    await this.recomputeCoursePercent(studentId, lesson.courseId);
    return doc;
  }

  async listForCourse(user: JwtPayloadUser, courseId: string) {
    const cid = this.toId(courseId, 'Course');
    const studentId = new Types.ObjectId(user.id);
    // Allow viewing only if enrolled (or instructor/admin viewing self, but
    // this endpoint is "me" scoped — we still want self only).
    await this.enrollmentsService.assertEnrolled(studentId, cid);
    return this.progressModel
      .find({ studentId, courseId: cid })
      .lean()
      .exec();
  }

  private async recomputeCoursePercent(
    studentId: Types.ObjectId,
    courseId: Types.ObjectId,
  ): Promise<void> {
    const total = await this.lessonModel
      .countDocuments({ courseId })
      .exec();
    if (total === 0) {
      await this.enrollmentsService.setProgress(studentId, courseId, 0);
      return;
    }
    const completed = await this.progressModel
      .countDocuments({
        studentId,
        courseId,
        status: LessonProgressStatus.Completed,
      })
      .exec();
    const percent = Math.round((completed / total) * 100);
    await this.enrollmentsService.setProgress(studentId, courseId, percent);
  }

  async ensureSelfScope(
    user: JwtPayloadUser,
    targetUserId: string,
  ): Promise<void> {
    if (user.id !== targetUserId) {
      throw new ForbiddenException();
    }
  }
}
