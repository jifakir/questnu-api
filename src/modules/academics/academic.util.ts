import { BadRequestException } from '@nestjs/common';
import { ACADEMIC_SLUG } from './academic.constants';
import { STARTER_DEPARTMENTS } from './seed/starter-catalog';

export function assertSlug(value: string, label = 'Slug'): string {
  const slug = value.trim().toLowerCase();
  if (!ACADEMIC_SLUG.test(slug)) {
    throw new BadRequestException(
      `${label} must be 1–81 characters: lowercase letters, digits, hyphens, or underscores`,
    );
  }
  return slug;
}

export function slugFromName(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 81);
  return assertSlug(slug || 'item', 'Generated slug');
}

export function cleanStringList(value: unknown, max = 200): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean),
    ),
  ].slice(0, max);
}

export function optionalText(value: unknown, max = 20000): string {
  if (value == null) return '';
  return String(value).trim().slice(0, max);
}

export const DEPARTMENT_ALIASES: Record<string, string> = {
  'islamic-history-and-culture': 'islamic_history_culture',
  islamic_history_and_culture: 'islamic_history_culture',
  'library-and-information-science': 'library_science',
  library_and_information_science: 'library_science',
};

/** JSON files use hyphens (`finance-and-banking`); the app uses underscores. */
export function canonicalDepartmentId(raw: string): string {
  const slug = raw.trim().toLowerCase();
  const alias = DEPARTMENT_ALIASES[slug];
  if (alias) return alias;
  const underscored = slug.replace(/-/g, '_');
  const underscoredAlias = DEPARTMENT_ALIASES[underscored];
  if (underscoredAlias) return underscoredAlias;
  const match = STARTER_DEPARTMENTS.find(
    (dept) => dept.slug === slug || dept.slug === underscored,
  );
  return match?.slug ?? slug;
}

/**
 * The mobile app treats a null JSON description as introduction taken from
 * the first objective, and keeps the remaining lines as objectives.
 */
export function splitIntroduction(description: string, objectives: string[]) {
  const intro = description.trim();
  if (intro) return { introduction: intro, objectives };
  if (!objectives.length) return { introduction: '', objectives };
  return { introduction: objectives[0], objectives: objectives.slice(1) };
}

/** JSON lab blocks are objects. The app shows their instructions as Introduction. */
export function formatLabDetails(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') {
    const text = value.trim();
    return text === '[object Object]' ? '' : text;
  }
  if (typeof value !== 'object') return '';
  const lab = value as {
    instructions?: unknown;
    exam?: { format?: unknown };
  };
  const lines = cleanStringList(lab.instructions);
  const format =
    typeof lab.exam?.format === 'string' ? lab.exam.format.trim() : '';
  return [...lines, format].filter(Boolean).join('\n\n');
}
