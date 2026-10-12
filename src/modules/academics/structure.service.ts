import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { promises as fs } from 'fs';
import { Model } from 'mongoose';
import * as path from 'path';
import { AcademicDraftStatus } from './academic.constants';
import {
  assertSlug,
  isCompulsoryCourseFolder,
  isSharedCoursePlaceholder,
  SHARED_COURSE_PLACEHOLDER_IDS,
} from './academic.util';
import type {
  CreateCollegeDto,
  CreateDepartmentDto,
  CreateYearDto,
  UpdateCollegeDto,
  UpdateDepartmentDto,
  UpdateYearDto,
} from './dto/academic.dto';
import {
  STARTER_DEPARTMENTS,
  STARTER_YEARS,
} from './seed/starter-catalog';
import { AcademicYear, AcademicYearDocument } from './schemas/academic-year.schema';
import { College, CollegeDocument } from './schemas/college.schema';
import { Department, DepartmentDocument } from './schemas/department.schema';
import { Question, QuestionDocument } from './schemas/question.schema';
import { Subject, SubjectDocument } from './schemas/subject.schema';

function isDuplicateKey(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: number }).code === 11000
  );
}

@Injectable()
export class StructureService {
  constructor(
    @InjectModel(College.name)
    private readonly colleges: Model<CollegeDocument>,
    @InjectModel(Department.name)
    private readonly departments: Model<DepartmentDocument>,
    @InjectModel(AcademicYear.name)
    private readonly years: Model<AcademicYearDocument>,
    @InjectModel(Subject.name)
    private readonly subjects: Model<SubjectDocument>,
    @InjectModel(Question.name)
    private readonly questions: Model<QuestionDocument>,
  ) {}

  listColleges() {
    return this.colleges.find().sort({ sortOrder: 1, name: 1 }).lean().exec();
  }

  async listDepartments() {
    const [rows, counts] = await Promise.all([
      this.departments.find().sort({ sortOrder: 1, name: 1 }).lean().exec(),
      this.subjects.aggregate<{ _id: string; count: number }>([
        { $group: { _id: '$departmentId', count: { $sum: 1 } } },
      ]),
    ]);
    const totals = new Map(counts.map((row) => [row._id, row.count]));
    return rows
      .filter(
        (row) =>
          !isSharedCoursePlaceholder(row.slug) &&
          !isCompulsoryCourseFolder(row.name),
      )
      .map((row) => ({
        ...row,
        subjectCount: totals.get(row.slug) ?? 0,
      }));
  }

  listYears() {
    return this.years.find().sort({ sortOrder: 1, slug: 1 }).lean().exec();
  }

