/**
 * Shared type definitions for Daily Coding Stats.
 */

/** Statistics for a single day. */
export interface DailyStats {
  /** ISO date string (YYYY-MM-DD) in local time. */
  date: string;
  /** Net characters added (insertions minus deletions). Clamped to >= 0. */
  characters: number;
  /** Net words added (insertions minus deletions). Clamped to >= 0. */
  words: number;
  /** Net lines added (insertions minus deletions). Clamped to >= 0. */
  lines: number;
}

/** The full persisted state: a map from date string to DailyStats. */
export type StatsRecord = Record<string, DailyStats>;

/** Key used in globalState for persistence. */
export const STORAGE_KEY = "dailyCodingStats.history";
