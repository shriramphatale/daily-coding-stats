import * as vscode from "vscode";
import { StatsStorage } from "./storage";

/**
 * Word-boundary regex used for consistent counting.
 * Matches sequences of word characters (Unicode-aware via \w) separated
 * by whitespace or punctuation. This is intentionally simple and deterministic.
 */
const WORD_RE = /\S+/g;

/** Count words in a string using a consistent rule. */
function countWords(text: string): number {
  const matches = text.match(WORD_RE);
  return matches ? matches.length : 0;
}

/** Count newline characters in a string. */
function countNewlines(text: string): number {
  let n = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) { // '\n'
      n++;
    }
  }
  return n;
}

/**
 * Observes text-document changes and accumulates deltas into StatsStorage.
 *
 * Counting rules
 * ──────────────
 * For every ContentChangeEvent:
 *   • Characters inserted = text.length  (full Unicode string length)
 *   • Characters removed  = rangeLength  (replaced range length)
 *   • Words inserted      = words in inserted text
 *   • Words removed        = words in the replaced text (reconstructed from rangeLength)
 *   • Lines inserted      = newlines in inserted text
 *   • Lines removed        = number of lines spanned by the replaced range minus one
 *
 * Deletions and replacements reduce the totals (clamped to 0 by storage).
 * This prevents double-counting: replacing "hello" with "world" yields
 * +5 chars inserted, −5 chars removed → net 0 character change.
 *
 * The tracker listens only to onDidChangeTextDocument, which fires once
 * per edit transaction regardless of how many editor views are open for
 * the same document, preventing duplicate counting.
 */
export class Tracker implements vscode.Disposable {
  private storage: StatsStorage;
  private disposable: vscode.Disposable;
  private flushTimer: ReturnType<typeof setInterval> | undefined;

  /** The date key when the tracker was last active. Used to detect day rollovers. */
  private currentDay: string;

  /** Callback fired after every change so the status bar can update. */
  onDidUpdate: (() => void) | undefined;

  constructor(storage: StatsStorage) {
    this.storage = storage;
    this.currentDay = StatsStorage.todayKey();

    // Listen for text-document changes (fires once per edit, per document).
    this.disposable = vscode.workspace.onDidChangeTextDocument((e) =>
      this.handleChange(e)
    );

    // Flush to disk every 30 seconds so we don't lose data on crash.
    this.flushTimer = setInterval(() => {
      this.storage.flush();
    }, 30_000);
  }

  // ── Core logic ─────────────────────────────────────────────────────

  private handleChange(event: vscode.TextDocumentChangeEvent): void {
    // Skip output channels, debug consoles, etc.
    if (event.document.uri.scheme !== "file" && event.document.uri.scheme !== "untitled") {
      return;
    }

    // Detect day rollover.
    const today = StatsStorage.todayKey();
    if (today !== this.currentDay) {
      this.storage.flush(); // persist yesterday's data
      this.currentDay = today;
    }

    let charsDelta = 0;
    let wordsDelta = 0;
    let linesDelta = 0;

    for (const change of event.contentChanges) {
      // ── Inserted ──
      const insertedChars = [...change.text].length; // Unicode-aware count
      const insertedWords = countWords(change.text);
      const insertedLines = countNewlines(change.text);

      // ── Removed ──
      // rangeLength gives the number of UTF-16 code units replaced.
      // We use the range's line span to determine removed lines.
      const removedChars = change.rangeLength;
      const removedLines = change.range.end.line - change.range.start.line;

      // For removed words we estimate from rangeLength.
      // Since we don't have the old text, we approximate:
      // if rangeLength > 0 and no text is inserted, it was a pure deletion;
      // we reconstruct the old text from the document *before* this batch,
      // but VS Code doesn't expose it. Instead we use a heuristic:
      // average word length ≈ 5 chars + 1 space → ~6 chars per word.
      // However, for replacements (rangeLength > 0 AND text.length > 0)
      // we only count the *net* word change: inserted - estimated removed.
      const estimatedRemovedWords =
        removedChars > 0 ? Math.max(1, Math.round(removedChars / 6)) : 0;

      charsDelta += insertedChars - removedChars;
      wordsDelta += insertedWords - estimatedRemovedWords;
      linesDelta += insertedLines - removedLines;
    }

    if (charsDelta !== 0 || wordsDelta !== 0 || linesDelta !== 0) {
      this.storage.addDelta(charsDelta, wordsDelta, linesDelta);
      this.onDidUpdate?.();
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────────────

  dispose(): void {
    this.disposable.dispose();
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    // Final flush.
    this.storage.flush();
  }
}
