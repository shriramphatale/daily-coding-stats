import * as vscode from "vscode";
import { StatsStorage } from "./storage";

/**
 * Manages the status-bar item that displays today's character count.
 *
 * Format:  `$(pencil) 1,250 chars / day`
 *
 * Clicking opens the dashboard command.
 */
export class StatusBar implements vscode.Disposable {
  private item: vscode.StatusBarItem;
  private storage: StatsStorage;

  constructor(storage: StatsStorage) {
    this.storage = storage;
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.item.command = "dailyCodingStats.showDashboard";
    this.item.tooltip = "Click to open Daily Coding Stats dashboard";
    this.refresh();
    this.item.show();
  }

  /** Update the displayed text from current storage data. */
  refresh(): void {
    const today = this.storage.getToday();
    const formatted = today.characters.toLocaleString("en-US");
    this.item.text = `$(pencil) ${formatted} chars / day`;
  }

  dispose(): void {
    this.item.dispose();
  }
}
