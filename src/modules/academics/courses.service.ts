import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AcademicDraftStatus } from './academic.constants';
import {
  hasSyllabusDetails,
  isSharedCoursePlaceholder,
  SHARED_COURSE_PLACEHOLDER_IDS,
  syllabusTags,
} from './academic.util';
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
  /** Used only while merging an older copy. Later edits replace the course. */
  updatedAt?: Date;
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
      const stamped = row as { updatedAt?: Date };
      await this.upsertFromSubject({
        ...row,
        updatedAt: stamped.updatedAt ? new Date(stamped.updatedAt) : undefined,
      });
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
    } else if (this.shouldReplace(incoming, existing, row.updatedAt)) {
      await this.courses.updateOne({ code }, { $set: incoming }).exec();
    } else if (
      existing.status !== AcademicDraftStatus.Ready &&
      row.status === AcademicDraftStatus.Ready
    ) {
      await this.courses
        .updateOne({ code }, { $set: { status: AcademicDraftStatus.Ready } })
        .exec();
    }

    if (isSharedCoursePlaceholder(row.departmentId)) return;

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

  /** Explicit upload replaces the shared syllabus. Seed still keeps the richer copy. */
  async replaceContent(row: CourseSource) {
    const code = row.code.trim();
    if (!code) return;
    const incoming = this.contentOf(row);
    await this.courses
      .updateOne(
        { code },
        {
          $set: {
            ...incoming,
            status: row.status ?? AcademicDraftStatus.Draft,
          },
          $setOnInsert: { code },
        },
        { upsert: true },
      )
      .exec();
  }

  /** Store the unique course by code. Does not attach a department. */
  async upsertContent(row: CourseSource) {
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
      return;
    }
    if (this.shouldReplace(incoming, existing, row.updatedAt)) {
      await this.courses.updateOne({ code }, { $set: incoming }).exec();
    } else if (
      existing.status !== AcademicDraftStatus.Ready &&
      row.status === AcademicDraftStatus.Ready
    ) {
      await this.courses
        .updateOne({ code }, { $set: { status: AcademicDraftStatus.Ready } })
        .exec();
    }
  }

  async removeByCode(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return { deleted: false };
    await Promise.all([
      this.courses.deleteOne({ code: trimmed }).exec(),
      this.links.deleteMany({ courseCode: trimmed }).exec(),
    ]);
    return { deleted: true };
  }

  async dropPlaceholderLinks() {
    await this.links
      .deleteMany({
        departmentId: { $in: [...SHARED_COURSE_PLACEHOLDER_IDS] },
      })
      .exec();
  }

  async unlinkSubject(slug: string) {
    await this.links.updateMany(
      { subjectSlugs: slug },
      { $pull: { subjectSlugs: slug } },
    );
    await this.links.deleteMany({ subjectSlugs: { $size: 0 } }).exec();
  }

  /** Courses already in the syllabus, one card per course code, plus anything uploaded. */
  async list() {
    const [stored, papers] = await Promise.all([
      this.courses.find().lean().exec(),
      this.subjects
        .find({ code: { $exists: true, $nin: [null, ''] } })
        .select({
          code: 1,
          title: 1,
          titleBn: 1,
          marks: 1,
          credits: 1,
          departmentId: 1,
          yearId: 1,
          slug: 1,
          status: 1,
          introduction: 1,
          description: 1,
          labDetails: 1,
          objectives: 1,
          outcomes: 1,
          prescribedTexts: 1,
          outline: 1,
          books: 1,
        })
        .lean()
        .exec(),
    ]);

    type Offering = {
      departmentId: string;
      yearId: string;
      subjectSlugs: string[];
    };
    type Row = {
      code: string;
      title: string;
      titleBn: string;
      marks: number;
      credits: number;
      status: AcademicDraftStatus;
      hasSyllabus: boolean;
      departments: Set<string>;
      offerings: Map<string, Offering>;
    };

    const byCode = new Map<string, Row>();
    const ensure = (code: string) => {
      let row = byCode.get(code);
      if (!row) {
        row = {
          code,
          title: '',
          titleBn: '',
          marks: 100,
          credits: 0,
          status: AcademicDraftStatus.Draft,
          hasSyllabus: false,
          departments: new Set(),
          offerings: new Map(),
        };
        byCode.set(code, row);
      }
      return row;
    };

    for (const course of stored) {
      const code = course.code?.trim();
      if (!code) continue;
      const row = ensure(code);
      row.title = course.title || row.title;
      row.titleBn = course.titleBn || row.titleBn;
      row.marks = course.marks ?? row.marks;
      row.credits = course.credits ?? row.credits;
      row.status = course.status ?? row.status;
      if (hasSyllabusDetails(course)) row.hasSyllabus = true;
    }

    for (const paper of papers) {
      const code = paper.code?.trim();
      if (!code) continue;
      const row = ensure(code);
      if (!row.title) row.title = paper.title;
      if (!row.titleBn) row.titleBn = paper.titleBn ?? '';
      if (!stored.some((course) => course.code === code)) {
        row.marks = paper.marks ?? row.marks;
        row.credits = paper.credits ?? row.credits;
      }
      if (paper.status === AcademicDraftStatus.Ready) {
        row.status = AcademicDraftStatus.Ready;
      }
      if (hasSyllabusDetails(paper)) row.hasSyllabus = true;
      if (!paper.departmentId || isSharedCoursePlaceholder(paper.departmentId)) {
        continue;
      }
      row.departments.add(paper.departmentId);
      const key = `${paper.departmentId}:${paper.yearId}`;
      const offering = row.offerings.get(key) ?? {
        departmentId: paper.departmentId,
        yearId: paper.yearId,
        subjectSlugs: [],
      };
      if (paper.slug && !offering.subjectSlugs.includes(paper.slug)) {
        offering.subjectSlugs.push(paper.slug);
      }
      row.offerings.set(key, offering);
    }

    return [...byCode.values()]
      .filter((row) => row.title)
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((row) => ({
        code: row.code,
        title: row.title,
        titleBn: row.titleBn,
        marks: row.marks,
        credits: row.credits,
        status: row.status,
        tags: syllabusTags(row.hasSyllabus),
        departments: [...row.departments].sort(),
        offerings: [...row.offerings.values()].sort(
          (a, b) =>
            a.departmentId.localeCompare(b.departmentId) ||
            a.yearId.localeCompare(b.yearId),
        ),
      }));
  }

  async findByCode(code: string) {
    const trimmed = code.trim();
    const stored = await this.courses.findOne({ code: trimmed }).lean().exec();
    let content: {
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
      outcomes?: SubjectOutcome[];
      prescribedTexts?: string[];
      outline?: SubjectOutlineUnit[];
      labDetails?: string;
      books?: string[];
      status?: AcademicDraftStatus;
    } | null = stored;
    if (!content) {
      const papers = await this.subjects.find({ code: trimmed }).lean().exec();
      if (!papers.length) return null;
      papers.sort((a, b) => this.richness(b) - this.richness(a));
      content =
        papers.find((row) => !isSharedCoursePlaceholder(row.departmentId)) ??
        papers[0];
    }
    const offerings = await this.links
      .find({ courseCode: trimmed })
      .sort({ departmentId: 1, yearId: 1 })
      .lean()
      .exec();
    const subjectOfferings =
      offerings.length > 0
        ? offerings.map((item) => ({
            departmentId: item.departmentId,
            yearId: item.yearId,
            subjectSlugs: item.subjectSlugs ?? [],
          }))
        : (
            await this.subjects
              .find({ code: trimmed })
              .select({ departmentId: 1, yearId: 1, slug: 1 })
              .lean()
              .exec()
          )
            .filter((row) => !isSharedCoursePlaceholder(row.departmentId))
            .map((row) => ({
              departmentId: row.departmentId,
              yearId: row.yearId,
              subjectSlugs: [row.slug],
            }));
    return {
      code: trimmed,
      title: content.title,
      titleBn: content.titleBn ?? '',
      marks: content.marks ?? 100,
      credits: content.credits ?? 0,
      classHours: content.classHours ?? null,
      examDuration: content.examDuration ?? '',
      orientation: content.orientation ?? '',
      description: content.description ?? '',
      introduction: content.introduction ?? '',
      objectives: content.objectives ?? [],
      outcomes: content.outcomes ?? [],
      prescribedTexts: content.prescribedTexts ?? [],
      outline: content.outline ?? [],
      labDetails: content.labDetails ?? '',
      books: content.books ?? [],
      status: content.status ?? AcademicDraftStatus.Draft,
      tags: syllabusTags(
        hasSyllabusDetails(content) ||
          (
            await this.subjects
              .find({ code: trimmed })
              .select({
                introduction: 1,
                description: 1,
                labDetails: 1,
                objectives: 1,
                outcomes: 1,
                prescribedTexts: 1,
                outline: 1,
                books: 1,
              })
              .lean()
              .exec()
          ).some((row) => hasSyllabusDetails(row)),
      ),
      departments: [
        ...new Set(subjectOfferings.map((item) => item.departmentId)),
      ],
      offerings: subjectOfferings,
    };
  }

  async updateByCode(
    code: string,
    patch: Partial<CourseSource> & { status?: AcademicDraftStatus },
  ) {
    const trimmed = code.trim();
    const existing = await this.findByCode(trimmed);
    if (!existing) return null;
    const merged: CourseSource = {
      code: trimmed,
      title: patch.title ?? existing.title,
      titleBn: patch.titleBn ?? existing.titleBn,
      marks: patch.marks ?? existing.marks,
      credits: patch.credits ?? existing.credits,
      classHours:
        patch.classHours !== undefined
          ? patch.classHours
          : existing.classHours,
      examDuration: patch.examDuration ?? existing.examDuration,
      orientation: patch.orientation ?? existing.orientation,
      description: patch.description ?? existing.description,
      introduction: patch.introduction ?? existing.introduction,
      objectives: patch.objectives ?? existing.objectives,
      outcomes: patch.outcomes ?? existing.outcomes,
      prescribedTexts: patch.prescribedTexts ?? existing.prescribedTexts,
      outline: patch.outline ?? existing.outline,
      labDetails: patch.labDetails ?? existing.labDetails,
      books: patch.books ?? existing.books,
      status: patch.status ?? existing.status,
      departmentId: existing.offerings[0]?.departmentId ?? 'common',
      yearId: existing.offerings[0]?.yearId ?? '1',
      slug: `course-${trimmed}`,
    };
    await this.replaceContent(merged);
    await this.subjects
      .updateMany(
        { code: trimmed },
        {
          $set: {
            title: merged.title,
            titleBn: merged.titleBn ?? '',
            marks: merged.marks ?? 100,
            credits: merged.credits ?? 0,
            classHours: merged.classHours ?? null,
            status: merged.status ?? AcademicDraftStatus.Draft,
          },
          $unset: this.syllabusCopyFields(),
        },
      )
      .exec();
    return this.findByCode(trimmed);
  }

  /** Drop syllabus bodies that were copied onto every department offering. */
  async stripSubjectSyllabusCopies() {
    const codes = await this.courses.distinct('code').exec();
    if (!codes.length) return { stripped: 0 };
    const result = await this.subjects
      .updateMany(
        { code: { $in: codes } },
        { $unset: this.syllabusCopyFields() },
      )
      .exec();
    return { stripped: result.modifiedCount ?? 0 };
  }

  async summariesByCode(codes: string[]) {
    const unique = [...new Set(codes.map((code) => code.trim()).filter(Boolean))];
    if (!unique.length) return new Map<string, {
      code: string;
      title: string;
      titleBn?: string;
      marks?: number;
      credits?: number;
      classHours?: number | null;
      status?: AcademicDraftStatus;
    }>();
    const rows = await this.courses
      .find({ code: { $in: unique } })
      .select({
        code: 1,
        title: 1,
        titleBn: 1,
        marks: 1,
        credits: 1,
        classHours: 1,
        status: 1,
      })
      .lean()
      .exec();
    return new Map(rows.map((row) => [row.code, row]));
  }

  private syllabusCopyFields() {
    return {
      introduction: 1,
      description: 1,
      objectives: 1,
      outcomes: 1,
      prescribedTexts: 1,
      outline: 1,
      labDetails: 1,
      books: 1,
      examDuration: 1,
      orientation: 1,
    };
  }

  private shouldReplace(
    incoming: {
      title?: string;
      introduction?: string;
      objectives?: string[];
      outcomes?: unknown[];
      outline?: unknown[];
      books?: string[];
      labDetails?: string;
    },
    existing: {
      title?: string;
      introduction?: string;
      objectives?: string[];
      outcomes?: unknown[];
      outline?: unknown[];
      books?: string[];
      labDetails?: string;
      updatedAt?: Date;
    },
    incomingAt?: Date,
  ) {
    const incomingScore = this.richness(incoming);
    const existingScore = this.richness(existing);
    if (incomingScore !== existingScore) return incomingScore > existingScore;
    if (!incomingAt || !existing.updatedAt) return false;
    return incomingAt.getTime() > new Date(existing.updatedAt).getTime();
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
