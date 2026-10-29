import * as vscode from "vscode";
import { DailyStats } from "./types";
import { StatsStorage } from "./storage";

/**
 * Manages the Webview-based dashboard panel.
 *
 * Only one panel is open at a time (singleton pattern).
 */
export class Dashboard implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private storage: StatsStorage;

  constructor(storage: StatsStorage) {
    this.storage = storage;
  }

  /** Show the dashboard. If already open, reveal it. */
  show(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      this.updateContent();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      "dailyCodingStats",
      "Daily Coding Stats",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });

    this.updateContent();
  }

  /** Refresh the webview HTML with current data. */
  updateContent(): void {
    if (!this.panel) {
      return;
    }
    const allDays = this.storage.getAllDays();
    const today = this.storage.getToday();
    this.panel.webview.html = this.buildHtml(today, allDays);
  }

  // ── HTML builder ───────────────────────────────────────────────────

  private buildHtml(today: DailyStats, history: DailyStats[]): string {
    // Limit history to the last 90 days for readability.
    const recent = history.slice(-90);
    const historyJson = JSON.stringify(recent);

    // Use VS Code's built-in CSS variables for native look.
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta
    http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';"
  />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Daily Coding Stats</title>
  <style>
    /* ── Reset & base ─────────────────────────────── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 24px 32px;
      line-height: 1.5;
    }

    /* ── Header ───────────────────────────────────── */
    .header {
      display: flex;
      align-items: baseline;
      gap: 12px;
      margin-bottom: 28px;
      border-bottom: 1px solid var(--vscode-widget-border, #333);
      padding-bottom: 16px;
    }
    .header h1 {
      font-size: 20px;
      font-weight: 600;
      letter-spacing: -0.3px;
    }
    .header .date {
      font-size: 13px;
      opacity: 0.6;
    }

    /* ── Today cards ──────────────────────────────── */
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      margin-bottom: 36px;
    }
    .card {
      background: var(--vscode-editorWidget-background, #252526);
      border: 1px solid var(--vscode-widget-border, #333);
      border-radius: 8px;
      padding: 20px;
      text-align: center;
    }
    .card .value {
      font-size: 32px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      line-height: 1.2;
    }
    .card .label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      opacity: 0.55;
      margin-top: 6px;
    }
    .card.chars  .value { color: #569cd6; }
    .card.words  .value { color: #4ec9b0; }
    .card.lines  .value { color: #dcdcaa; }

    /* ── Chart ────────────────────────────────────── */
    .chart-section {
      margin-bottom: 36px;
    }
    .chart-section h2 {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 16px;
    }
    .chart-wrap {
      background: var(--vscode-editorWidget-background, #252526);
      border: 1px solid var(--vscode-widget-border, #333);
      border-radius: 8px;
      padding: 20px 20px 12px;
      overflow-x: auto;
    }
    canvas {
      display: block;
      width: 100%;
      height: 280px;
    }
    .legend {
      display: flex;
      gap: 20px;
      justify-content: center;
      margin-top: 12px;
      font-size: 12px;
    }
    .legend span {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .legend .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      display: inline-block;
    }

    /* ── History table ────────────────────────────── */
    .history-section h2 {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 12px;
    }
    .table-wrap {
      max-height: 400px;
      overflow-y: auto;
      border: 1px solid var(--vscode-widget-border, #333);
      border-radius: 8px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-variant-numeric: tabular-nums;
    }
    th, td {
      padding: 8px 16px;
      text-align: right;
      border-bottom: 1px solid var(--vscode-widget-border, #333);
    }
    th {
      position: sticky;
      top: 0;
      background: var(--vscode-editorWidget-background, #252526);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      opacity: 0.6;
    }
    td:first-child, th:first-child { text-align: left; }
    tr:last-child td { border-bottom: none; }
    tr:hover td {
      background: var(--vscode-list-hoverBackground, rgba(255,255,255,0.04));
    }

    .empty-state {
      text-align: center;
      padding: 48px 0;
      opacity: 0.5;
    }
  </style>
</head>
<body>

  <div class="header">
    <h1>Daily Coding Stats</h1>
    <span class="date">${today.date}</span>
  </div>

  <!-- Today's totals -->
  <div class="cards">
    <div class="card chars">
      <div class="value">${today.characters.toLocaleString("en-US")}</div>
      <div class="label">Characters Today</div>
    </div>
    <div class="card words">
      <div class="value">${today.words.toLocaleString("en-US")}</div>
      <div class="label">Words Today</div>
    </div>
    <div class="card lines">
      <div class="value">${today.lines.toLocaleString("en-US")}</div>
      <div class="label">Lines Today</div>
    </div>
  </div>

  <!-- Chart -->
  <div class="chart-section">
    <h2>Daily Activity</h2>
    <div class="chart-wrap">
      <canvas id="chart"></canvas>
      <div class="legend">
        <span><span class="dot" style="background:#569cd6"></span> Characters</span>
        <span><span class="dot" style="background:#4ec9b0"></span> Words</span>
        <span><span class="dot" style="background:#dcdcaa"></span> Lines</span>
      </div>
    </div>
  </div>

  <!-- History table -->
  <div class="history-section">
    <h2>Daily History</h2>
    ${recent.length === 0
      ? '<div class="empty-state">No data yet. Start coding!</div>'
      : this.buildTable(recent)
    }
  </div>

  <script>
    // ── Minimal Canvas Chart ─────────────────────────
    (function () {
      const data = ${historyJson};
      if (data.length === 0) return;

      const canvas = document.getElementById("chart");
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);

      const W = rect.width;
      const H = rect.height;
      const PAD_L = 58;
      const PAD_R = 16;
      const PAD_T = 16;
      const PAD_B = 48;
      const plotW = W - PAD_L - PAD_R;
      const plotH = H - PAD_T - PAD_B;

      const maxVal = Math.max(
        1,
        ...data.map(d => Math.max(d.characters, d.words, d.lines))
      );

      // Nice round max for Y axis.
      const niceMax = niceNum(maxVal);
      const ticks = 5;

      function niceNum(v) {
        const exp = Math.floor(Math.log10(v));
        const frac = v / Math.pow(10, exp);
        let nice;
        if (frac <= 1.5) nice = 1;
        else if (frac <= 3) nice = 2;
        else if (frac <= 7) nice = 5;
        else nice = 10;
        return nice * Math.pow(10, exp);
      }

      function xPos(i) { return PAD_L + (plotW / Math.max(1, data.length - 1)) * i; }
      function yPos(v) { return PAD_T + plotH - (v / niceMax) * plotH; }

      // Grid lines + Y labels.
      ctx.strokeStyle = "rgba(128,128,128,0.15)";
      ctx.lineWidth = 1;
      ctx.font = "11px " + getComputedStyle(document.body).fontFamily;
      ctx.fillStyle = "rgba(128,128,128,0.6)";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (let i = 0; i <= ticks; i++) {
        const val = (niceMax / ticks) * i;
        const y = yPos(val);
        ctx.beginPath();
        ctx.moveTo(PAD_L, y);
        ctx.lineTo(W - PAD_R, y);
        ctx.stroke();
        ctx.fillText(formatNum(val), PAD_L - 8, y);
      }

      // X labels (show up to ~15 labels to avoid clutter).
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const labelStep = Math.max(1, Math.ceil(data.length / 15));
      for (let i = 0; i < data.length; i += labelStep) {
        const x = xPos(i);
        // Short date: MM/DD.
        const parts = data[i].date.split("-");
        ctx.fillText(parts[1] + "/" + parts[2], x, PAD_T + plotH + 8);
      }

      // Draw lines.
      function drawLine(key, color) {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.lineJoin = "round";
        for (let i = 0; i < data.length; i++) {
          const x = xPos(i);
          const y = yPos(data[i][key]);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Dots.
        for (let i = 0; i < data.length; i++) {
          ctx.beginPath();
          ctx.arc(xPos(i), yPos(data[i][key]), 3, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        }
      }

      drawLine("characters", "#569cd6");
      drawLine("words", "#4ec9b0");
      drawLine("lines", "#dcdcaa");

      function formatNum(n) {
        if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k";
        return String(Math.round(n));
      }
    })();
  </script>
</body>
</html>`;
  }

  private buildTable(days: DailyStats[]): string {
    // Show most recent first in the table.
    const reversed = [...days].reverse();
    let rows = "";
    for (const d of reversed) {
      rows += `<tr>
        <td>${d.date}</td>
        <td>${d.characters.toLocaleString("en-US")}</td>
        <td>${d.words.toLocaleString("en-US")}</td>
        <td>${d.lines.toLocaleString("en-US")}</td>
      </tr>`;
    }
    return `<div class="table-wrap">
      <table>
        <thead><tr><th>Date</th><th>Characters</th><th>Words</th><th>Lines</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }

  dispose(): void {
    this.panel?.dispose();
  }
}
