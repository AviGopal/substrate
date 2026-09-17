/**
 * Per-dispatch shape-vocabulary attribution.
 *
 * "What new shape did this run create" can only be answered honestly by
 * comparing the fleet's shape vocabulary AT DISPATCH TIME against what the
 * run touched — by the time a run is terminal and someone opens its detail
 * page, any shape it minted is already registered, so diffing against the
 * CURRENT vocabulary would always show nothing new. This module's only job is
 * to remember that baseline from the moment this browser tab dispatched the
 * run. Session-scoped by design: it captions a run this tab actually
 * dispatched, not a reconstruction of history for one it never saw start.
 */

const STORAGE_KEY = "dojo.dispatchVocabulary.v1";
const MAX_ENTRIES = 200;

interface StoredEntry {
  readonly dispatchId: string;
  readonly shapes: readonly string[];
}

function readAll(): StoredEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredEntry[]) : [];
  } catch {
    return [];
  }
}

function writeAll(entries: readonly StoredEntry[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* storage unavailable or full — attribution just degrades to "not recorded" */
  }
}

export function recordDispatchVocabulary(dispatchId: string, shapes: readonly string[]): void {
  const entries = readAll().filter((e) => e.dispatchId !== dispatchId);
  entries.push({ dispatchId, shapes });
  while (entries.length > MAX_ENTRIES) entries.shift(); // oldest first; cap so this never grows unbounded
  writeAll(entries);
}

/** `null` means "never recorded" — a distinct, honest answer from "recorded as empty". */
export function dispatchVocabularyOf(dispatchId: string): readonly string[] | null {
  const found = readAll().find((e) => e.dispatchId === dispatchId);
  return found ? found.shapes : null;
}

/**
 * Walk bookkeeping, not a producible shape. Every `goalDispatchAsync` walk
 * stamps its own `goal`/`dispatch_id`/`goal_answer` into the pool as a matter
 * of course — no vessel registers any of the three as something it serves, so
 * they never appear in `/api/discovery/shapes` REGARDLESS of what a run does.
 * Measured directly: a plain "reply with X" goal that minted nothing flagged
 * `dispatch_id` as "new" on every single dispatch, which would drown the one
 * signal this panel exists to show (a genuinely new capability shape) under a
 * constant, meaningless positive. Named explicitly rather than inferred (e.g.
 * "not in the registry" is also true of a real gap this feature should
 * surface) — this list grows only when another walk-plumbing name is caught
 * doing the same thing, never as a general noise filter.
 */
const WALK_BOOKKEEPING_SHAPES: ReadonlySet<string> = new Set(["goal", "dispatch_id", "goal_answer"]);

/** Shapes this run touched that were absent from the fleet's vocabulary when it was dispatched. */
export function newShapesFor(
  poolShapes: readonly string[],
  beforeVocabulary: readonly string[],
): readonly string[] {
  const before = new Set(beforeVocabulary);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const shape of poolShapes) {
    if (before.has(shape) || seen.has(shape) || WALK_BOOKKEEPING_SHAPES.has(shape)) continue;
    seen.add(shape);
    out.push(shape);
  }
  return out;
}
