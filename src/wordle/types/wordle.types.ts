export interface ParsedWordleResult {
  gameType: string;
  puzzleDay: number;
  tries: number | null; // null = failed (X), or game is scored rather than counted
  maxTries: number;
  score: number | null; // set instead of tries for scored games; higher is better
  scoreMax: number | null;
  attempts: string[]; // one element per emoji grid row
}
