# Daily Coding Stats

A lightweight VS Code extension that tracks characters, words, and lines you write each day — in real time — and displays the statistics in the bottom status bar.

## Features

- **Real-time tracking** — counts characters, words, and lines as you type, paste, or delete.
- **Status bar summary** — compact `✏ 1,250 chars / day` display that updates live.
- **Dashboard** — click the status bar item to open a clean webview with today's totals, a daily activity chart, and full history table.
- **Persistent storage** — daily stats survive restarts (stored via VS Code `globalState`).
- **Automatic day rollover** — counters reset at midnight (local time); previous days are preserved.

## Installation

### From source

```bash
git clone <repo-url>
cd daily-coding-stats
npm install
npm run compile
npm run package        # produces daily-coding-stats-1.0.0.vsix
```

Then install the `.vsix`:

```
code --install-extension daily-coding-stats-1.0.0.vsix
```

Or in VS Code: **Extensions → ⋯ → Install from VSIX…**

### Development

```bash
npm install
npm run watch          # recompile on save
# Press F5 in VS Code to launch the Extension Development Host
```

## Usage

1. **Status bar** — after activation, look for `✏ 0 chars / day` in the bottom-right status bar.
2. **Start typing** — the count updates in real time.
3. **Click the status bar item** — opens the Daily Coding Stats dashboard.
4. **Dashboard** shows:
   - Today's characters, words, and lines.
   - A line chart of daily activity (up to 90 days).
   - A scrollable history table (most recent first).

## Counting Rules

| Metric     | How it's counted |
|------------|------------------|
| Characters | `[...text].length` — full Unicode-aware count of inserted characters, minus `rangeLength` of the replaced range. |
| Words      | Sequences of non-whitespace (`/\S+/g`) in inserted text, minus an estimate for removed words (`rangeLength / 6`). |
| Lines      | Newline characters (`\n`) in inserted text, minus the line span of the replaced range. |

### Replacements & deletions

- **Replacement** (e.g., selecting "hello" and typing "world"): the old text is subtracted and the new text is added, so net change reflects the difference.
- **Deletion** (e.g., backspace): reduces character/word/line counts.
- **Net totals are clamped to ≥ 0** — they never display negative values.

### Deduplication

- `onDidChangeTextDocument` fires **once per edit transaction per document**, regardless of how many editor views are open for that document.
- Only `file:` and `untitled:` URI schemes are tracked (output channels, debug consoles, etc. are excluded).

## Technical Details

| Component | Implementation |
|-----------|---------------|
| Tracking  | `vscode.workspace.onDidChangeTextDocument` |
| Status bar | `vscode.window.createStatusBarItem` (right-aligned) |
| Persistence | `context.globalState` with key `dailyCodingStats.history` |
| Dashboard | `vscode.WebviewPanel` with inline canvas chart |
| Flush interval | Every 30 seconds (crash safety) |
| Day detection | `new Date()` → local `YYYY-MM-DD` |

## Limitations

- **Removed-word counting is estimated** — since VS Code doesn't provide the old text in change events, removed words are approximated as `rangeLength / 6`.
- **Undo/redo** generates change events — undoing 100 characters of typing will reduce the character count by 100.
- **External file changes** (e.g., `git checkout`) may trigger change events that affect counts.
- **No per-file or per-project breakdown** — only daily totals are tracked.
- **Chart shows the last 90 days** for readability.

## License

MIT
