import * as vscode from "vscode";
import { DailyStats, StatsRecord, STORAGE_KEY } from "./types";

/**
 * Handles persistence of daily statistics using VS Code globalState.
 *
 * All reads and writes go through this class so the rest of the extension
 * never touches globalState directly.
 */
export class StatsStorage {
  private state: vscode.Memento;
  private cache: StatsRecord;

  constructor(globalState: vscode.Memento) {
    this.state = globalState;
    this.cache = this.state.get<StatsRecord>(STORAGE_KEY) ?? {};
  }

  // ── Helpers ────────────────────────────────────────────────────────

  /** Return today's date string in local time (YYYY-MM-DD). */
  static todayKey(): string {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // ── Public API ─────────────────────────────────────────────────────

  /** Get today's stats, creating a fresh record if none exists. */
  getToday(): DailyStats {
    const key = StatsStorage.todayKey();
    if (!this.cache[key]) {
      this.cache[key] = { date: key, characters: 0, words: 0, lines: 0 };
    }
    return this.cache[key];
  }

  /**
   * Increment (or decrement) today's stats by the given deltas.
   * Net totals are clamped to >= 0 so the display never goes negative.
   */
  addDelta(charsDelta: number, wordsDelta: number, linesDelta: number): DailyStats {
    const today = this.getToday();
    today.characters = Math.max(0, today.characters + charsDelta);
    today.words = Math.max(0, today.words + wordsDelta);
    today.lines = Math.max(0, today.lines + linesDelta);
    return today;
  }

  /** Persist the in-memory cache to globalState. */
  async flush(): Promise<void> {
    await this.state.update(STORAGE_KEY, this.cache);
  }

  /** Return the full history sorted oldest-first. */
  getAllDays(): DailyStats[] {
    return Object.values(this.cache).sort((a, b) => a.date.localeCompare(b.date));
  }
}
