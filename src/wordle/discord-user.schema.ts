import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type DiscordUserDocument = HydratedDocument<DiscordUser>;

export class WordleStats {
  @Prop({ required: true }) lastPuzzleDay!: number;
  @Prop({ required: true }) currentStreak!: number;
  @Prop({ required: true }) biggestStreak!: number;
}

export const WordleStatsSchema = SchemaFactory.createForClass(WordleStats);

@Schema({ timestamps: true })
export class DiscordUser {
  @Prop({ required: true }) discordId!: string;
  @Prop({ required: true }) username!: string;
  @Prop({ type: Map, of: WordleStatsSchema })
  wordleStats!: Map<string, WordleStats>;
}

export const DiscordUserSchema = SchemaFactory.createForClass(DiscordUser);

DiscordUserSchema.index({ discordId: 1 }, { unique: true });
