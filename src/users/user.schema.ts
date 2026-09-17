import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export enum UserRole {
  Student = 'student',
  Instructor = 'instructor',
  Admin = 'admin',
}

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop()
  passwordHash?: string;

  @Prop({ unique: true, sparse: true })
  googleSub?: string;

  @Prop({ type: String, enum: UserRole, required: true })
  role: UserRole;

  @Prop({ trim: true, default: '' })
  name: string;

  /** Profile image from Google (or other OAuth); used when no uploaded avatar. */
  @Prop({ trim: true })
  googlePhotoUrl?: string;

  /** Relative path under UPLOAD_DIR, e.g. avatars/<userId>/file.webp */
  @Prop({ trim: true })
  avatarUploadRel?: string;

  /** WhatsApp contact number (digits, +, spaces, etc.). */
  @Prop({ trim: true })
  whatsappNumber?: string;

  /** NU college code, e.g. 0101. Display fields are looked up from this code. */
  @Prop({ trim: true })
  collegeCode?: string;

  /** Legacy free-text name. New profiles store collegeCode instead. */
  @Prop({ trim: true })
  collegeName?: string;

  @Prop({ trim: true })
  department?: string;

  /** Academic year the student is currently reading, e.g. 1st Year. */
  @Prop({ trim: true })
  currentYear?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
