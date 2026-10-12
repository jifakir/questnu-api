import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ACADEMIC_SLUG, AcademicDraftStatus, QuestionType } from '../academic.constants';

const SLUG = { message: 'Use a lowercase slug (letters, digits, - or _)' };

export class CreateDepartmentDto {
  @IsString()
  @Matches(ACADEMIC_SLUG, SLUG)
  slug: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  nameBn?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(10000)
  sortOrder?: number;
}

export class UpdateDepartmentDto {
  @IsOptional()
  @IsString()
  @Matches(ACADEMIC_SLUG, SLUG)
  slug?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  nameBn?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(10000)
  sortOrder?: number;
}

export class CreateYearDto {
  @IsString()
  @Matches(ACADEMIC_SLUG, SLUG)
  slug: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  label: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  labelBn?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  sortOrder?: number;
}

export class UpdateYearDto {
  @IsOptional()
  @IsString()
  @Matches(ACADEMIC_SLUG, SLUG)
  slug?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  labelBn?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  sortOrder?: number;
}

export class CreateCollegeDto {
  @IsString()
  @Matches(ACADEMIC_SLUG, SLUG)
  slug: string;

  @IsString()
  @MinLength(1)
  @MaxLength(240)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  nameBn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  district?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(20000)
  sortOrder?: number;
}

export class UpdateCollegeDto {
  @IsOptional()
  @IsString()
  @Matches(ACADEMIC_SLUG, SLUG)
  slug?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(240)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  nameBn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  district?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(20000)
  sortOrder?: number;
}

export class SubjectOutcomeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  id: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  text: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  mappedPlos?: string[];
}

export class SubjectOutlineDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  unit: string;

  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  topic: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(500)
  hours?: number | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  teachingStrategies?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  clos?: string[];
}

export class LinkAcademicCourseDto {
  @IsString()
  @Matches(ACADEMIC_SLUG, SLUG)
  yearId: string;

  @IsArray()
  @IsString({ each: true })
  departmentIds: string[];

  @IsOptional()
  @IsEnum(AcademicDraftStatus)
  status?: AcademicDraftStatus;
}

export class CreateSubjectDto {
  @IsString()
  @Matches(ACADEMIC_SLUG, SLUG)
  slug: string;

  @IsString()
  @Matches(ACADEMIC_SLUG, SLUG)
  departmentId: string;

  @IsString()
  @Matches(ACADEMIC_SLUG, SLUG)
  yearId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  code: string;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  titleBn?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000)
  marks?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(40)
  credits?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(2000)
  classHours?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  examDuration?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  orientation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16000)
  introduction?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  objectives?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubjectOutcomeDto)
  outcomes?: SubjectOutcomeDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  prescribedTexts?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubjectOutlineDto)
  outline?: SubjectOutlineDto[];

  @IsOptional()
  @IsString()
  @MaxLength(16000)
  labDetails?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  books?: string[];

  @IsOptional()
  @IsEnum(AcademicDraftStatus)
  status?: AcademicDraftStatus;
}

export class UpdateSubjectDto {
  @IsOptional()
  @IsString()
  @Matches(ACADEMIC_SLUG, SLUG)
  slug?: string;

  @IsOptional()
  @IsString()
  @Matches(ACADEMIC_SLUG, SLUG)
  departmentId?: string;

  @IsOptional()
  @IsString()
  @Matches(ACADEMIC_SLUG, SLUG)
  yearId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  titleBn?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000)
  marks?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(40)
  credits?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(2000)
  classHours?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  examDuration?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  orientation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16000)
  introduction?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  objectives?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubjectOutcomeDto)
  outcomes?: SubjectOutcomeDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  prescribedTexts?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubjectOutlineDto)
  outline?: SubjectOutlineDto[];

  @IsOptional()
  @IsString()
  @MaxLength(16000)
  labDetails?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  books?: string[];

  @IsOptional()
  @IsEnum(AcademicDraftStatus)
  status?: AcademicDraftStatus;
}

/** Shared course document update (by code). */
export class UpdateAcademicCourseDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  titleBn?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000)
  marks?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(40)
  credits?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(2000)
  classHours?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  examDuration?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  orientation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16000)
  introduction?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  objectives?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubjectOutcomeDto)
  outcomes?: SubjectOutcomeDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  prescribedTexts?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubjectOutlineDto)
  outline?: SubjectOutlineDto[];

  @IsOptional()
  @IsString()
  @MaxLength(16000)
  labDetails?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  books?: string[];

  @IsOptional()
  @IsEnum(AcademicDraftStatus)
  status?: AcademicDraftStatus;
}

export class QuestionOptionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  id: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  textBn?: string;
}

export class CreateQuestionDto {
  @IsOptional()
  @IsString()
  @Matches(ACADEMIC_SLUG, SLUG)
  slug?: string;

  @IsString()
  @Matches(ACADEMIC_SLUG, SLUG)
  subjectSlug: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  unit?: string;

  @IsEnum(QuestionType)
  type: QuestionType;

  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  prompt: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  promptBn?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  options?: QuestionOptionDto[];

  @IsOptional()
  @IsString()
  @MaxLength(20)
  correctOptionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16000)
  answer?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  marks?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  session?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  tags?: string[];

  @IsOptional()
  @IsEnum(AcademicDraftStatus)
  status?: AcademicDraftStatus;
}

export class UpdateQuestionDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  unit?: string;

  @IsOptional()
  @IsEnum(QuestionType)
  type?: QuestionType;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  prompt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  promptBn?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  options?: QuestionOptionDto[];

  @IsOptional()
  @IsString()
  @MaxLength(20)
  correctOptionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16000)
  answer?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  marks?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  session?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  tags?: string[];

  @IsOptional()
  @IsEnum(AcademicDraftStatus)
  status?: AcademicDraftStatus;
}
