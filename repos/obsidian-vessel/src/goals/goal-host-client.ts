/**
 * Goal Host Client
 *
 * Thin wrapper around goal-host-vessel's /run-goal endpoint.
 * Uses Obsidian's requestUrl to avoid CORS restrictions from the
 * app://obsidian.md origin.
 */

import { requestUrl } from 'obsidian';

export interface GoalDispatchResult {
  executionId: string;
  status: string;
  selectedTemplateId?: string;
}

export class GoalHostClient {
  constructor(
    private endpoint: string,
    private apiKey: string,
  ) {}

  async dispatchGoal(goal: string): Promise<GoalDispatchResult> {
    const resp = await requestUrl({
      url: `${this.endpoint}/run-goal`,
      method: 'POST',
      headers: {
        'Authorization': `ApiKey ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ goal }),
    });
    return resp.json as GoalDispatchResult;
  }
}
