import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AcademicDraftStatus, QuestionType } from './academic.constants';
import { assertSlug, cleanStringList, slugFromName } from './academic.util';
import type { CreateQuestionDto, UpdateQuestionDto } from './dto/academic.dto';
import { Question, QuestionDocument } from './schemas/question.schema';
import { Subject, SubjectDocument } from './schemas/subject.schema';

@Injectable()
export class QuestionsService {
  constructor(
    @InjectModel(Question.name)
    private readonly questions: Model<QuestionDocument>,
    @InjectModel(Subject.name)
    private readonly subjects: Model<SubjectDocument>,
  ) {}

  list(filters: {
    departmentId?: string;
    yearId?: string;
    subjectSlug?: string;
  }) {
    const query: Record<string, string> = {};
    if (filters.departmentId) query.departmentId = assertSlug(filters.departmentId);
    if (filters.yearId) query.yearId = assertSlug(filters.yearId);
    if (filters.subjectSlug) query.subjectSlug = assertSlug(filters.subjectSlug);
    return this.questions
      .find(query)
      .sort({ subjectSlug: 1, unit: 1, updatedAt: -1 })
      .lean()
      .exec();
  }

  async findOne(slug: string) {
    const doc = await this.questions.findOne({ slug: assertSlug(slug) }).lean().exec();
    if (!doc) throw new NotFoundException('Question not found');
    return doc;
  }

  async create(dto: CreateQuestionDto) {
    const subject = await this.subjects
      .findOne({ slug: assertSlug(dto.subjectSlug) })
      .lean()
      .exec();
    if (!subject) throw new NotFoundException('Subject not found');
    this.assertOptions(dto.type, dto.options, dto.correctOptionId);
    const slug = dto.slug
      ? assertSlug(dto.slug)
      : await this.uniqueSlug(subject.slug, dto.prompt);
    try {
      const doc = await this.questions.create({
        slug,
        subjectSlug: subject.slug,
        departmentId: subject.departmentId,
        yearId: subject.yearId,
        unit: dto.unit?.trim() ?? '',
        type: dto.type,
        prompt: dto.prompt.trim(),
        promptBn: dto.promptBn?.trim() ?? '',
        options: dto.options ?? [],
        correctOptionId: dto.correctOptionId?.trim() ?? '',
        answer: dto.answer?.trim() ?? '',
        marks: dto.marks ?? 1,
        session: dto.session?.trim() ?? '',
        tags: cleanStringList(dto.tags, 20),
        status: dto.status ?? AcademicDraftStatus.Draft,
      });
      return doc.toJSON();
    } catch (err) {
      if (this.isDuplicate(err)) {
        throw new ConflictException('Question slug already exists');
      }
      throw err;
    }
  }

  async update(slug: string, dto: UpdateQuestionDto) {
    const current = await this.findOne(slug);
    const type = dto.type ?? current.type;
    const options = dto.options ?? current.options;
    const correct = dto.correctOptionId ?? current.correctOptionId;
    this.assertOptions(type, options, correct);
    const doc = await this.questions
      .findOneAndUpdate(
        { slug: current.slug },
        {
          $set: {
            ...(dto.unit !== undefined ? { unit: dto.unit.trim() } : {}),
            ...(dto.type !== undefined ? { type: dto.type } : {}),
            ...(dto.prompt !== undefined ? { prompt: dto.prompt.trim() } : {}),
            ...(dto.promptBn !== undefined ? { promptBn: dto.promptBn.trim() } : {}),
            ...(dto.options !== undefined ? { options: dto.options } : {}),
            ...(dto.correctOptionId !== undefined
              ? { correctOptionId: dto.correctOptionId.trim() }
              : {}),
            ...(dto.answer !== undefined ? { answer: dto.answer.trim() } : {}),
            ...(dto.marks !== undefined ? { marks: dto.marks } : {}),
            ...(dto.session !== undefined ? { session: dto.session.trim() } : {}),
            ...(dto.tags !== undefined ? { tags: cleanStringList(dto.tags, 20) } : {}),
            ...(dto.status !== undefined ? { status: dto.status } : {}),
          },
        },
        { new: true },
      )
      .lean()
      .exec();
    return doc;
  }

  async remove(slug: string) {
    const res = await this.questions.deleteOne({ slug: assertSlug(slug) }).exec();
    if (!res.deletedCount) throw new NotFoundException('Question not found');
    return { deleted: true };
  }

  private assertOptions(
    type: QuestionType,
    options: { id: string }[] | undefined,
    correctOptionId?: string,
  ) {
    if (type !== QuestionType.Mcq) return;
    if (!options || options.length < 2) {
      throw new BadRequestException('MCQ questions need at least two options');
    }
    if (correctOptionId && !options.some((opt) => opt.id === correctOptionId)) {
      throw new BadRequestException('correctOptionId must match an option id');
    }
  }

  private async uniqueSlug(subjectSlug: string, prompt: string) {
    const base = slugFromName(prompt).slice(0, 48) || 'question';
    let candidate = `${subjectSlug}-${base}`.slice(0, 81);
    let n = 2;
    while (await this.questions.exists({ slug: candidate })) {
      const suffix = `-${n}`;
      candidate = `${subjectSlug}-${base}`.slice(0, 81 - suffix.length) + suffix;
      n += 1;
    }
    return candidate;
  }

  private isDuplicate(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      (err as { code?: number }).code === 11000
    );
  }
}
