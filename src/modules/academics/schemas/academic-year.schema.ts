import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AcademicYearDocument = HydratedDocument<AcademicYear>;

@Schema({ timestamps: true, collection: 'academic_years' })
export class AcademicYear {
  /** Published catalog id, e.g. `1`. */
  @Prop({ required: true, unique: true, trim: true })
  slug: string;

  @Prop({ required: true, trim: true })
  label: string;

  @Prop({ trim: true, default: '' })
  labelBn: string;

  @Prop({ type: Number, default: 0 })
  sortOrder: number;
}

export const AcademicYearSchema = SchemaFactory.createForClass(AcademicYear);
