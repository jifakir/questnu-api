import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AcademicDraftStatus } from './academic.constants';
import { Course, CourseDocument } from './schemas/course.schema';
import { CourseLink, CourseLinkDocument } from './schemas/course-link.schema';
import {
  Subject,
  SubjectDocument,
  SubjectOutlineUnit,
  SubjectOutcome,
} from './schemas/subject.schema';

export type CourseSource = {
  code: string;
  title: string;
  titleBn?: string;
  marks?: number;
  credits?: number;
  classHours?: number | null;
  examDuration?: string;
  orientation?: string;
  description?: string;
  introduction?: string;
  objectives?: string[];
  outcomes?: Array<SubjectOutcome | { id: string; text: string; mappedPlos?: string[] }>;
  prescribedTexts?: string[];
  outline?: Array<
    SubjectOutlineUnit | {
      unit: string;
      topic: string;
      hours?: number | null;
      teachingStrategies?: string[];
      clos?: string[];
    }
  >;
  labDetails?: string;
  books?: string[];
  status?: AcademicDraftStatus;
  departmentId: string;
  yearId: string;
  slug: string;
};

@Injectable()
export class CoursesService {
  constructor(
    @InjectModel(Course.name)
    private readonly courses: Model<CourseDocument>,
    @InjectModel(CourseLink.name)
    private readonly links: Model<CourseLinkDocument>,
    @InjectModel(Subject.name)
    private readonly subjects: Model<SubjectDocument>,
  ) {}

  /** Rebuild courses and department links from every stored subject. Never deletes a subject. */
  async syncFromSubjects() {
    const rows = await this.subjects.find().lean().exec();
    let linked = 0;
    for (const row of rows) {
      if (!row.code?.trim() || !row.departmentId || !row.yearId || !row.slug) {
        continue;
      }
      await this.upsertFromSubject(row);
      linked += 1;
    }
    const [courses, links] = await Promise.all([
      this.courses.countDocuments().exec(),
      this.links.countDocuments().exec(),
    ]);
    return { subjects: linked, courses, links };
  }

  async upsertFromSubject(row: CourseSource) {
    const code = row.code.trim();
    if (!code) return;
    const incoming = this.contentOf(row);
    const existing = await this.courses.findOne({ code }).lean().exec();
    if (!existing) {
      await this.courses.create({
        code,
        ...incoming,
        status: row.status ?? AcademicDraftStatus.Draft,
      });
    } else if (this.richness(incoming) > this.richness(existing)) {
      await this.courses.updateOne({ code }, { $set: incoming }).exec();
    } else if (
      existing.status !== AcademicDraftStatus.Ready &&
      row.status === AcademicDraftStatus.Ready
    ) {
      await this.courses
        .updateOne({ code }, { $set: { status: AcademicDraftStatus.Ready } })
        .exec();
    }

    await this.links.updateOne(
      {
        courseCode: code,
        departmentId: row.departmentId,
        yearId: row.yearId,
      },
      {
        $setOnInsert: {
          courseCode: code,
          departmentId: row.departmentId,
          yearId: row.yearId,
        },
        $addToSet: { subjectSlugs: row.slug },
      },
      { upsert: true },
    );
  }

  async unlinkSubject(slug: string) {
    await this.links.updateMany(
      { subjectSlugs: slug },
      { $pull: { subjectSlugs: slug } },
    );
    await this.links.deleteMany({ subjectSlugs: { $size: 0 } }).exec();
  }

  async list() {
    const [courses, links] = await Promise.all([
      this.courses.find().sort({ code: 1 }).lean().exec(),
      this.links.find().lean().exec(),
    ]);
    const byCode = new Map<string, typeof links>();
    for (const link of links) {
      const group = byCode.get(link.courseCode) ?? [];
      group.push(link);
      byCode.set(link.courseCode, group);
    }
    return courses.map((course) => {
      const offerings = byCode.get(course.code) ?? [];
      return {
        ...course,
        departments: [
          ...new Set(offerings.map((item) => item.departmentId)),
        ].sort(),
        offerings: offerings.map((item) => ({
          departmentId: item.departmentId,
          yearId: item.yearId,
          subjectSlugs: item.subjectSlugs,
        })),
      };
    });
  }

  async findByCode(code: string) {
    const trimmed = code.trim();
    const course = await this.courses.findOne({ code: trimmed }).lean().exec();
    if (!course) return null;
    const offerings = await this.links
      .find({ courseCode: trimmed })
      .sort({ departmentId: 1, yearId: 1 })
      .lean()
      .exec();
    return {
      ...course,
      departments: [...new Set(offerings.map((item) => item.departmentId))],
      offerings: offerings.map((item) => ({
        departmentId: item.departmentId,
        yearId: item.yearId,
        subjectSlugs: item.subjectSlugs,
      })),
    };
  }

  private contentOf(row: CourseSource) {
    return {
      title: row.title,
      titleBn: row.titleBn ?? '',
      marks: row.marks ?? 100,
      credits: row.credits ?? 0,
      classHours: row.classHours ?? null,
      examDuration: row.examDuration ?? '',
      orientation: row.orientation ?? '',
      description: row.description ?? '',
      introduction: row.introduction ?? '',
      objectives: row.objectives ?? [],
      outcomes: (row.outcomes ?? []).map((item) => ({
        id: item.id,
        text: item.text,
        mappedPlos: item.mappedPlos ?? [],
      })),
      prescribedTexts: row.prescribedTexts ?? [],
      outline: (row.outline ?? []).map((item) => ({
        unit: item.unit,
        topic: item.topic,
        hours: item.hours ?? null,
        teachingStrategies: item.teachingStrategies ?? [],
        clos: item.clos ?? [],
      })),
      labDetails: row.labDetails ?? '',
      books: row.books ?? [],
    };
  }

  private richness(row: {
    title?: string;
    introduction?: string;
    objectives?: string[];
    outcomes?: unknown[];
    outline?: unknown[];
    books?: string[];
    labDetails?: string;
  }) {
    return (
      (row.outline?.length ?? 0) * 20 +
      (row.objectives?.length ?? 0) * 5 +
      (row.outcomes?.length ?? 0) * 5 +
      (row.books?.length ?? 0) * 3 +
      (row.introduction?.trim().length ?? 0) +
      (row.labDetails?.trim().length ?? 0) +
      (row.title?.trim().length ?? 0)
    );
  }
}
