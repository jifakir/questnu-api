import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type StudentProfileDocument = HydratedDocument<StudentProfile>;

/** Academic placement for one student. One document per user. */
@Schema({ timestamps: true, collection: 'student_profiles' })
export class StudentProfile {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  /** NU college code, e.g. 0101. */
  @Prop({ trim: true })
  collegeCode?: string;

  /** Catalog department slug, e.g. accounting. */
  @Prop({ trim: true })
  departmentId?: string;

  /** Catalog year slug, e.g. 1. */
  @Prop({ trim: true })
  yearId?: string;
}

export const StudentProfileSchema = SchemaFactory.createForClass(StudentProfile);
