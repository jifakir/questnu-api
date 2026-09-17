import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { createReadStream } from 'fs';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import * as path from 'path';
import type { Express } from 'express';
import type { Readable } from 'stream';
import { College, CollegeDocument } from '../modules/academics/schemas/college.schema';
import { User, UserDocument, UserRole } from './user.schema';

const AVATAR_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export type AuthUserSummary = {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  whatsappNumber: string | null;
  avatarUrl: string | null;
  avatarRequiresAuth: boolean;
  collegeCode: string | null;
  collegeName: string | null;
  department: string | null;
  currentYear: string | null;
};

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(College.name) private readonly colleges: Model<CollegeDocument>,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedFromEnv();
  }

  private uploadsRoot(): string {
    return this.config.get<string>('UPLOAD_DIR') ?? 'uploads';
  }

  private absUploadPath(relative: string): string {
    return path.join(process.cwd(), this.uploadsRoot(), relative);
  }

  private extForMime(mime: string): string {
    if (mime === 'image/png') return 'png';
    if (mime === 'image/webp') return 'webp';
    return 'jpg';
  }

  private async writeAvatarBuffer(
    userId: string,
    buffer: Buffer,
    mime: string,
  ): Promise<string> {
    if (!AVATAR_MIMES.has(mime)) {
      throw new BadRequestException(`Unsupported avatar type: ${mime}`);
    }
    if (buffer.length > AVATAR_MAX_BYTES) {
      throw new BadRequestException('Avatar file is too large (max 2MB)');
    }
    const relDir = path.join('avatars', userId);
    const absDir = this.absUploadPath(relDir);
    await mkdir(absDir, { recursive: true });
    const filename = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${this.extForMime(mime)}`;
    const rel = path.join(relDir, filename).replace(/\\/g, '/');
    await writeFile(this.absUploadPath(rel), buffer);
    return rel;
  }

  async removeAvatarUploadFile(user: UserDocument): Promise<void> {
    const rel = user.avatarUploadRel;
    if (!rel) return;
    try {
      await unlink(this.absUploadPath(rel));
    } catch {
      /* ignore missing file */
    }
    user.avatarUploadRel = undefined;
  }

  private validateWhatsapp(trimmed: string): string {
    if (trimmed.length > 32) {
      throw new BadRequestException('WhatsApp number is too long');
    }
    if (!/^[\d+\s().-]+$/.test(trimmed)) {
      throw new BadRequestException(
        'WhatsApp number may only contain digits, spaces, +, (, ), ., and -',
      );
    }
    return trimmed;
  }

  toAuthUserSummary(user: UserDocument): AuthUserSummary {
    const upload = user.avatarUploadRel;
    const external = user.googlePhotoUrl?.trim();
    return {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      name: (user.name ?? '').trim(),
      whatsappNumber: user.whatsappNumber?.trim() || null,
      avatarUrl: upload ? null : external || null,
      avatarRequiresAuth: !!upload,
      collegeCode: user.collegeCode?.trim() || null,
      collegeName: user.collegeName?.trim() || null,
      department: user.department?.trim() || null,
      currentYear: user.currentYear?.trim() || null,
    };
  }

  async getProfile(userId: string): Promise<AuthUserSummary> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return this.toAuthUserSummary(user);
  }

  async updateProfile(
    userId: string,
    body: {
      name?: string;
      clearAvatar?: boolean;
      whatsappNumber?: string;
      collegeCode?: string;
      collegeName?: string;
      department?: string;
      currentYear?: string;
    },
  ): Promise<AuthUserSummary> {
    if (
      body.name === undefined &&
      body.clearAvatar === undefined &&
      body.whatsappNumber === undefined &&
      body.collegeCode === undefined &&
      body.collegeName === undefined &&
      body.department === undefined &&
      body.currentYear === undefined
    ) {
      throw new BadRequestException('Nothing to update');
    }
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    if (body.name !== undefined) {
      const n = body.name.trim();
      if (!n.length) throw new BadRequestException('Name cannot be empty');
      if (n.length > 120) throw new BadRequestException('Name is too long');
      user.name = n;
    }
    if (body.clearAvatar === true) {
      await this.removeAvatarUploadFile(user);
    }
    if (body.whatsappNumber !== undefined) {
      const t = body.whatsappNumber.trim();
      if (!t.length) {
        user.set('whatsappNumber', undefined);
      } else {
        user.whatsappNumber = this.validateWhatsapp(t);
      }
    }
    this.assignOptionalText(user, 'collegeCode', body.collegeCode, 16);
    if (body.collegeCode !== undefined && body.collegeCode.trim()) {
      user.set('collegeName', undefined);
    }
    this.assignOptionalText(user, 'collegeName', body.collegeName, 160);
    this.assignOptionalText(user, 'department', body.department, 160);
    this.assignOptionalText(user, 'currentYear', body.currentYear, 80);
    await user.save();
    return this.toAuthUserSummary(user);
  }

  async setAvatarFromUpload(
    userId: string,
    file: Express.Multer.File | undefined,
  ): Promise<AuthUserSummary> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Avatar image is required');
    }
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    const prevRel = user.avatarUploadRel;
    const rel = await this.writeAvatarBuffer(userId, file.buffer, file.mimetype);
    user.avatarUploadRel = rel;
    await user.save();
    if (prevRel && prevRel !== rel) {
      try {
        await unlink(this.absUploadPath(prevRel));
      } catch {
        /* ignore */
      }
    }
    return this.toAuthUserSummary(user);
  }

  async getAvatarStreamForUser(
    userId: string,
  ): Promise<{ stream: Readable; mime: string }> {
    const user = await this.findById(userId);
    if (!user?.avatarUploadRel) {
      throw new NotFoundException('No uploaded avatar');
    }
    const rel = user.avatarUploadRel;
    const mime =
      rel.toLowerCase().endsWith('.png')
        ? 'image/png'
        : rel.toLowerCase().endsWith('.webp')
          ? 'image/webp'
          : 'image/jpeg';
    const stream = createReadStream(this.absUploadPath(rel));
    return { stream, mime };
  }

  private async seedFromEnv(): Promise<void> {
    const adminEmail = this.config.get<string>('ADMIN_EMAIL');
    const adminPassword = this.config.get<string>('ADMIN_PASSWORD');
    if (adminEmail && adminPassword) {
      const exists = await this.userModel.exists({ email: adminEmail.toLowerCase() });
      if (!exists) {
        await this.createUser(adminEmail, adminPassword, UserRole.Admin, 'Administrator');
      }
    }

    const instEmail = this.config.get<string>('SEED_INSTRUCTOR_EMAIL');
    const instPassword = this.config.get<string>('SEED_INSTRUCTOR_PASSWORD');
    if (instEmail && instPassword) {
      const exists = await this.userModel.exists({ email: instEmail.toLowerCase() });
      if (!exists) {
        await this.createUser(instEmail, instPassword, UserRole.Instructor, 'Instructor');
      }
    }
  }

  async createUser(
    email: string,
    password: string,
    role: UserRole,
    name: string,
    avatar?: { base64: string; mime: string },
    whatsappNumber?: string,
  ): Promise<UserDocument> {
    const passwordHash = await bcrypt.hash(password, 10);
    const trimmedName = name.trim();
    if (!trimmedName.length) {
      throw new BadRequestException('Name is required');
    }
    if (trimmedName.length > 120) {
      throw new BadRequestException('Name is too long');
    }
    let wa: string | undefined;
    if (whatsappNumber?.trim()) {
      wa = this.validateWhatsapp(whatsappNumber.trim());
    }
    const user = await this.userModel.create({
      email: email.toLowerCase().trim(),
      passwordHash,
      role,
      name: trimmedName,
      whatsappNumber: wa,
    });
    if (avatar?.base64?.length) {
      let buffer: Buffer;
      try {
        buffer = Buffer.from(avatar.base64, 'base64');
      } catch {
        throw new BadRequestException('Invalid avatar encoding');
      }
      const rel = await this.writeAvatarBuffer(user._id.toString(), buffer, avatar.mime);
      user.avatarUploadRel = rel;
      await user.save();
    }
    return user;
  }

  private applyReturningGoogleProfile(
    doc: UserDocument,
    params: { displayName?: string; photoUrl?: string },
  ): void {
    if (params.photoUrl?.trim()) {
      doc.googlePhotoUrl = params.photoUrl.trim();
    }
    if (params.displayName?.trim() && !doc.name?.trim()) {
      doc.name = params.displayName.trim();
    }
  }

  async findOrCreateGoogleStudent(params: {
    email: string;
    googleSub: string;
    displayName?: string;
    photoUrl?: string;
  }): Promise<UserDocument> {
    const normalizedEmail = params.email.toLowerCase().trim();

    const existingBySub = await this.userModel
      .findOne({ googleSub: params.googleSub })
      .exec();
    if (existingBySub) {
      this.applyReturningGoogleProfile(existingBySub, params);
      await existingBySub.save();
      return existingBySub;
    }

    const existingByEmail = await this.userModel
      .findOne({ email: normalizedEmail })
      .exec();
    if (existingByEmail) {
      if (!existingByEmail.googleSub) {
        existingByEmail.googleSub = params.googleSub;
        if (existingByEmail.role !== UserRole.Student) {
          existingByEmail.role = UserRole.Student;
        }
        this.applyReturningGoogleProfile(existingByEmail, params);
        return existingByEmail.save();
      }
      this.applyReturningGoogleProfile(existingByEmail, params);
      await existingByEmail.save();
      return existingByEmail;
    }

    const initialName =
      params.displayName?.trim() ||
      normalizedEmail.split('@')[0] ||
      'Student';

    return this.userModel.create({
      email: normalizedEmail,
      googleSub: params.googleSub,
      role: UserRole.Student,
      name: initialName.slice(0, 120),
      googlePhotoUrl: params.photoUrl?.trim() || undefined,
    });
  }

  private assignOptionalText(
    user: UserDocument,
    field: 'collegeCode' | 'collegeName' | 'department' | 'currentYear',
    value: string | undefined,
    max: number,
  ) {
    if (value === undefined) return;
    const trimmed = value.trim();
    if (!trimmed.length) {
      user.set(field, undefined);
      return;
    }
    if (trimmed.length > max) {
      throw new BadRequestException(`${field} is too long`);
    }
    user[field] = trimmed;
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase().trim() }).exec();
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async validatePassword(user: UserDocument, password: string): Promise<boolean> {
    if (!user.passwordHash) return false;
    return bcrypt.compare(password, user.passwordHash);
  }

  async listStudents(): Promise<
    Array<{
      id: string;
      email: string;
      name: string;
      whatsappNumber: string | null;
      createdAt?: Date;
      updatedAt?: Date;
    }>
  > {
    const rows = await this.userModel
      .find({ role: UserRole.Student })
      .sort({ createdAt: -1 })
      .select({ _id: 1, email: 1, name: 1, whatsappNumber: 1, createdAt: 1, updatedAt: 1 })
      .lean()
      .exec();
    return rows.map((u) => ({
      id: u._id.toString(),
      email: u.email,
      name: (u as { name?: string }).name ?? '',
      whatsappNumber: ((u as { whatsappNumber?: string }).whatsappNumber ?? '').trim() || null,
      createdAt: (u as { createdAt?: Date }).createdAt,
      updatedAt: (u as { updatedAt?: Date }).updatedAt,
    }));
  }

  async listInstructors(): Promise<
    Array<{
      id: string;
      email: string;
      name: string;
      whatsappNumber: string | null;
      createdAt?: Date;
      updatedAt?: Date;
    }>
  > {
    const rows = await this.userModel
      .find({ role: UserRole.Instructor })
      .sort({ createdAt: -1 })
      .select({ _id: 1, email: 1, name: 1, whatsappNumber: 1, createdAt: 1, updatedAt: 1 })
      .lean()
      .exec();
    return rows.map((u) => ({
      id: u._id.toString(),
      email: u.email,
      name: (u as { name?: string }).name ?? '',
      whatsappNumber: ((u as { whatsappNumber?: string }).whatsappNumber ?? '').trim() || null,
      createdAt: (u as { createdAt?: Date }).createdAt,
      updatedAt: (u as { updatedAt?: Date }).updatedAt,
    }));
  }

  async getStudentById(id: string) {
    const u = await this.userModel
      .findOne({ _id: id, role: UserRole.Student })
      .select({
        _id: 1,
        email: 1,
        name: 1,
        whatsappNumber: 1,
        googlePhotoUrl: 1,
        avatarUploadRel: 1,
        collegeCode: 1,
        collegeName: 1,
        department: 1,
        currentYear: 1,
        createdAt: 1,
        updatedAt: 1,
      })
      .lean()
      .exec();
    if (!u) return null;
    const code = u.collegeCode?.trim();
    const college = code
      ? await this.colleges.findOne({ slug: code.toLowerCase() }).lean().exec()
      : null;
    return this.toStudentDetail(u, college);
  }

  private toStudentDetail(
    u: {
      _id: { toString(): string };
      email: string;
      name?: string;
      whatsappNumber?: string;
      googlePhotoUrl?: string;
      avatarUploadRel?: string;
      collegeCode?: string;
      collegeName?: string;
      department?: string;
      currentYear?: string;
      createdAt?: Date;
      updatedAt?: Date;
    },
    college: {
      slug: string;
      name: string;
      email?: string;
      address?: string;
      upazilla?: string;
      district?: string;
      division?: string;
    } | null,
  ) {
    const upload = u.avatarUploadRel?.trim();
    const external = u.googlePhotoUrl?.trim();
    const populated = college
      ? {
          code: college.slug,
          name: college.name,
          email: college.email?.trim() || null,
          address: college.address?.trim() || null,
          upazilla: college.upazilla?.trim() || null,
          district: college.district?.trim() || null,
          division: college.division?.trim() || null,
        }
      : null;
    return {
      id: u._id.toString(),
      email: u.email,
      name: u.name ?? '',
      whatsappNumber: u.whatsappNumber?.trim() || null,
      avatarUrl: upload ? null : external || null,
      avatarRequiresAuth: !!upload,
      collegeCode: u.collegeCode?.trim() || populated?.code || null,
      college: populated,
      collegeName: populated?.name || u.collegeName?.trim() || null,
      department: u.department?.trim() || null,
      currentYear: u.currentYear?.trim() || null,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    };
  }
}
