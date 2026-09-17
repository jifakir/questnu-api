import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { promises as fs } from 'fs';
import { Model } from 'mongoose';
import * as path from 'path';
import { AcademicDraftStatus } from '../academic.constants';
import { canonicalDepartmentId } from '../academic.util';
import { Subject, SubjectDocument } from '../schemas/subject.schema';
import { STARTER_DEPARTMENTS } from './starter-catalog';
import { StructureService } from '../structure.service';
import { SubjectsService } from '../subjects.service';

@Injectable()
export class CatalogSeedService implements OnModuleInit {
  private readonly logger = new Logger(CatalogSeedService.name);

  constructor(
    private readonly structure: StructureService,
    private readonly subjects: SubjectsService,
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
    let skipped = 0;

    for (const file of files) {
      const rows = Array.isArray(file.raw) ? file.raw : [];
        const departmentId = this.firstString(rows, 'departmentId');
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