  async overview() {
    const [colleges, departments, years, subjects, questions, draftSubjects] =
      await Promise.all([
        this.colleges.countDocuments().exec(),
        this.departments.countDocuments().exec(),
        this.years.countDocuments().exec(),
        this.subjects.countDocuments().exec(),
        this.questions.countDocuments().exec(),
        this.subjects.countDocuments({ status: AcademicDraftStatus.Draft }).exec(),
      ]);
    const byYear = await this.subjects.aggregate<{ _id: string; count: number }>([
      { $group: { _id: '$yearId', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    const byDepartment = await this.subjects.aggregate<{
      _id: string;
      subjects: number;
      ready: number;
    }>([
      {
        $group: {
          _id: '$departmentId',
          subjects: { $sum: 1 },
          ready: {
            $sum: {
              $cond: [{ $eq: ['$status', AcademicDraftStatus.Ready] }, 1, 0],
            },
          },
        },
      },
    ]);
    const departmentsDocs = await this.listDepartments();
    const yearsDocs = await this.listYears();
    const subjectCounts = new Map(byDepartment.map((row) => [row._id, row]));
    return {
      colleges,
      departments,
      years,
      subjects,
      questions,
      draftSubjects,
      readySubjects: subjects - draftSubjects,
      subjectsByYear: byYear.map((row) => ({
        yearId: row._id,
        count: row.count,
      })),
      departmentCoverage: departmentsDocs.map((dept) => ({
        slug: dept.slug,
        name: dept.name,
        nameBn: dept.nameBn ?? '',
        subjects: subjectCounts.get(dept.slug)?.subjects ?? 0,
        ready: subjectCounts.get(dept.slug)?.ready ?? 0,
      })),
      yearCoverage: yearsDocs.map((year) => ({
        slug: year.slug,
        label: year.label,
        labelBn: year.labelBn ?? '',
        subjects: byYear.find((row) => row._id === year.slug)?.count ?? 0,
      })),
      publishing:
        'This is the draft catalog. Students still use the copy bundled in the app until a signed release is published.',
    };
  }

  async ensureStarter() {
    const departments = await this.insertMissing(
      this.departments,
      STARTER_DEPARTMENTS.map((item) => ({
        slug: item.slug,
        name: item.name,
        nameBn: item.nameBn ?? '',
        sortOrder: item.sortOrder,
      })),
    );
    const years = await this.insertMissing(
      this.years,
      STARTER_YEARS.map((item) => ({
        slug: item.slug,
        label: item.label,
        labelBn: item.labelBn,
        sortOrder: item.sortOrder,
      })),
    );
    const colleges = await this.seedOfficialColleges();
    return { departments, years, colleges };
  }

  /** Insert official colleges that are not already stored. Does not overwrite edits. */
  async seedCollegeList(
    rows: Array<{
      slug: string;
      name: string;
      email: string;
      address: string;
      upazilla: string;
      district: string;
      division: string;
    }>,
  ) {
    const existing = new Set(
      (await this.colleges.distinct('slug').exec()).map((slug) => String(slug)),
    );
    const missing = rows
      .filter((row) => row.slug && !existing.has(row.slug))
      .map((row) => ({ ...row, nameBn: '', sortOrder: 0 }));
    if (missing.length) {
      await this.colleges.insertMany(missing, { ordered: false });
    }
    return {
      created: missing.length,
      updated: 0,
      unchanged: rows.length - missing.length,
      total: rows.length,
    };
  }

  async seedOfficialColleges() {
    const file = await this.findCollegeList();
    if (!file) {
      return { created: 0, updated: 0, unchanged: 0, total: 0 };
    }
    const raw = JSON.parse(await fs.readFile(file, 'utf8')) as unknown;
    if (!Array.isArray(raw)) {
      return { created: 0, updated: 0, unchanged: 0, total: 0 };
    }
    const rows = raw.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const row = item as Record<string, unknown>;
      const slug = String(row.college_code ?? '').trim().toLowerCase();
      const name = String(row.college_name ?? '').trim();
      if (!slug || !name) return [];
      return [{
        slug,
        name,
        email: String(row.email ?? '').trim(),
        address: String(row.address ?? '').trim(),
        upazilla: String(row.upazilla ?? '').trim(),
        district: String(row.districts_name ?? '').trim(),
        division: String(row.div_name ?? '').trim(),
      }];
    });
    return this.seedCollegeList(rows);
  }

  private async findCollegeList(): Promise<string | null> {
    const candidates = [
      path.resolve(process.cwd(), 'data/college-list.json'),
      path.resolve(__dirname, '../../../../data/college-list.json'),
      path.resolve(__dirname, '../../../../../data/college-list.json'),
      path.resolve(process.cwd(), 'college-list.json'),
      path.resolve(process.cwd(), '../college-list.json'),
    ];
    for (const file of candidates) {
      try {
        await fs.access(file);
        return file;
      } catch {
        /* try next */
      }
    }
    return null;
  }

  async bootstrap() {
    const departments = await this.upsertMany(
      this.departments,
      STARTER_DEPARTMENTS.map((item) => ({
        slug: item.slug,
        name: item.name,
        nameBn: item.nameBn ?? '',
        sortOrder: item.sortOrder,
      })),
    );
    const years = await this.upsertMany(
      this.years,
      STARTER_YEARS.map((item) => ({
        slug: item.slug,
        label: item.label,
        labelBn: item.labelBn,
        sortOrder: item.sortOrder,
      })),
    );
    const colleges = await this.seedOfficialColleges();
    return { departments, years, colleges };
  }

  async createDepartment(dto: CreateDepartmentDto) {
    return this.createUnique(this.departments, 'Department', {
      slug: assertSlug(dto.slug),
      name: dto.name.trim(),
      nameBn: dto.nameBn?.trim() ?? '',
      sortOrder: dto.sortOrder ?? 0,
    });
  }

  async updateDepartment(slug: string, dto: UpdateDepartmentDto) {
    const current = assertSlug(slug, 'Department');
    const next = dto.slug ? assertSlug(dto.slug) : current;
    const doc = await this.departments
      .findOneAndUpdate(
        { slug: current },
        {
          $set: {
            ...(dto.slug ? { slug: next } : {}),
            ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
            ...(dto.nameBn !== undefined ? { nameBn: dto.nameBn.trim() } : {}),
            ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
          },
        },
        { new: true },
      )
      .lean()
      .exec();
    if (!doc) throw new NotFoundException('Department not found');
    if (next !== current) {
      await this.subjects.updateMany(
        { departmentId: current },
        { $set: { departmentId: next } },
      );
      await this.questions.updateMany(
        { departmentId: current },
        { $set: { departmentId: next } },
      );
    }
    return doc;
  }

  async removeDepartment(slug: string) {
    const id = assertSlug(slug, 'Department');
    const used = await this.subjects.countDocuments({ departmentId: id }).exec();
    if (used > 0) {
      throw new ConflictException(
        `Cannot delete: ${used} course(s) still use this department`,
      );
    }
    const res = await this.departments.deleteOne({ slug: id }).exec();
    if (!res.deletedCount) throw new NotFoundException('Department not found');
    return { deleted: true };
  }

  async createYear(dto: CreateYearDto) {
    return this.createUnique(this.years, 'Year', {
      slug: assertSlug(dto.slug),
      label: dto.label.trim(),
      labelBn: dto.labelBn?.trim() ?? '',
      sortOrder: dto.sortOrder ?? 0,
    });
  }

  async updateYear(slug: string, dto: UpdateYearDto) {
    const current = assertSlug(slug, 'Year');
    const next = dto.slug ? assertSlug(dto.slug) : current;
    const doc = await this.years
      .findOneAndUpdate(
        { slug: current },
        {
          $set: {
            ...(dto.slug ? { slug: next } : {}),
            ...(dto.label !== undefined ? { label: dto.label.trim() } : {}),
            ...(dto.labelBn !== undefined ? { labelBn: dto.labelBn.trim() } : {}),
            ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
          },
        },
        { new: true },
      )
      .lean()
      .exec();
    if (!doc) throw new NotFoundException('Year not found');
    if (next !== current) {
      await this.subjects.updateMany({ yearId: current }, { $set: { yearId: next } });
      await this.questions.updateMany({ yearId: current }, { $set: { yearId: next } });
    }
    return doc;
  }

  async removeYear(slug: string) {
    const id = assertSlug(slug, 'Year');
    const used = await this.subjects.countDocuments({ yearId: id }).exec();
    if (used > 0) {
      throw new ConflictException(
        `Cannot delete: ${used} course(s) still use this year`,
      );
    }
    const res = await this.years.deleteOne({ slug: id }).exec();
    if (!res.deletedCount) throw new NotFoundException('Year not found');
    return { deleted: true };
  }

  async createCollege(dto: CreateCollegeDto) {
    return this.createUnique(this.colleges, 'College', {
      slug: assertSlug(dto.slug),
      name: dto.name.trim(),
      nameBn: dto.nameBn?.trim() ?? '',
      district: dto.district?.trim() ?? '',
      sortOrder: dto.sortOrder ?? 0,
    });
  }

  async updateCollege(slug: string, dto: UpdateCollegeDto) {
    const current = assertSlug(slug, 'College');
    const doc = await this.colleges
      .findOneAndUpdate(
        { slug: current },
        {
          $set: {
            ...(dto.slug ? { slug: assertSlug(dto.slug) } : {}),
            ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
            ...(dto.nameBn !== undefined ? { nameBn: dto.nameBn.trim() } : {}),
            ...(dto.district !== undefined ? { district: dto.district.trim() } : {}),
            ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
          },
        },
        { new: true },
      )
      .lean()
      .exec();
    if (!doc) throw new NotFoundException('College not found');
    return doc;
  }

  async removeCollege(slug: string) {
    const id = assertSlug(slug, 'College');
    const res = await this.colleges.deleteOne({ slug: id }).exec();
    if (!res.deletedCount) throw new NotFoundException('College not found');
    return { deleted: true };
  }

  async removeSharedCourseDepartments() {
    await this.departments
      .deleteMany({
        $or: [
          { slug: { $in: [...SHARED_COURSE_PLACEHOLDER_IDS] } },
          { name: { $regex: /^compulsory course/i } },
        ],
      })
      .exec();
  }

  async ensureDepartment(slug: string, name?: string) {
    const id = assertSlug(slug, 'Department');
    if (isSharedCoursePlaceholder(id) || isCompulsoryCourseFolder(name ?? '')) {
      return;
    }
    await this.departments.updateOne(
      { slug: id },
      {
        $setOnInsert: {
          slug: id,
          name:
            name?.trim() ||
            id
              .replace(/[_-]+/g, ' ')
              .replace(/\b\w/g, (letter) => letter.toUpperCase()),
          nameBn: '',
          sortOrder: 1000,
        },
      },
      { upsert: true },
    );
  }

  async ensureYear(slug: string) {
    const id = assertSlug(slug, 'Year');
    const known = STARTER_YEARS.find((year) => year.slug === id);
    await this.years.updateOne(
      { slug: id },
      {
        $setOnInsert: {
          slug: id,
          label: known?.label ?? `Year ${id}`,
          labelBn: known?.labelBn ?? '',
          sortOrder: known?.sortOrder ?? 100,
        },
      },
      { upsert: true },
    );
  }

  async requireDepartment(slug: string) {
    const doc = await this.departments.findOne({ slug: assertSlug(slug) }).lean().exec();
    if (!doc) throw new NotFoundException(`Department "${slug}" not found`);
    return doc;
  }

  async requireYear(slug: string) {
    const doc = await this.years.findOne({ slug: assertSlug(slug) }).lean().exec();
    if (!doc) throw new NotFoundException(`Year "${slug}" not found`);
    return doc;
  }

  private async createUnique(
    model: Model<DepartmentDocument | AcademicYearDocument | CollegeDocument>,
    label: string,
    payload: Record<string, unknown>,
  ) {
    try {
      const doc = await model.create(
        payload as Partial<Department & AcademicYear & College>,
      );
      return doc.toJSON();
    } catch (err) {
      if (isDuplicateKey(err)) {
        throw new ConflictException(`${label} slug already exists`);
      }
      throw err;
    }
  }

  private async insertMissing<T>(
    model: Model<T>,
    rows: Record<string, unknown>[],
  ) {
    let created = 0;
    for (const row of rows) {
      const res = await model.updateOne(
        { slug: row.slug },
        { $setOnInsert: row },
        { upsert: true },
      );
      if (res.upsertedCount) created += 1;
    }
    return { created, unchanged: rows.length - created, total: rows.length };
  }

  private async upsertMany<T>(
    model: Model<T>,
    rows: Record<string, unknown>[],
  ) {
    let created = 0;
    let updated = 0;
    for (const row of rows) {
      const res = await model.updateOne(
        { slug: row.slug },
        { $set: row },
        { upsert: true },
      );
      if (res.upsertedCount) created += 1;
      else if (res.modifiedCount) updated += 1;
    }
    return { created, updated, total: rows.length };
  }
}
