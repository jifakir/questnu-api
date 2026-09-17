import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type DepartmentDocument = HydratedDocument<Department>;

@Schema({ timestamps: true, collection: 'academic_departments' })
export class Department {
  /** Published catalog id, e.g. `accounting`. */
  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  slug: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true, default: '' })
  nameBn: string;

  @Prop({ type: Number, default: 0 })
  sortOrder: number;
}

export const DepartmentSchema = SchemaFactory.createForClass(Department);
