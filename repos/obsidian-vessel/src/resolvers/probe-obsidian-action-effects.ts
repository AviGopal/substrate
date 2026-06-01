/**
 * Resolver — `obsidian:action_effect_model`.
 *
 * Iterates the Obsidian command catalogue and, for each command that
 * survives the deny-glob filter, dispatches it against the configured
 * probe vault. Pre/post state observations are reduced to compact
 * signatures (active-leaf snapshot + sha256 of the sorted vault
 * file-path list); the resulting `(pre, post)` triple feeds a per-
 * command probability distribution over post-signatures.
 *
 * Safety:
 *   - REFUSES to dispatch when the active vault path differs from the
 *     caller-supplied `probe_vault_path`. The probe is never run
 *     against the operator's day-to-day vault.
 *   - Hard limits: `max_commands ≤ 10`, `per_command_timeout_ms ≤ 30_000`.
 *   - Built-in deny globs cover the destructive / system-state command
 *     namespaces (`app:*`, `editor:focus`, `daily-notes:*`, ...).
 *
 * Spec:
 *   openspec/changes/2026-06-01-obsidian-observe-and-experiment/
 *     specs/obsidian-observation-layer/spec.md
 *     §"actionEffectModel impulse shape contract"
 *     §"probe-obsidian-action-effects activity contract"
 */

import type { App, TFile } from 'obsidian';
import { registerResolver } from './index';
import type { ImpulsePointer, ResolverResult } from './types';
import {
  ActionEffectModel,
  DEFAULT_PROBE_DENY_GLOBS,
  ProbeActionEffectsPointer,
  ReversibilityClass,
  isCommandAllowedForProbe,
} from './observation-types';
import { sha256Hex } from './observation-hash';

const HARD_MAX_COMMANDS = 10;
const HARD_MAX_TIMEOUT_MS = 30_000;
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Heuristic reversibility classification. The result feeds the seed
 * corpus for a later learned classifier; it is intentionally
 * conservative — when in doubt, return `unknown`.
 */
export function classifyReversibility(commandId: string): ReversibilityClass {
  if (/(^|:)delete(-|$)|trash|remove/i.test(commandId)) return 'soft_irreversible';
  if (/(^|:)edit|toggle|insert|paste|cut/i.test(commandId)) return 'reversible';
  if (/disable|uninstall|reset/i.test(commandId)) return 'hard_irreversible';
  return 'unknown';
}

/**
 * Snapshot of vault + workspace state used to compute pre/post
 * signatures. Exported so tests can build fixtures without an Obsidian
 * runtime.
 */
export interface VaultStateSnapshot {
  activeFilePath: string | null;
  filePaths: string[];
}

export function captureSnapshot(app: App): VaultStateSnapshot {
  const active = app.workspace.getActiveFile();
  const allFiles = app.vault.getFiles().map((f: TFile) => f.path);
  allFiles.sort();
  return {
    activeFilePath: active ? active.path : null,
    filePaths: allFiles,
  };
}

export function signatureOf(snapshot: VaultStateSnapshot): string {
  const serialised = JSON.stringify(snapshot);
  return sha256Hex(serialised);
}

/**
 * Reduce a list of `(pre, post)` triples into a single
 * `actionEffectModel` for the named command. Exported for the unit
 * tests.
 */
export function accumulateModel(
  commandId: string,
  triples: Array<{ pre_signature: string; post_signature: string }>,
): ActionEffectModel {
  const counts = new Map<string, number>();
  for (const t of triples) {
    counts.set(t.post_signature, (counts.get(t.post_signature) ?? 0) + 1);
  }
  const total = triples.length;
  const distribution = Array.from(counts.entries())
    .map(([post_signature, n]) => ({ post_signature, probability: n / total }))
    .sort((a, b) => b.probability - a.probability);

  // Re-normalise to guarantee the spec's ±1e-6 tolerance even under
  // rounding drift across many entries.
  const sum = distribution.reduce((s, d) => s + d.probability, 0);
  if (sum > 0 && Math.abs(sum - 1) > 1e-9) {
    for (const d of distribution) d.probability /= sum;
  }

  return {
    shape: 'obsidian:action_effect_model',
    command_id: commandId,
    observation_count: total,
    post_signature_distribution: distribution,
    reversibility_class: classifyReversibility(commandId),
    bridge_eligibility: 'allow',
  };
}

