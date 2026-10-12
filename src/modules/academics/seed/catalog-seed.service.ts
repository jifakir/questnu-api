import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { promises as fs } from 'fs';
import { Model } from 'mongoose';
import * as path from 'path';
import { AcademicDraftStatus } from '../academic.constants';
import { hasSyllabusDetails, syllabusTags } from '../academic.util';
import {
  canonicalDepartmentId,
  isCompulsoryCourseFolder,
  isSharedCoursePlaceholder,
} from '../academic.util';
import { Subject, SubjectDocument } from '../schemas/subject.schema';
import { STARTER_DEPARTMENTS } from './starter-catalog';
import { StructureService } from '../structure.service';
import { CoursesService } from '../courses.service';
import { SubjectsService } from '../subjects.service';

@Injectable()
export class CatalogSeedService implements OnModuleInit {
  private readonly logger = new Logger(CatalogSeedService.name);

  constructor(
    private readonly structure: StructureService,
    private readonly subjects: SubjectsService,
    private readonly courses: CoursesService,
    @InjectModel(Subject.name)
    private readonly subjectModel: Model<SubjectDocument>,
  ) {}

  async onModuleInit() {
    try {
      const result = await this.syncAppCatalog();
      this.logger.log(
        `App catalog sync: +${result.subjects.created} subjects, ${result.subjects.skipped} already present, ${result.subjects.aligned?.introductions ?? 0} introductions, ${result.subjects.labFilled ?? 0} lab intros, +${result.structure.colleges?.created ?? 0} colleges`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`App catalog sync failed: ${message}`);
    }
    try {
      await this.subjects.purgeSharedCoursePlaceholders();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Could not remove compulsory-course departments: ${message}`);
    }
    try {
      const seeded = await this.seedCalculatorCourseLists();
      this.logger.log(
        `Calculator course lists: +${seeded.created} courses, ${seeded.skipped} already present`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Calculator course list seed failed: ${message}`);
    }
    try {
      const linked = await this.courses.syncFromSubjects();
      const stripped = await this.courses.stripSubjectSyllabusCopies();
      this.logger.log(
        `Courses: ${linked.courses} unique codes from ${linked.subjects} papers, ${linked.links} department links, ${stripped.stripped} syllabus copies removed from offerings`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Course link sync failed: ${message}`);
    }
  }

  /** Insert starter structure and syllabus JSON that the mobile app already ships. Never overwrites edits. */
  async syncAppCatalog() {
    const structure = await this.structure.ensureStarter();
    const aligned = await this.subjects.alignWithApp();
    const syllabusRoot = await this.findSyllabusRoot();
    if (!syllabusRoot) {
      this.logger.warn(
        'syllabus/ folder not found. Structure was seeded; subject JSON was skipped.',
      );
      return {
        structure,
        subjects: { created: 0, updated: 0, skipped: 0, failed: 0, files: 0 },
        syllabusRoot: null as string | null,
      };
    }

    const existing = new Set(
      await this.subjectModel.distinct('slug').exec(),
    );
    const files = await this.collectJsonFiles(syllabusRoot);
    const labFilled = await this.subjects.fillLabIntroductions(
      files.flatMap((file) => (Array.isArray(file.raw) ? file.raw : [])),
    );
    const missing: unknown[] = [];
    const sharedRows: unknown[] = [];
    let skipped = 0;

    for (const file of files) {
      const rows = Array.isArray(file.raw) ? file.raw : [];
      const departmentId = this.firstString(rows, 'departmentId');
      const sharedFolder =
        isCompulsoryCourseFolder(file.folderName) ||
        (departmentId != null &&
          isSharedCoursePlaceholder(canonicalDepartmentId(departmentId)));
      if (sharedFolder) {
        sharedRows.push(...rows);
        continue;
      }
      if (departmentId) {
        const canonical = canonicalDepartmentId(departmentId);
        const known = STARTER_DEPARTMENTS.find((dept) => dept.slug === canonical);
        await this.structure.ensureDepartment(
          canonical,
          known?.name ?? file.folderName,
        );
      }
      for (const row of rows) {
        const slug = this.rowSlug(row);
        if (!slug) {
          missing.push(row);
          continue;
        }
        if (existing.has(slug)) {
          skipped += 1;
          continue;
        }
        missing.push(row);
      }
    }

    for (const row of sharedRows) {
      try {
        await this.subjects.importAsSharedCourse(row, AcademicDraftStatus.Ready);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Shared course skipped: ${message}`);
      }
    }

    const imported = missing.length
      ? await this.subjects.importJson(missing, {
          createMissingStructure: true,
          insertStatus: AcademicDraftStatus.Ready,
        })
      : { created: 0, updated: 0, failed: 0, departmentsCreated: [], yearsCreated: [], errors: [] };

    return {
      structure,
      syllabusRoot,
      subjects: {
        created: imported.created,
        updated: imported.updated,
        skipped,
        failed: imported.failed,
        files: files.length,
        errors: imported.errors,
        labFilled,
        aligned,
      },
    };
  }

  private async seedCalculatorCourseLists() {
    await this.structure.ensureStarter();
    let created = 0;
    let skipped = 0;
    for (const yearId of ['3', '4']) {
      const rows = await this.readCourseList(yearId);
      for (const row of rows) {
        const slug = `${row.departmentId}-${row.code}`;
        const exists = await this.subjectModel.exists({ slug }).exec();
        if (exists) {
          skipped += 1;
          continue;
        }
        const offering = {
          slug,
          departmentId: row.departmentId,
          yearId: row.yearId,
          code: row.code,
          title: row.title,
          titleBn: '',
          marks: row.marks,
          credits: row.credits,
          classHours: row.classHours,
          status: AcademicDraftStatus.Ready,
          tags: syllabusTags(false),
        };
        await this.subjectModel.create(offering);
        await this.courses.upsertFromSubject(offering);
        created += 1;
      }
    }
    await this.markCoursesWithoutSyllabus();
    return { created, skipped };
  }

  /** Old means the course has no syllabus details, whatever year it belongs to. */
  private async markCoursesWithoutSyllabus() {
    const rows = await this.subjectModel
      .find()
      .select({
        _id: 1,
        code: 1,
        tags: 1,
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
      .exec();
    for (const row of rows) {
      const tags = syllabusTags(hasSyllabusDetails(row), row.tags ?? []);
      const current = [...(row.tags ?? [])].sort().join(',');
      const next = [...tags].sort().join(',');
      if (current !== next) {
        await this.subjectModel.updateOne({ _id: row._id }, { $set: { tags } }).exec();
      }
    }
  }

  private async readCourseList(yearId: string) {
    const name = `year${yearId}.json`;
    const candidates = [
      path.resolve(__dirname, 'course-lists', name),
      path.resolve(process.cwd(), 'src/modules/academics/seed/course-lists', name),
      path.resolve(process.cwd(), 'dist/src/modules/academics/seed/course-lists', name),
    ];
    for (const candidate of candidates) {
      try {
        const text = await fs.readFile(candidate, 'utf8');
        const parsed = JSON.parse(text) as Array<{
          departmentId: string;
          yearId: string;
          code: string;
          title: string;
          marks: number;
          credits: number;
          classHours: number;
        }>;
        if (!Array.isArray(parsed)) continue;
        return parsed;
      } catch {
        /* try next */
      }
    }
    this.logger.warn(`Course list not found: ${name}`);
    return [];
  }

  private async findSyllabusRoot(): Promise<string | null> {
    const candidates = [
      path.resolve(process.cwd(), '../syllabus'),
      path.resolve(process.cwd(), 'syllabus'),
      path.resolve(__dirname, '../../../../../syllabus'),
      path.resolve(__dirname, '../../../../syllabus'),
    ];
    for (const dir of candidates) {
      try {
        await fs.access(path.join(dir, '1st-year'));
        return dir;
      } catch {
        /* try next */
      }
    }
    return null;
  }

  private async collectJsonFiles(root: string) {
    const out: { folderName: string; raw: unknown }[] = [];
    const years = await fs.readdir(root, { withFileTypes: true });
    for (const year of years) {
      if (!year.isDirectory()) continue;
      const subjects = await fs.readdir(path.join(root, year.name), {
        withFileTypes: true,
      });
      for (const subject of subjects) {
        if (!subject.isDirectory()) continue;
        const dir = path.join(root, year.name, subject.name);
        const names = await fs.readdir(dir);
        const jsonName = names.find((name) => name.endsWith('.json'));
        if (!jsonName) continue;
        const text = await fs.readFile(path.join(dir, jsonName), 'utf8');
        out.push({
          folderName: subject.name,
          raw: JSON.parse(text) as unknown,
        });
      }
    }
    return out;
  }

  private firstString(rows: unknown[], key: string): string | null {
    const first = rows.find((row) => row && typeof row === 'object');
    if (!first || typeof first !== 'object') return null;
    const value = (first as Record<string, unknown>)[key];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private rowSlug(row: unknown): string | null {
    if (!row || typeof row !== 'object') return null;
    const value = (row as { id?: unknown; slug?: unknown }).id ?? (row as { slug?: unknown }).slug;
    return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : null;
  }
}
