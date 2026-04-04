import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type WordleResultDocument = HydratedDocument<WordleResult>;

@Schema({ timestamps: true })
export class WordleResult {
  @Prop({ required: true }) userId: string;
  @Prop({ required: true }) username: string;
  @Prop({ required: true }) loggedAt: Date;
  @Prop({ required: true }) gameType: string;
  @Prop({ required: true }) puzzleDay: number;
  @Prop({ type: Number, default: null }) tries: number | null;
  @Prop({ required: true }) maxTries: number;
  @Prop({ type: [String], required: true }) attempts: string[] = [];
}

export const WordleResultSchema = SchemaFactory.createForClass(WordleResult);

WordleResultSchema.index(
  { userId: 1, gameType: 1, puzzleDay: 1 },
  { unique: true },
);
