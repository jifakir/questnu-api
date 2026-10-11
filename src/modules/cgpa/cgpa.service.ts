import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Course, CourseDocument } from '../academics/schemas/course.schema';
import { User, UserDocument } from '../../users/user.schema';
import {
  StudentCourseGrade,
  StudentCourseGradeDocument,
} from './schemas/student-course-grade.schema';
import {
  StudentYearCgpa,
  StudentYearCgpaDocument,
} from './schemas/student-year-cgpa.schema';
import {
  DeleteCourseGradeDto,
  UpsertCourseGradeDto,
} from './dto/cgpa.dto';

@Injectable()
export class CgpaService {
  constructor(
    @InjectModel(StudentCourseGrade.name)
    private readonly gradeModel: Model<StudentCourseGradeDocument>,
    @InjectModel(StudentYearCgpa.name)
    private readonly yearModel: Model<StudentYearCgpaDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Course.name)
    private readonly courseModel: Model<CourseDocument>,
  ) {}

  async getOverview(studentId: string) {
    const user = await this.userModel.findById(studentId).exec();
    if (!user) throw new NotFoundException('User not found');

    const years = await this.yearModel
      .find({ studentId: new Types.ObjectId(studentId) })
      .sort({ departmentId: 1, yearId: 1 })
      .lean()
      .exec();

    return {
      cgpa: user.cgpa ?? null,
      targetCgpa: user.targetCgpa ?? null,
      years: years.map((y) => ({
        departmentId: y.departmentId,
        yearId: y.yearId,
        cgpa: y.cgpa,
        totalCredits: y.totalCredits,
        earnedPoints: y.earnedPoints,
        gradedCount: y.gradedCount,
        updatedAt: (y as { updatedAt?: Date }).updatedAt ?? null,
      })),
    };
  }

  async getYearDetail(
    studentId: string,
    departmentId: string,
    yearId: string,
  ) {
    const dept = departmentId.trim().toLowerCase();
    const year = yearId.trim();
    const oid = new Types.ObjectId(studentId);

    const [summary, grades] = await Promise.all([
      this.yearModel
        .findOne({ studentId: oid, departmentId: dept, yearId: year })
        .lean()
        .exec(),
      this.gradeModel
        .find({ studentId: oid, departmentId: dept, yearId: year })
        .sort({ courseCode: 1 })
        .lean()
        .exec(),
    ]);

    const codes = [...new Set(grades.map((g) => g.courseCode))];
    const courses = codes.length
      ? await this.courseModel
          .find({ code: { $in: codes } })
          .select({ code: 1, title: 1, titleBn: 1 })
          .lean()
          .exec()
      : [];
    const titleByCode = new Map(
      courses.map((c) => [c.code, { title: c.title, titleBn: c.titleBn }]),
    );

    return {
      departmentId: dept,
      yearId: year,
      cgpa: summary?.cgpa ?? null,
      totalCredits: summary?.totalCredits ?? 0,
      earnedPoints: summary?.earnedPoints ?? 0,
      gradedCount: summary?.gradedCount ?? grades.length,
      courses: grades.map((g) => {
        const meta = titleByCode.get(g.courseCode);
        return {
          courseCode: g.courseCode,
          title: meta?.title ?? g.courseCode,
          titleBn: meta?.titleBn ?? '',
          credits: g.credits,
          gradeLabel: g.gradeLabel,
          gradePoint: g.gradePoint,
          updatedAt: (g as { updatedAt?: Date }).updatedAt ?? null,
        };
      }),
    };
  }

  async upsertGrades(studentId: string, items: UpsertCourseGradeDto[]) {
    const oid = new Types.ObjectId(studentId);
    const touched = new Set<string>();

    for (const item of items) {
      const departmentId = item.departmentId.trim().toLowerCase();
      const yearId = item.yearId.trim();
      const courseCode = item.courseCode.trim();
      await this.gradeModel
        .findOneAndUpdate(
          { studentId: oid, departmentId, yearId, courseCode },
          {
            $set: {
              credits: item.credits,
              gradeLabel: item.gradeLabel.trim(),
              gradePoint: item.gradePoint,
            },
          },
          { upsert: true, new: true },
        )
        .exec();
      touched.add(`${departmentId}::${yearId}`);
    }

    for (const key of touched) {
      const [departmentId, yearId] = key.split('::');
      await this.recomputeYear(oid, departmentId, yearId);
    }
    await this.recomputeOverall(oid);

    return this.getOverview(studentId);
  }

  async deleteGrade(studentId: string, dto: DeleteCourseGradeDto) {
    const oid = new Types.ObjectId(studentId);
    const departmentId = dto.departmentId.trim().toLowerCase();
    const yearId = dto.yearId.trim();
    const filter: Record<string, unknown> = {
      studentId: oid,
      departmentId,
      yearId,
    };
    if (dto.courseCode?.trim()) {
      filter.courseCode = dto.courseCode.trim();
    }
    await this.gradeModel.deleteMany(filter).exec();
    await this.recomputeYear(oid, departmentId, yearId);
    await this.recomputeOverall(oid);
    return this.getOverview(studentId);
  }

  async setTargetCgpa(studentId: string, targetCgpa: number) {
    const user = await this.userModel.findById(studentId).exec();
    if (!user) throw new NotFoundException('User not found');
    user.targetCgpa = targetCgpa;
    await user.save();
    return this.getOverview(studentId);
  }

  private async recomputeYear(
    studentId: Types.ObjectId,
    departmentId: string,
    yearId: string,
  ) {
    const grades = await this.gradeModel
      .find({ studentId, departmentId, yearId })
      .lean()
      .exec();

    if (grades.length === 0) {
      await this.yearModel
        .deleteOne({ studentId, departmentId, yearId })
        .exec();
      return;
    }

    let totalCredits = 0;
    let earnedPoints = 0;
    for (const g of grades) {
      totalCredits += g.credits;
      earnedPoints += g.credits * g.gradePoint;
    }
    const cgpa = totalCredits > 0 ? earnedPoints / totalCredits : 0;

    await this.yearModel
      .findOneAndUpdate(
        { studentId, departmentId, yearId },
        {
          $set: {
            cgpa,
            totalCredits,
            earnedPoints,
            gradedCount: grades.length,
          },
        },
        { upsert: true },
      )
      .exec();
  }

  private async recomputeOverall(studentId: Types.ObjectId) {
    const years = await this.yearModel.find({ studentId }).lean().exec();
    let totalCredits = 0;
    let earnedPoints = 0;
    for (const y of years) {
      totalCredits += y.totalCredits;
      earnedPoints += y.earnedPoints;
    }
    const cgpa = totalCredits > 0 ? earnedPoints / totalCredits : null;
    await this.userModel
      .updateOne(
        { _id: studentId },
        cgpa == null ? { $unset: { cgpa: 1 } } : { $set: { cgpa } },
      )
      .exec();
  }
}
