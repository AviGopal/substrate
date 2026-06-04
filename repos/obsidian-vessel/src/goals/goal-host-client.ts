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

/**
 * Snapshot of the current Obsidian workspace state.
 *
 * Passed as `variables` to /run-goal so activities can reference vault
 * context via template interpolation ({{active_note_path}}, etc.) and so
 * Thompson sampling can bias toward activities that accept obsidian shapes.
 *
 * All fields are optional — the client collects what's available and skips
 * anything the API doesn't expose.
 */
export interface VaultContext {
  /** Path of the note currently focused in the editor. */
  active_note_path?: string;
  /** Headings breadcrumb of the cursor position, e.g. "## Section > ### Sub". */
  active_note_section?: string;
  /** Text the user has selected in the active editor, if any. */
  selection?: string;
  /** Paths of all notes currently open in workspace tabs. */
  open_note_paths?: string[];
  /** Vault-root filesystem path (so activities can construct absolute paths). */
  vault_path?: string;
  /** Obsidian-vessel HTTP resolve endpoint for impulse callbacks. */
  obsidian_vessel_endpoint?: string;
  /** Shape tags this context exposes — fed to expected_output_shapes hint. */
  available_shapes?: string[];
}

export class GoalHostClient {
  constructor(
    private endpoint: string,
    private apiKey: string,
  ) {}

  /**
   * Poll GET /executions/:dispatchId until the execution_id is known (status ≠ running)
   * or the timeout elapses. Returns the executionId or null on timeout.
   */
  async pollExecutionId(dispatchId: string, timeoutMs = 300000): Promise<string | null> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 600));
      try {
        const r = await requestUrl({
          url: `${this.endpoint}/executions/${dispatchId}`,
          method: 'GET',
          headers: { 'Authorization': `ApiKey ${this.apiKey}` },
        });
        const body = r.json as Record<string, unknown>;
        if (body.executionId) return body.executionId as string;
        // status=failed without executionId means it crashed before starting
        if (body.status === 'failed') return null;
      } catch { /* ignore transient errors, keep polling */ }
    }
    return null;
  }

  async dispatchGoal(goal: string, ctx?: VaultContext): Promise<GoalDispatchResult> {
    // Build variables from the vault context snapshot.
    // expected_output_shapes hints to Thompson sampling which activities can
    // USE the obsidian shapes we're providing — biasing toward vault-aware ones.
    const variables: Record<string, unknown> = ctx ? { ...ctx } : {};
    const expectedOutputShapes = ctx?.available_shapes?.length
      ? ctx.available_shapes
      : undefined;

    const resp = await requestUrl({
      url: `${this.endpoint}/run-goal`,
      method: 'POST',
      headers: {
        'Authorization': `ApiKey ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        goal,
        variables,
        ...(expectedOutputShapes ? { expected_output_shapes: expectedOutputShapes } : {}),
      }),
    });
    const raw = resp.json as Record<string, unknown>;
    return {
      // goal-host-vessel returns dispatchId; fall back to executionId for older builds
      executionId: (raw.executionId ?? raw.dispatchId ?? '') as string,
      status: (raw.status ?? 'unknown') as string,
      selectedTemplateId: raw.selectedTemplateId as string | undefined,
    };
  }
}
