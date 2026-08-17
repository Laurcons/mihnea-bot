import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MigrationMarkerDocument = HydratedDocument<MigrationMarker>;

/**
 * Records that a one-off migration has run, so it survives restarts and
 * redeploys instead of firing on every boot.
 */
@Schema({ timestamps: true })
export class MigrationMarker {
  @Prop({ required: true }) key!: string;
  /** Free-form summary of what the run did, for after-the-fact inspection. */
  @Prop({ type: String, default: null }) note!: string | null;
}

export const MigrationMarkerSchema =
  SchemaFactory.createForClass(MigrationMarker);

MigrationMarkerSchema.index({ key: 1 }, { unique: true });
