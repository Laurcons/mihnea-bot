import { Model } from 'mongoose';
import { WordleStreakService } from './wordle-streak.service';
import { WordleResult } from './models/wordle-result.schema';
import { DiscordUser } from './models/discord-user.schema';
import { WordleParserService } from './wordle-parser.service';

describe('WordleStreakService.recordResult', () => {
  const findOneAndUpdate = jest.fn();

  const service = new WordleStreakService(
    {} as Model<WordleResult>,
    { findOneAndUpdate } as unknown as Model<DiscordUser>,
    {} as WordleParserService,
  );

  beforeEach(() => findOneAndUpdate.mockReset());

  const callArgs = async () => {
    await service.recordResult('user-1', 'laurcons', 'Magnitudle', 229);
    return findOneAndUpdate.mock.calls[0] as [
      unknown,
      unknown,
      Record<string, unknown>,
    ];
  };

  it('updates the right user', async () => {
    const [filter] = await callArgs();

    expect(filter).toEqual({ discordId: 'user-1' });
  });

  // Regression: this update is an aggregation pipeline, and Mongoose 9 throws
  // "Cannot pass an array to query updates unless the `updatePipeline` option
  // is set" without the flag — after the result row has already been inserted.
  it('sets updatePipeline whenever the update is a pipeline array', async () => {
    const [, update, options] = await callArgs();

    expect(Array.isArray(update)).toBe(true);
    expect(options).toMatchObject({ upsert: true, updatePipeline: true });
  });

  it('writes under the game-specific stats key', async () => {
    const [, update] = await callArgs();
    const [stage] = update as [{ $set: Record<string, unknown> }];

    expect(Object.keys(stage.$set)).toContain('wordleStats.Magnitudle');
  });
});
