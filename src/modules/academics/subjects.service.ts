import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AcademicDraftStatus } from './academic.constants';
import {
  assertSlug,
  canonicalDepartmentId,
  cleanStringList,
  DEPARTMENT_ALIASES,
  formatLabDetails,
  isSharedCoursePlaceholder,
  optionalText,
  SHARED_COURSE_PLACEHOLDER_IDS,
  splitIntroduction,
} from './academic.util';
import type { CreateSubjectDto, UpdateSubjectDto } from './dto/academic.dto';
import { Question, QuestionDocument } from './schemas/question.schema';
import {
  Subject,
  SubjectDocument,
  SubjectOutlineUnit,
  SubjectOutcome,
} from './schemas/subject.schema';
import { STARTER_DEPARTMENTS } from './seed/starter-catalog';
import { CoursesService } from './courses.service';
import { StructureService } from './structure.service';

const SUMMARY = {
  slug: 1,
  departmentId: 1,
  yearId: 1,
  code: 1,
  title: 1,
  titleBn: 1,
  marks: 1,
  credits: 1,
  classHours: 1,
  orientation: 1,
  status: 1,
  tags: 1,
  updatedAt: 1,
};

export type SubjectImportResult = {
  created: number;
  updated: number;
  failed: number;
  departmentsCreated: string[];
  yearsCreated: string[];
  errors: { slug?: string; message: string }[];
};

@Injectable()
export class SubjectsService {
  constructor(
    @InjectModel(Subject.name)
    private readonly subjects: Model<SubjectDocument>,
    @InjectModel(Question.name)
    private readonly questions: Model<QuestionDocument>,
    private readonly structure: StructureService,
    private readonly courses: CoursesService,
  ) {}

  async list(filters: { departmentId?: string; yearId?: string; status?: string }) {
    if (
      filters.departmentId &&
      isSharedCoursePlaceholder(filters.departmentId)
    ) {
      return [];
    }
    const query: Record<string, unknown> = {
      departmentId: { $nin: [...SHARED_COURSE_PLACEHOLDER_IDS] },
    };
    if (filters.departmentId) query.departmentId = assertSlug(filters.departmentId);
    if (filters.yearId) query.yearId = assertSlug(filters.yearId);
    if (filters.status) query.status = filters.status;
    const rows = await this.subjects
      .find(query, SUMMARY)
      .sort({ departmentId: 1, yearId: 1, code: 1 })
      .lean()
      .exec();
    const summaries = await this.courses.summariesByCode(
      rows.map((row) => row.code).filter((code): code is string => !!code?.trim()),
    );
    return rows.map((row) => {
      const course = summaries.get(row.code);
      if (!course) return row;
      return {
        ...row,
        title: course.title || row.title,
        titleBn: course.titleBn || row.titleBn,
        marks: course.marks ?? row.marks,
        credits: course.credits ?? row.credits,
        classHours: course.classHours ?? row.classHours,
        status: course.status ?? row.status,
      };
    });
  }

  async findOne(slug: string) {
    const doc = await this.subjects.findOne({ slug: assertSlug(slug) }).lean().exec();
    if (!doc) throw new NotFoundException('Course not found');
    return this.withCourseContent(doc);
  }

  async create(dto: CreateSubjectDto) {
    await this.structure.requireDepartment(dto.departmentId);
    await this.structure.requireYear(dto.yearId);
    try {
      const created = this.fromDto(dto);
      await this.courses.replaceContent(created);
      const doc = await this.subjects.create(this.offeringOf(created));
      await this.courses.upsertFromSubject(created);
      return this.withCourseContent(doc.toJSON());
    } catch (err) {
      if (this.isDuplicate(err)) {
        throw new ConflictException('Course id already exists');
      }
      throw err;
    }
  }