/**
 * Run with a hard timeout. Bun and Obsidian both expose `setTimeout`.
 * On timeout we return the rejection value rather than rethrow so the
 * outer loop can keep probing the next command.
 */
async function withTimeout<T>(p: Promise<T>, ms: number, tag: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`probe-${tag}-timeout`)), ms);
  });
  try {
    return await Promise.race([p, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Verify the active vault path matches the supplied probe path. We
 * compare against `app.vault.adapter.basePath` (the FileSystemAdapter
 * convention used elsewhere in this vessel for vault identification).
 */
function assertProbeVault(app: App, probePath: string): void {
  const adapter = app.vault.adapter as { basePath?: string };
  const vaultPath = adapter.basePath ?? '';
  if (!vaultPath) {
    throw new Error('probe-obsidian-action-effects: cannot determine active vault path');
  }
  if (vaultPath !== probePath) {
    const err = new Error(
      `probe-obsidian-action-effects: refusing to dispatch — active vault ${vaultPath} ≠ probe vault ${probePath}`,
    );
    (err as Error & { failure_mode?: unknown }).failure_mode = {
      type: 'verifier_negative',
      reason: 'safety_breach',
      validator_id: 'probe-vault-match',
      failed_evidence: [{ check_id: 'probe-vault-match', details: 'active vault path mismatch' }],
    };
    throw err;
  }
}

async function resolveProbeActionEffects(
  pointer: ImpulsePointer,
  app: App,
): Promise<ResolverResult> {
  const p = pointer as unknown as ProbeActionEffectsPointer;
  if (!p.probe_vault_path) {
    throw new Error('obsidian:action_effect_model requires probe_vault_path');
  }
  assertProbeVault(app, p.probe_vault_path);

  const maxCommands = Math.min(p.max_commands ?? HARD_MAX_COMMANDS, HARD_MAX_COMMANDS);
  const timeoutMs = Math.min(
    p.per_command_timeout_ms ?? DEFAULT_TIMEOUT_MS,
    HARD_MAX_TIMEOUT_MS,
  );
  const extraDeny = p.extra_deny_globs ?? [];

  const catalogue = (app as App).commands?.commands ?? {};
  const commandIds = Object.keys(catalogue)
    .filter((id) => isCommandAllowedForProbe(id, extraDeny))
    .slice(0, maxCommands);

  const models: ActionEffectModel[] = [];
  for (const commandId of commandIds) {
    try {
      const pre = signatureOf(captureSnapshot(app));
      const dispatched = withTimeout(
        Promise.resolve().then(() => app.commands.executeCommandById(commandId)),
        timeoutMs,
        commandId,
      );
      await dispatched;
      const post = signatureOf(captureSnapshot(app));
      models.push(accumulateModel(commandId, [{ pre_signature: pre, post_signature: post }]));
    } catch (err) {
      console.warn(`[probe-obsidian-action-effects] ${commandId}:`, err);
      // Skip — failure of one command must not poison the catalogue.
    }
  }

  return {
    content: JSON.stringify({ models }, null, 2),
    metadata: {
      shape: 'obsidian:action_effect_model',
      summary: `${models.length} command(s) probed (deny=${DEFAULT_PROBE_DENY_GLOBS.length + extraDeny.length} patterns)`,
      rowCount: models.length,
      availableOps: ['classify-reversibility'],
    },
  };
}

registerResolver('obsidian:action_effect_model', resolveProbeActionEffects);
