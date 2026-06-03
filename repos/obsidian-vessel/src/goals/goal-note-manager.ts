/**
 * Goal Note Manager
 *
 * Creates and manages vault notes for goal executions dispatched to
 * goal-host-vessel. Each goal gets a note under Goals/<executionId>.md
 * with YAML frontmatter tracking status, plus a running log of events.
 */

import type { App, TFile } from 'obsidian';

const GOALS_FOLDER = 'Goals';

export class GoalNoteManager {
  constructor(private app: App) {}

  /**
   * Ensure the Goals folder exists.
   */
  private async ensureFolder(): Promise<void> {
    const existing = this.app.vault.getAbstractFileByPath(GOALS_FOLDER);
    if (!existing) {
      await this.app.vault.createFolder(GOALS_FOLDER);
    }
  }

  /**
   * Create a new goal note with initial frontmatter.
   * Returns the TFile, or null if creation fails.
   */
  async createGoalNote(executionId: string, goal: string): Promise<TFile | null> {
    try {
      await this.ensureFolder();

      const startedAt = new Date().toISOString();
      // Escape any backticks or quotes in the goal for safe YAML embedding
      const safeGoal = goal.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

      const content = [
        '---',
        `executionId: "${executionId}"`,
        `goal: "${safeGoal}"`,
        `status: running`,
        `startedAt: "${startedAt}"`,
        `completedAt: null`,
        '---',
        '',
        `# Goal: ${goal}`,
        '',
        `**Execution ID:** \`${executionId}\`  `,
        `**Started:** ${startedAt}`,
        '',
        '## Events',
        '',
      ].join('\n');

      const path = `${GOALS_FOLDER}/${executionId}.md`;
      const file = await this.app.vault.create(path, content);
      return file;
    } catch (error) {
      console.error('[GoalNoteManager] Failed to create goal note:', error);
      return null;
    }
  }

  /**
   * Append an event line to the goal note.
   * Uses vault.process for atomic, concurrent-safe writes.
   */
  async appendEvent(file: TFile, eventLine: string): Promise<void> {
    try {
      await this.app.vault.process(file, (data) => {
        return data + eventLine + '\n';
      });
    } catch (error) {
      console.error('[GoalNoteManager] Failed to append event:', error);
    }
  }

  /**
   * Update frontmatter to mark the goal complete/failed.
   */
  async markComplete(file: TFile, status: string): Promise<void> {
    try {
      await this.app.fileManager.processFrontMatter(file, (fm) => {
        fm.status = status;
        fm.completedAt = new Date().toISOString();
      });
    } catch (error) {
      console.error('[GoalNoteManager] Failed to mark complete:', error);
    }
  }

  /**
   * Return the TFile for an existing goal note, if it exists.
   */
  getGoalFile(executionId: string): TFile | null {
    const path = `${GOALS_FOLDER}/${executionId}.md`;
    const f = this.app.vault.getAbstractFileByPath(path);
    if (f && 'stat' in f) return f as TFile;
    return null;
  }
}