  async update(slug: string, dto: UpdateSubjectDto) {
    const current = assertSlug(slug);
    if (dto.departmentId) await this.structure.requireDepartment(dto.departmentId);
    if (dto.yearId) await this.structure.requireYear(dto.yearId);
    const next = dto.slug ? assertSlug(dto.slug) : current;
    const existing = await this.subjects.findOne({ slug: current }).lean().exec();
    if (!existing) throw new NotFoundException('Course not found');
    const doc = await this.subjects
      .findOneAndUpdate(
        { slug: current },
        { $set: this.offeringPatch(dto, next), $unset: this.syllabusUnset() },
        { new: true },
      )
      .lean()
      .exec();
    if (!doc) throw new NotFoundException('Course not found');
    const code = doc.code?.trim() || existing.code;
    const coursePatch = this.coursePatchFromDto(dto);
    const updated = await this.courses.updateByCode(code, coursePatch);
    if (!updated) {
      await this.courses.replaceContent({
        ...existing,
        ...coursePatch,
        code,
        departmentId: doc.departmentId,
        yearId: doc.yearId,
        slug: doc.slug,
        status: dto.status ?? existing.status,
      });
    }
    await this.courses.unlinkSubject(current);
    await this.courses.upsertFromSubject({
      ...doc,
      code,
      departmentId: doc.departmentId,
      yearId: doc.yearId,
      slug: doc.slug,
      title: dto.title ?? existing.title,
      status: dto.status ?? existing.status,
    });
    if (next !== current) {
      await this.questions.updateMany(
        { subjectSlug: current },
        {
          $set: {
            subjectSlug: next,
            ...(dto.departmentId ? { departmentId: assertSlug(dto.departmentId) } : {}),
            ...(dto.yearId ? { yearId: assertSlug(dto.yearId) } : {}),
          },
        },
      );
    } else if (dto.departmentId || dto.yearId) {
      await this.questions.updateMany(
        { subjectSlug: current },
        {
          $set: {
            ...(dto.departmentId
              ? { departmentId: assertSlug(dto.departmentId) }
              : {}),
            ...(dto.yearId ? { yearId: assertSlug(dto.yearId) } : {}),
          },
        },
      );
    }
    return this.findOne(doc.slug);
  }

  async remove(slug: string) {
    const id = assertSlug(slug);
    const used = await this.questions.countDocuments({ subjectSlug: id }).exec();
    if (used > 0) {
      throw new ConflictException(
        `Cannot delete: ${used} question(s) still belong to this course`,
      );
    }
    await this.courses.unlinkSubject(id);
    const res = await this.subjects.deleteOne({ slug: id }).exec();
    if (!res.deletedCount) throw new NotFoundException('Course not found');
    return { deleted: true };
  }

  /** Move hyphen department ids onto the app's underscore ids, and fill Introduction. */
  async alignWithApp() {
    const rows = await this.subjects.find().lean().exec();
    let remapped = 0;
    let introductions = 0;
    for (const row of rows) {
      const departmentId = canonicalDepartmentId(row.departmentId);
      const needsIntro = !`${row.introduction ?? ''}`.trim();
      const split = needsIntro
        ? splitIntroduction(row.description ?? '', row.objectives ?? [])
        : null;
      const $set: Record<string, unknown> = {};
      if (departmentId !== row.departmentId) {
        $set.departmentId = departmentId;
        remapped += 1;
      }
      if (split?.introduction) {
        $set.introduction = split.introduction;
        $set.objectives = split.objectives;
        introductions += 1;
      }
      if (Object.keys($set).length) {
        await this.subjects.updateOne({ _id: row._id }, { $set });
      }
    }

    const questions = await this.questions.find().select('departmentId').lean().exec();
    let remappedQuestions = 0;
    for (const question of questions) {
      const departmentId = canonicalDepartmentId(question.departmentId);
      if (departmentId === question.departmentId) continue;
      await this.questions.updateOne(
        { _id: question._id },
        { $set: { departmentId } },
      );
      remappedQuestions += 1;
    }

    let removedDepartments = 0;
    for (const dept of STARTER_DEPARTMENTS) {
      const aliases = [
        dept.slug.replace(/_/g, '-'),
        ...Object.entries(DEPARTMENT_ALIASES)
          .filter(([, canonical]) => canonical === dept.slug)
          .map(([alias]) => alias),
      ];
      for (const alias of aliases) {
        if (alias === dept.slug) continue;
        const stillUsed = await this.subjects
          .countDocuments({ departmentId: alias })
          .exec();
        if (stillUsed > 0) continue;
        try {
          await this.structure.removeDepartment(alias);
          removedDepartments += 1;
        } catch {
          /* alias was never created */
        }
      }
    }

    return { remapped, introductions, removedDepartments, remappedQuestions };
  }

