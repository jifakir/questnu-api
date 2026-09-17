import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Enrollment,
  EnrollmentDocument,
  EnrollmentStatus,
} from './enrollment.schema';
import { Course, CourseDocument, CourseStatus } from '../courses/course.schema';
import { User, UserDocument, UserRole } from '../../../users/user.schema';
import type { JwtPayloadUser } from '../../../auth/decorators/current-user.decorator';

@Injectable()
export class EnrollmentsService {
  constructor(
    @InjectModel(Enrollment.name)
    private readonly enrollmentModel: Model<EnrollmentDocument>,
    @InjectModel(Course.name)
    private readonly courseModel: Model<CourseDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  private toId(id: string, label = 'Id'): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`${label} not found`);
    }
    return new Types.ObjectId(id);
  }

  async enrollStudent(user: JwtPayloadUser, courseId: string) {
    const cid = this.toId(courseId, 'Course');
    const course = await this.courseModel.findById(cid).lean().exec();
    if (!course) throw new NotFoundException('Course not found');
    if (course.status !== CourseStatus.Published) {
      throw new BadRequestException('Course is not published');
    }
    const studentId = new Types.ObjectId(user.id);
    try {
      const doc = await this.enrollmentModel.create({
        studentId,
        courseId: cid,
        status: EnrollmentStatus.Active,
        enrolledAt: new Date(),
        progressPercent: 0,
      });
      return doc.toJSON();
    } catch (e: unknown) {
      if (typeof e === 'object' && e && 'code' in e && (e as { code: number }).code === 11000) {
        const existing = await this.enrollmentModel
          .findOne({ studentId, courseId: cid })
          .lean()
          .exec();
        if (existing) return existing;
        throw new ConflictException('Already enrolled');
      }
      throw e;
    }
  }

  async adminEnroll(studentId: string, courseId: string) {
    const sid = this.toId(studentId, 'Student');
    const cid = this.toId(courseId, 'Course');
    const [student, course] = await Promise.all([
      this.userModel.findById(sid).lean().exec(),
      this.courseModel.findById(cid).lean().exec(),
    ]);
    if (!student || student.role !== UserRole.Student) {
      throw new BadRequestException('Student not found');
    }
    if (!course) throw new NotFoundException('Course not found');
    try {
      const doc = await this.enrollmentModel.create({
        studentId: sid,
        courseId: cid,
        status: EnrollmentStatus.Active,
        enrolledAt: new Date(),
        progressPercent: 0,
      });
      return doc.toJSON();
    } catch (e: unknown) {
      if (typeof e === 'object' && e && 'code' in e && (e as { code: number }).code === 11000) {
        const existing = await this.enrollmentModel
          .findOne({ studentId: sid, courseId: cid })
          .lean()
          .exec();
        if (existing) return existing;
      }
      throw e;
    }
  }

  async findMine(user: JwtPayloadUser) {
    const studentId = new Types.ObjectId(user.id);
    const enrollments = await this.enrollmentModel
      .find({ studentId })
      .sort({ enrolledAt: -1 })
      .lean()
      .exec();
    const courseIds = enrollments.map((e) => e.courseId);
    const courses = courseIds.length
      ? await this.courseModel.find({ _id: { $in: courseIds } }).lean().exec()
      : [];
    const courseById = new Map(courses.map((c) => [c._id.toString(), c]));
    return enrollments.map((e) => ({
      ...e,
      course: courseById.get(e.courseId.toString()) ?? null,
    }));
  }

  async findForCourse(courseId: string) {
    const cid = this.toId(courseId, 'Course');
    const enrollments = await this.enrollmentModel
      .find({ courseId: cid })
      .sort({ enrolledAt: -1 })
      .lean()
      .exec();
    const studentIds = enrollments.map((e) => e.studentId);
    const students = studentIds.length
      ? await this.userModel
          .find({ _id: { $in: studentIds } })
          .select({ _id: 1, email: 1, name: 1 })
          .lean()
          .exec()
      : [];
    const byId = new Map(students.map((s) => [s._id.toString(), s]));
    return enrollments.map((e) => ({
      ...e,
      student: byId.get(e.studentId.toString()) ?? null,
    }));
  }

  async studentEnrollmentForCourse(user: JwtPayloadUser, courseId: string) {
    const cid = this.toId(courseId, 'Course');
    const studentId = new Types.ObjectId(user.id);
    return this.enrollmentModel
      .findOne({ studentId, courseId: cid })
      .lean()
      .exec();
  }

  async removeMine(user: JwtPayloadUser, enrollmentId: string) {
    const _id = this.toId(enrollmentId, 'Enrollment');
    const doc = await this.enrollmentModel.findById(_id).exec();
    if (!doc) throw new NotFoundException('Enrollment not found');
    if (
      user.role === UserRole.Student &&
      doc.studentId.toString() !== user.id
    ) {
      throw new ForbiddenException();
    }
    await this.enrollmentModel.deleteOne({ _id }).exec();
    return { ok: true };
  }

  async setProgress(
    studentId: Types.ObjectId,
    courseId: Types.ObjectId,
    progressPercent: number,
  ) {
    await this.enrollmentModel
      .updateOne(
        { studentId, courseId },
        {
          $set: {
            progressPercent: Math.max(0, Math.min(100, progressPercent)),
            ...(progressPercent >= 100
              ? { status: EnrollmentStatus.Completed, completedAt: new Date() }
              : { status: EnrollmentStatus.Active }),
          },
        },
      )
      .exec();
  }

  async assertEnrolled(
    studentId: Types.ObjectId,
    courseId: Types.ObjectId,
  ): Promise<EnrollmentDocument> {
    const enroll = await this.enrollmentModel
      .findOne({ studentId, courseId })
      .exec();
    if (!enroll) {
      throw new ForbiddenException('Not enrolled in this course');
    }
    return enroll;
  }
}
