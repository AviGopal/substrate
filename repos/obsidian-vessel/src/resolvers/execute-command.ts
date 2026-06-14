/**
 * Resolver — `obsidian:execute_command`.
 *
 * Executes a SINGLE Obsidian command by id and returns the observed effect
 * (pre/post state signature + reversibility class). This is the operational
 * command-dispatch surface — distinct from `obsidian:action_effect_model`,
 * which batch-probes the catalog to LEARN effects. This one ACTS.
 *
 * Defense in depth — this resolver is the in-process safety FLOOR; the
 * substrate's learned-prior gate (obsidian_command_gate) is the policy CEILING:
 *   - Hard deny-globs (app:*, workspace:quit, app:reload, ...) — always refused.
 *   - Heuristically soft/hard-irreversible commands (delete/trash/disable/
 *     uninstall/reset/...) refused unless `allow_irreversible: true`.
 *   - Everything else executes and its effect is captured.
 * The substrate restricts callers to LEARNED-reversible commands before this is
 * ever reached; this floor protects against a direct/un-gated caller too.
 *
 * Unlike the probe, this is NOT pinned to a probe vault — it operates whatever
 * vault the instance is open on. Safe because of the two filters above; the
 * substrate gate additionally refuses anything not proven reversible.
 */

import type { App } from 'obsidian';
import { registerResolver } from './index';
import type { ImpulsePointer, ResolverResult } from './types';
import { DEFAULT_PROBE_DENY_GLOBS, isCommandAllowedForProbe } from './observation-types';
import {
  captureSnapshot,
  signatureOf,
  classifyReversibility,
} from './probe-obsidian-action-effects';

const HARD_TIMEOUT_MS = 30_000;

interface ExecuteCommandPointer {
  command_id?: string;
  extra_deny_globs?: string[];
  allow_irreversible?: boolean;
  timeout_ms?: number;
}

function refuse(reason: string, commandId: string): ResolverResult {
  const err = new Error(`obsidian:execute_command refused — ${reason}`);
  (err as Error & { failure_mode?: unknown }).failure_mode = {
    type: 'verifier_negative',
    reason: 'safety_breach',
    validator_id: 'execute-command-safety-floor',
    failed_evidence: [{ check_id: 'execute-command-safety-floor', details: `${commandId}: ${reason}` }],
  };
  throw err;
}

async function resolveExecuteCommand(
  pointer: ImpulsePointer,
  app: App,
): Promise<ResolverResult> {
  const p = pointer as unknown as ExecuteCommandPointer;
  const commandId = p.command_id;
  if (!commandId) {
    throw new Error('obsidian:execute_command requires command_id');
  }

  const extraDeny = p.extra_deny_globs ?? [];
  // FLOOR 1 — deny-globs (destructive / system-state families).
  if (!isCommandAllowedForProbe(commandId, extraDeny)) {
    return refuse('matches a deny-glob (destructive/system command)', commandId);
  }
  // FLOOR 2 — heuristic irreversibility, unless explicitly overridden.
  const reversibility = classifyReversibility(commandId);
  if (
    !p.allow_irreversible &&
    (reversibility === 'soft_irreversible' || reversibility === 'hard_irreversible')
  ) {
    return refuse(`classified ${reversibility}; set allow_irreversible to override`, commandId);
  }

  // Command must exist in the catalog.
  const catalogue = (app as App).commands?.commands ?? {};
  if (!catalogue[commandId]) {
    throw new Error(`obsidian:execute_command: unknown command ${commandId}`);
  }

  const timeoutMs = Math.min(p.timeout_ms ?? HARD_TIMEOUT_MS, HARD_TIMEOUT_MS);
  const pre = signatureOf(captureSnapshot(app));
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.resolve().then(() => app.commands.executeCommandById(commandId)),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('execute-command-timeout')), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
  const post = signatureOf(captureSnapshot(app));

  return {
    content: JSON.stringify({
      shape: 'obsidian:execute_command',
      command_id: commandId,
      executed: true,
      pre_signature: pre,
      post_signature: post,
      changed: pre !== post,
      reversibility_class: reversibility,
    }),
    metadata: {
      shape: 'obsidian:execute_command',
      summary: `executed ${commandId} (${reversibility}); state ${pre !== post ? 'changed' : 'unchanged'}`,
      rowCount: 1,
      availableOps: [],
    },
  };
}

registerResolver('obsidian:execute_command', resolveExecuteCommand);
