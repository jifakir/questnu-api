import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CollegeDocument = HydratedDocument<College>;

@Schema({ timestamps: true, collection: 'academic_colleges' })
export class College {
  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  slug: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true, default: '' })
  nameBn: string;

  @Prop({ trim: true, default: '' })
  email: string;

  @Prop({ trim: true, default: '' })
  address: string;

  @Prop({ trim: true, default: '' })
  upazilla: string;

  @Prop({ trim: true, default: '' })
  district: string;

  @Prop({ trim: true, default: '' })
  division: string;

  @Prop({ type: Number, default: 0 })
  sortOrder: number;
}

export const CollegeSchema = SchemaFactory.createForClass(College);
CollegeSchema.index({ name: 1 });
CollegeSchema.index({ district: 1, name: 1 });