  /** Practical papers store the intro inside labDetails, which was saved as "[object Object]". */
  async fillLabIntroductions(rows: unknown[]) {
    let filled = 0;
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      const item = row as Record<string, unknown>;
      const slug = optionalText(item.id ?? item.slug, 81).toLowerCase();
      const labDetails = formatLabDetails(item.labDetails);
      if (!slug || !labDetails) continue;
      const res = await this.subjects.updateOne(
        {
          slug,
          $or: [
            { introduction: '' },
            { introduction: { $exists: false } },
            { introduction: null },
          ],
        },
        { $set: { labDetails, introduction: labDetails } },
      );
      if (res.modifiedCount) filled += 1;
    }
    return filled;
  }

  async importJson(
    raw: unknown,
    opts: { createMissingStructure: boolean; insertStatus?: AcademicDraftStatus },
  ): Promise<SubjectImportResult> {
    const rows = this.asSubjectArray(raw);
    const result: SubjectImportResult = {
      created: 0,
      updated: 0,
      failed: 0,
      departmentsCreated: [],
      yearsCreated: [],
      errors: [],
    };

    const knownDepartments = new Set(
      (await this.structure.listDepartments()).map((item) => item.slug),
    );
    const knownYears = new Set(
      (await this.structure.listYears()).map((item) => item.slug),
    );

    for (const row of rows) {
      try {
        const payload = this.fromImportRow(row);
        if (isSharedCoursePlaceholder(payload.departmentId)) {
          await this.courses.upsertContent({
            ...payload,
            status: opts.insertStatus ?? AcademicDraftStatus.Draft,
          });
          continue;
        }
        if (opts.createMissingStructure) {
          if (!knownDepartments.has(payload.departmentId)) {
            await this.structure.ensureDepartment(payload.departmentId);
            knownDepartments.add(payload.departmentId);
            result.departmentsCreated.push(payload.departmentId);
          }
          if (!knownYears.has(payload.yearId)) {
            await this.structure.ensureYear(payload.yearId);
            knownYears.add(payload.yearId);
            result.yearsCreated.push(payload.yearId);
          }
        } else {
          await this.structure.requireDepartment(payload.departmentId);
          await this.structure.requireYear(payload.yearId);
        }

        const offering = this.offeringOf({
          ...payload,
          status: opts.insertStatus ?? AcademicDraftStatus.Draft,
        });
        const res = await this.subjects.updateOne(
          { slug: payload.slug },
          {
            $set: offering,
            $unset: this.syllabusUnset(),
          },
          { upsert: true },
        );
        if (res.upsertedCount) result.created += 1;
        else result.updated += 1;
        await this.courses.upsertFromSubject({
          ...payload,
          status: offering.status,
        });
      } catch (err) {
        result.failed += 1;
        if (result.errors.length < 40) {
          result.errors.push({
            slug: this.rowSlug(row),
            message: err instanceof Error ? err.message : 'Import failed',
          });
        }
      }
    }

    return result;
  }

  /**
   * Save an uploaded syllabus as one course per code, then offer it in the
   * selected departments. Does not create a department from the file.
   */
  async publishUpload(
    raw: unknown,
    opts: {
      yearId: string;
      departmentIds: string[];
      status?: AcademicDraftStatus;
    },
  ) {
    const yearId = assertSlug(opts.yearId, 'yearId');
    await this.structure.requireYear(yearId);
    const departmentIds = await this.realDepartments(opts.departmentIds);
    const rows =
      raw &&
      typeof raw === 'object' &&
      !Array.isArray(raw) &&
      !Array.isArray((raw as { subjects?: unknown }).subjects)
        ? [raw]
        : this.asSubjectArray(raw);
    const result = {
      courses: 0,
      created: 0,
      linked: 0,
      codes: [] as string[],
    };

    for (const row of rows) {
      const payload = this.fromImportRow({
        ...(row as Record<string, unknown>),
        departmentId: departmentIds[0],
        yearId,
      });
      const status = opts.status ?? AcademicDraftStatus.Ready;
      await this.courses.replaceContent({ ...payload, status });
      result.courses += 1;
      result.codes.push(payload.code);
      const attached = await this.attachToDepartments(payload, {
        yearId,
        departmentIds,
        status,
        overwrite: true,
      });
      result.created += attached.created;
      result.linked += attached.linked;
    }
    return result;
  }

  async removeByCode(code: string) {
    const trimmed = code.trim();
    if (!trimmed) throw new BadRequestException('Course code is required');
    const papers = await this.subjects
      .find({ code: trimmed })
      .select({ slug: 1 })
      .lean()
      .exec();
    const slugs = papers.map((row) => row.slug).filter(Boolean);
    if (slugs.length) {
      const used = await this.questions
        .countDocuments({ subjectSlug: { $in: slugs } })
        .exec();
      if (used > 0) {
        throw new ConflictException(
          `Cannot delete: ${used} question(s) still belong to this course`,
        );
      }
      await this.subjects.deleteMany({ code: trimmed }).exec();
      for (const slug of slugs) {
        await this.courses.unlinkSubject(slug);
      }
    }
    await this.courses.removeByCode(trimmed);
    return { deleted: true, offerings: slugs.length };
  }

  async linkStoredCourse(
    code: string,
    opts: {
      yearId: string;
      departmentIds: string[];
      status?: AcademicDraftStatus;
    },
  ) {
    const yearId = assertSlug(opts.yearId, 'yearId');
    await this.structure.requireYear(yearId);
    const departmentIds = await this.realDepartments(opts.departmentIds);
    const trimmed = code.trim();
    let course = await this.courses.findByCode(trimmed);
    if (!course) {
      const papers = await this.subjects.find({ code: trimmed }).lean().exec();
      papers.sort(
        (a, b) =>
          (b.outline?.length ?? 0) * 20 +
          (b.introduction?.length ?? 0) -
          ((a.outline?.length ?? 0) * 20 + (a.introduction?.length ?? 0)),
      );
      const paper =
        papers.find((row) => !isSharedCoursePlaceholder(row.departmentId)) ??
        papers[0];
      if (!paper) throw new NotFoundException('Course not found');
      await this.courses.upsertContent({
        ...paper,
        departmentId: paper.departmentId,
        yearId: paper.yearId,
        slug: paper.slug,
      });
      course = await this.courses.findByCode(trimmed);
    }
    if (!course) throw new NotFoundException('Course not found');
    const status = opts.status ?? course.status ?? AcademicDraftStatus.Ready;
    return this.attachToDepartments(
      {
        slug: `course-${course.code}`,
        departmentId: departmentIds[0],
        yearId,
        code: course.code,
        title: course.title,
        titleBn: course.titleBn ?? '',
        marks: course.marks,
        credits: course.credits,
        classHours: course.classHours,
        examDuration: course.examDuration ?? '',
        orientation: course.orientation ?? '',
        description: course.description ?? '',
        introduction: course.introduction ?? '',
        objectives: course.objectives ?? [],
        outcomes: course.outcomes ?? [],
        prescribedTexts: course.prescribedTexts ?? [],
        outline: course.outline ?? [],
        labDetails: course.labDetails ?? '',
        books: course.books ?? [],
      },
      { yearId, departmentIds, status, overwrite: false },
    );
  }

  private async realDepartments(ids: string[]) {
    const departmentIds = [
      ...new Set(
        ids
          .map((id) => canonicalDepartmentId(assertSlug(id, 'departmentId')))
          .filter((id) => !isSharedCoursePlaceholder(id)),
      ),
    ];
    if (!departmentIds.length) {
      throw new BadRequestException('Choose at least one department');
    }
    for (const id of departmentIds) {
      await this.structure.requireDepartment(id);
    }
    return departmentIds;
  }

  private offeringSlug(departmentId: string, code: string) {
    return assertSlug(
      `${departmentId}-${code}`
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .slice(0, 81),
      'Course id',
    );
  }

  private async attachToDepartments(
    payload: ReturnType<SubjectsService['fromImportRow']>,
    opts: {
      yearId: string;
      departmentIds: string[];
      status: AcademicDraftStatus;
      overwrite: boolean;
    },
  ) {
    let created = 0;
    let linked = 0;
    for (const departmentId of opts.departmentIds) {
      const existing = await this.subjects
        .findOne({
          departmentId,
          yearId: opts.yearId,
          code: payload.code,
        })
        .lean()
        .exec();
      const slug = existing?.slug ?? this.offeringSlug(departmentId, payload.code);
      const offering = this.offeringOf({
        ...payload,
        slug,
        departmentId,
        yearId: opts.yearId,
        status: opts.status,
      });
      if (!existing) {
        await this.subjects.create(offering);
        created += 1;
      } else if (opts.overwrite) {
        await this.subjects
          .updateOne(
            { slug },
            { $set: offering, $unset: this.syllabusUnset() },
          )
          .exec();
      }
      await this.courses.upsertFromSubject({
        ...payload,
        slug,
        departmentId,
        yearId: opts.yearId,
        status: opts.status,
      });
      linked += 1;
    }
    return { created, linked };
  }

  /** Compulsory-course JSON is a course, not a department paper. */
  async importAsSharedCourse(
    row: unknown,
    status = AcademicDraftStatus.Ready,
  ) {
    const payload = this.fromImportRow(row);
    await this.courses.upsertContent({ ...payload, status });
  }

  /**
   * Drop departments created from compulsory-course folders.
   * Questions move onto a real department copy of the same course code.
   */
  async purgeSharedCoursePlaceholders() {
    const rows = await this.subjects
      .find({ departmentId: { $in: [...SHARED_COURSE_PLACEHOLDER_IDS] } })
      .lean()
      .exec();
    for (const row of rows) {
      const real = await this.subjects
        .findOne({
          code: row.code,
          yearId: row.yearId,
          departmentId: { $nin: [...SHARED_COURSE_PLACEHOLDER_IDS] },
        })
        .lean()
        .exec();
      if (real) {
        await this.questions
          .updateMany(
            { subjectSlug: row.slug },
            {
              $set: {
                subjectSlug: real.slug,
                departmentId: real.departmentId,
                yearId: real.yearId,
              },
            },
          )
          .exec();
      }
      await this.courses.unlinkSubject(row.slug);
      await this.subjects.deleteOne({ slug: row.slug }).exec();
    }
    await this.courses.dropPlaceholderLinks();
    await this.structure.removeSharedCourseDepartments();
  }

  private asSubjectArray(raw: unknown): unknown[] {
    if (Array.isArray(raw)) return raw;
    if (
      raw &&
      typeof raw === 'object' &&
      Array.isArray((raw as { subjects?: unknown }).subjects)
    ) {
      return (raw as { subjects: unknown[] }).subjects;
    }
    throw new BadRequestException(
      'Syllabus file must be a JSON array of courses, or { "subjects": [...] }',
    );
  }

  private fromImportRow(row: unknown) {
    if (!row || typeof row !== 'object') {
      throw new BadRequestException('Course row is not an object');
    }
    const item = row as Record<string, unknown>;
    const title = optionalText(item.title, 300);
    const code = optionalText(item.code, 40);
    if (!title || !code) {
      throw new BadRequestException('Course needs a title and code');
    }
    const rawId = String(item.id ?? item.slug ?? '').trim();
    const slug = assertSlug(
      rawId ||
        `course-${code}`
          .toLowerCase()
          .replace(/[^a-z0-9_-]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 81),
      'Course id',
    );
    const departmentId = assertSlug(
      String(item.departmentId ?? item.department_id ?? ''),
      'departmentId',
    );
    const yearId = assertSlug(String(item.yearId ?? item.year_id ?? ''), 'yearId');
    const description = optionalText(item.description, 16000);
    const objectives = cleanStringList(item.objectives);
    const introFromFile = optionalText(item.introduction, 16000);
    const split = introFromFile
      ? { introduction: introFromFile, objectives }
      : splitIntroduction(description, objectives);
    const labDetails = formatLabDetails(item.labDetails);
    return {
      slug,
      departmentId: canonicalDepartmentId(departmentId),
      yearId,
      code,
      title,
      titleBn: optionalText(item.titleBn ?? item.title_bn, 300),
      marks: this.num(item.marks, 100),
      credits: this.num(item.credits, 0),
      classHours: item.classHours == null && item.class_hours == null
        ? null
        : this.num(item.classHours ?? item.class_hours, 0),
      examDuration: optionalText(item.examDuration, 80),
      orientation: optionalText(item.orientation, 80),
      description,
      introduction: split.introduction || labDetails,
      objectives: split.objectives,
      outcomes: this.outcomes(item.outcomes),
      prescribedTexts: cleanStringList(item.prescribedTexts),
      outline: this.outline(item.outline),
      labDetails,
      books: cleanStringList(item.books),
    };
  }

  private outcomes(value: unknown): SubjectOutcome[] {
    if (!Array.isArray(value)) return [];
    const out: SubjectOutcome[] = [];
    for (const item of value) {
      if (typeof item === 'string' && item.trim()) {
        out.push({ id: `CLO-${out.length + 1}`, text: item.trim(), mappedPlos: [] });
        continue;
      }
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const text = optionalText(row.text, 4000);
      if (!text) continue;
      out.push({
        id: optionalText(row.id, 40) || `CLO-${out.length + 1}`,
        text,
        mappedPlos: cleanStringList(row.mappedPlos, 20),
      });
    }
    return out.slice(0, 80);
  }

  private outline(value: unknown): SubjectOutlineUnit[] {
    if (!Array.isArray(value)) return [];
    const out: SubjectOutlineUnit[] = [];
    for (const item of value) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const topic = optionalText(row.topic, 8000);
      if (!topic) continue;
      out.push({
        unit: optionalText(row.unit, 40) || String(out.length + 1),
        topic,
        hours: row.hours == null ? null : this.num(row.hours, 0),
        teachingStrategies: cleanStringList(row.teachingStrategies, 20),
        clos: cleanStringList(row.clos, 20),
      });
    }
    return out.slice(0, 80);
  }

  private fromDto(dto: CreateSubjectDto) {
    return {
      slug: assertSlug(dto.slug),
      departmentId: canonicalDepartmentId(assertSlug(dto.departmentId)),
      yearId: assertSlug(dto.yearId),
      code: dto.code.trim(),
      title: dto.title.trim(),
      titleBn: dto.titleBn?.trim() ?? '',
      marks: dto.marks ?? 100,
      credits: dto.credits ?? 0,
      classHours: dto.classHours ?? null,
      examDuration: dto.examDuration?.trim() ?? '',
      orientation: dto.orientation?.trim() ?? '',
      description: dto.description?.trim() ?? '',
      introduction: dto.introduction?.trim() ?? '',
      objectives: cleanStringList(dto.objectives),
      outcomes: dto.outcomes ?? [],
      prescribedTexts: cleanStringList(dto.prescribedTexts),
      outline: dto.outline ?? [],
      labDetails: dto.labDetails?.trim() ?? '',
      books: cleanStringList(dto.books),
      status: dto.status ?? AcademicDraftStatus.Draft,
    };
  }

  private patchFromDto(dto: UpdateSubjectDto, nextSlug: string) {
    const $set: Record<string, unknown> = {};
    if (dto.slug) $set.slug = nextSlug;
    if (dto.departmentId) $set.departmentId = canonicalDepartmentId(assertSlug(dto.departmentId));
    if (dto.yearId) $set.yearId = assertSlug(dto.yearId);
    if (dto.code !== undefined) $set.code = dto.code.trim();
    if (dto.title !== undefined) $set.title = dto.title.trim();
    if (dto.titleBn !== undefined) $set.titleBn = dto.titleBn.trim();
    if (dto.marks !== undefined) $set.marks = dto.marks;
    if (dto.credits !== undefined) $set.credits = dto.credits;
    if (dto.classHours !== undefined) $set.classHours = dto.classHours;
    if (dto.examDuration !== undefined) $set.examDuration = dto.examDuration.trim();
    if (dto.orientation !== undefined) $set.orientation = dto.orientation.trim();
    if (dto.description !== undefined) $set.description = dto.description.trim();
    if (dto.introduction !== undefined) $set.introduction = dto.introduction.trim();
    if (dto.objectives !== undefined) $set.objectives = cleanStringList(dto.objectives);
    if (dto.outcomes !== undefined) $set.outcomes = dto.outcomes;
    if (dto.prescribedTexts !== undefined) {
      $set.prescribedTexts = cleanStringList(dto.prescribedTexts);
    }
    if (dto.outline !== undefined) $set.outline = dto.outline;
    if (dto.labDetails !== undefined) $set.labDetails = dto.labDetails.trim();
    if (dto.books !== undefined) $set.books = cleanStringList(dto.books);
    if (dto.status !== undefined) $set.status = dto.status;
    return $set;
  }

  private offeringOf(row: {
    slug: string;
    departmentId: string;
    yearId: string;
    code: string;
    title: string;
    titleBn?: string;
    marks?: number;
    credits?: number;
    classHours?: number | null;
    status?: AcademicDraftStatus;
  }) {
    return {
      slug: row.slug,
      departmentId: row.departmentId,
      yearId: row.yearId,
      code: row.code,
      title: row.title,
      titleBn: row.titleBn ?? '',
      marks: row.marks ?? 100,
      credits: row.credits ?? 0,
      classHours: row.classHours ?? null,
      status: row.status ?? AcademicDraftStatus.Draft,
    };
  }

  private offeringPatch(dto: UpdateSubjectDto, nextSlug: string) {
    const patch = this.patchFromDto(dto, nextSlug);
    for (const key of Object.keys(this.syllabusUnset())) {
      delete patch[key];
    }
    return patch;
  }

  private coursePatchFromDto(dto: UpdateSubjectDto) {
    return {
      ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
      ...(dto.titleBn !== undefined ? { titleBn: dto.titleBn.trim() } : {}),
      ...(dto.marks !== undefined ? { marks: dto.marks } : {}),
      ...(dto.credits !== undefined ? { credits: dto.credits } : {}),
      ...(dto.classHours !== undefined ? { classHours: dto.classHours } : {}),
      ...(dto.examDuration !== undefined ? { examDuration: dto.examDuration.trim() } : {}),
      ...(dto.orientation !== undefined ? { orientation: dto.orientation.trim() } : {}),
      ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
      ...(dto.introduction !== undefined ? { introduction: dto.introduction.trim() } : {}),
      ...(dto.objectives !== undefined ? { objectives: cleanStringList(dto.objectives) } : {}),
      ...(dto.outcomes !== undefined ? { outcomes: dto.outcomes } : {}),
      ...(dto.prescribedTexts !== undefined
        ? { prescribedTexts: cleanStringList(dto.prescribedTexts) }
        : {}),
      ...(dto.outline !== undefined ? { outline: dto.outline } : {}),
      ...(dto.labDetails !== undefined ? { labDetails: dto.labDetails.trim() } : {}),
      ...(dto.books !== undefined ? { books: cleanStringList(dto.books) } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
    };
  }

  private syllabusUnset() {
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
    } as const;
  }

  private async withCourseContent<T extends { code?: string }>(doc: T) {
    const code = doc.code?.trim();
    if (!code) return doc;
    const course = await this.courses.findByCode(code);
    if (!course) return doc;
    return {
      ...doc,
      title: course.title,
      titleBn: course.titleBn,
      marks: course.marks,
      credits: course.credits,
      classHours: course.classHours,
      examDuration: course.examDuration,
      orientation: course.orientation,
      description: course.description,
      introduction: course.introduction,
      objectives: course.objectives,
      outcomes: course.outcomes,
      prescribedTexts: course.prescribedTexts,
      outline: course.outline,
      labDetails: course.labDetails,
      books: course.books,
      status: course.status,
    };
  }

  private rowSlug(row: unknown): string | undefined {
    if (!row || typeof row !== 'object') return undefined;
    const id = (row as { id?: unknown; slug?: unknown }).id ?? (row as { slug?: unknown }).slug;
    return id == null ? undefined : String(id);
  }

  private num(value: unknown, fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private isDuplicate(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      (err as { code?: number }).code === 11000
    );
  }
}
