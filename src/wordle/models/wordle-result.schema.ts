import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type WordleResultDocument = HydratedDocument<WordleResult>;

@Schema({ timestamps: true })
export class WordleResult {
  @Prop({ required: true }) userId!: string;
  @Prop({ required: true }) username!: string;
  @Prop({ required: true }) loggedAt!: Date;
  @Prop({ required: true }) gameType!: string;
  @Prop({ required: true }) puzzleDay!: number;
  @Prop({ type: Number, default: null }) tries!: number | null;
  @Prop({ required: true }) maxTries!: number;
  // Set instead of tries for games scored on a scale (higher is better).
  @Prop({ type: Number, default: null }) score!: number | null;
  @Prop({ type: Number, default: null }) scoreMax!: number | null;
  @Prop({ type: [String], required: true }) attempts: string[] = [];
}

export const WordleResultSchema = SchemaFactory.createForClass(WordleResult);

WordleResultSchema.index(
  { userId: 1, gameType: 1, puzzleDay: 1 },
  { unique: true },
);
