/** Stable public ids used by the mobile catalog. Separate from Mongo `_id`. */
export const ACADEMIC_SLUG = /^[a-z0-9][a-z0-9_-]{0,80}$/;

export enum AcademicDraftStatus {
  Draft = 'draft',
  Ready = 'ready',
}

export enum QuestionType {
  Mcq = 'mcq',
  Short = 'short',
  Broad = 'broad',
}
