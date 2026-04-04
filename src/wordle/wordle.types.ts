export interface ParsedWordleResult {
  gameType: string;
  puzzleDay: number;
  tries: number | null; // null = failed (X)
  maxTries: number;
  attempts: string[]; // one element per emoji grid row
}
