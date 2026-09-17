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
  optionalText,
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
  ) {}

  list(filters: { departmentId?: string; yearId?: string; status?: string }) {
    const query: Record<string, string> = {};
    if (filters.departmentId) query.departmentId = assertSlug(filters.departmentId);
    if (filters.yearId) query.yearId = assertSlug(filters.yearId);
    if (filters.status) query.status = filters.status;
    return this.subjects
      .find(query, SUMMARY)
      .sort({ departmentId: 1, yearId: 1, code: 1 })
      .lean()
      .exec();
  }

  async findOne(slug: string) {
    const doc = await this.subjects.findOne({ slug: assertSlug(slug) }).lean().exec();
    if (!doc) throw new NotFoundException('Subject not found');
    return doc;
  }

  async create(dto: CreateSubjectDto) {
    await this.structure.requireDepartment(dto.departmentId);
    await this.structure.requireYear(dto.yearId);
    try {
      const doc = await this.subjects.create(this.fromDto(dto));
      return doc.toJSON();
    } catch (err) {
      if (this.isDuplicate(err)) {
        throw new ConflictException('Subject slug already exists');
      }
      throw err;
    }
  }

  async update(slug: string, dto: UpdateSubjectDto) {
    const current = assertSlug(slug);
    if (dto.departmentId) await this.structure.requireDepartment(dto.departmentId);
    if (dto.yearId) await this.structure.requireYear(dto.yearId);
    const next = dto.slug ? assertSlug(dto.slug) : current;
    const doc = await this.subjects
      .findOneAndUpdate(
        { slug: current },
        { $set: this.patchFromDto(dto, next) },
        { new: true },
      )
      .lean()
      .exec();
    if (!doc) throw new NotFoundException('Subject not found');
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
    return doc;
  }

  async remove(slug: string) {
    const id = assertSlug(slug);
    const used = await this.questions.countDocuments({ subjectSlug: id }).exec();
    if (used > 0) {
      throw new ConflictException(
        `Cannot delete: ${used} question(s) still belong to this subject`,
      );
    }
    const res = await this.subjects.deleteOne({ slug: id }).exec();
    if (!res.deletedCount) throw new NotFoundException('Subject not found');
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

        const res = await this.subjects.updateOne(
          { slug: payload.slug },
          {
            $set: payload,
            $setOnInsert: {
              status: opts.insertStatus ?? AcademicDraftStatus.Draft,
            },
          },
          { upsert: true },
        );
        if (res.upsertedCount) result.created += 1;
        else result.updated += 1;
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
      'Syllabus file must be a JSON array of subjects, or { "subjects": [...] }',
    );
  }

  private fromImportRow(row: unknown) {
    if (!row || typeof row !== 'object') {
      throw new BadRequestException('Subject row is not an object');
    }
    const item = row as Record<string, unknown>;
    const slug = assertSlug(String(item.id ?? item.slug ?? ''), 'Subject id');
    const departmentId = assertSlug(
      String(item.departmentId ?? item.department_id ?? ''),
      'departmentId',
    );
    const yearId = assertSlug(String(item.yearId ?? item.year_id ?? ''), 'yearId');
    const title = optionalText(item.title, 300);
    const code = optionalText(item.code, 40);
    if (!title || !code) {
      throw new BadRequestException('Subject needs a title and code');
    }
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
