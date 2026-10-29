import * as vscode from "vscode";
import { StatsStorage } from "./storage";
import { Tracker } from "./tracker";
import { StatusBar } from "./statusBar";
import { Dashboard } from "./dashboard";

/**
 * Extension entry point.
 *
 * Lifecycle:
 * 1. Create storage (reads persisted data from globalState).
 * 2. Create the status bar item.
 * 3. Create the tracker (starts listening to document changes).
 * 4. Wire the tracker's update callback to refresh the status bar.
 * 5. Register the dashboard command.
 * 6. Push all disposables so VS Code cleans up on deactivation.
 */
export function activate(context: vscode.ExtensionContext): void {
  const storage = new StatsStorage(context.globalState);
  const statusBar = new StatusBar(storage);
  const dashboard = new Dashboard(storage);
  const tracker = new Tracker(storage);

  // Wire real-time updates: tracker → status bar.
  tracker.onDidUpdate = () => {
    statusBar.refresh();
  };

  // Command: open dashboard.
  const cmd = vscode.commands.registerCommand(
    "dailyCodingStats.showDashboard",
    () => {
      dashboard.show();
    }
  );

  // Register all disposables for cleanup.
  context.subscriptions.push(tracker, statusBar, dashboard, cmd);
}

export function deactivate(): void {
  // All cleanup handled via disposables registered in activate().
}
