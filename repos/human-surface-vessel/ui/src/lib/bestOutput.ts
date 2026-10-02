/**
 * The best output a run that did not reach produced — chosen deterministically,
 * never by a model, and always labelled for what it is.
 *
 * A run that does not reach has no `answerBody` (goal-host builds one only on
 * reach), so before this the run view showed a verdict and a trace and nothing
 * a person could read. The output usually existed: a sourced, correctly dated
 * news report was produced and rejected twice in one dispatch, and survived
 * only as a 400-character walk-log excerpt.
 *
 * Choice, in order:
 *   1. the attempt the dispatch REPORTS (its verdict is the run's reason), else
 *      the latest attempt with something to show;
 *   2. within it, an answer-like shape over evidence, then the longest;
 *   3. the longest copy available of that output — this browser's copy of the
 *      attempt's pool preview (up to 2,000 chars) beats the walk-log excerpt;
 *   4. with no judged output anywhere, the current pool's best preview.
 * Bookkeeping shapes, unfilled templates and refusals are never chosen.
 *
 * The result always says how much of the output is shown, because the server
 * keeps less than was produced and the reader must not mistake an excerpt for
 * the whole.
 */

import type { GoalWalkState, RawProvenance } from "../api/types";
import type { AttemptSegment } from "./attempts";
import { normalizeProvenance } from "./ledger";

export type BestOutputSource = "walk_log_excerpt" | "browser_copy" | "pool_preview";

export interface BestOutput {
  readonly shape: string;
  /** Readable text: the envelope's content when it had one, the excerpt otherwise. */
  readonly text: string;
  /** Characters the output had; the text shown can be far shorter. */
  readonly totalChars: number;
  /** The shown text is a prefix of the output, not all of it. */
  readonly cut: boolean;
  readonly source: BestOutputSource;
  /** 1-based attempt the output came from; null when the attempts are unknown. */
  readonly attempt: number | null;
  readonly attempts: number;
  /** The judge's rejection of that attempt, when it survives. */
  readonly verdict: string | null;
}

/** Shapes that are bookkeeping, not output a person asked for. */
const NOT_OUTPUT: ReadonlySet<string> = new Set([
  "activity_template",
  "error",
  "dispatch_id",
  "filePaths",
  "goal",
  "probe_tag",
  "test_suite",
]);

/** Evidence the answer should be built from; shown only when nothing answer-like exists. */
const EVIDENCE: ReadonlySet<string> = new Set([
  "web_search",
  "webSearchResult",
  "web_resource",
  "http_fetch",
  "shellResult",
  "fileContent",
  "source_code",
]);

/** A template the writer was asked to fill and did not. */
const PLACEHOLDER = /\[(?:current date|date|brief|insert|source|headline|summary|commentary)[^\]]*\]|\bheadline [0-9]\b/i;
/** The output declines rather than answers. */
const REFUSAL = /^\s*(?:i(?:'| a)m sorry|i can(?:not|'t)|unfortunately,? i|as an ai)/i;

/** Keys whose string value is the output inside a resolver envelope. */
const TEXT_KEYS = ["content", "text", "output", "stdout", "answer", "body"] as const;

/**
 * An envelope's text, whole or cut. `{"resolved":true,"shape":"llmCompletion",
 * "content":"Today's date: …` — scalar members first, then a text member whose
 * string may run past the end of what was logged.
 */
const ENVELOPE_TEXT_START = new RegExp(
  String.raw`^\s*\{\s*(?:"[A-Za-z_][A-Za-z0-9_]*"\s*:\s*(?:"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?|true|false|null)\s*,\s*)*"(` +
    TEXT_KEYS.join("|") +
    String.raw`)"\s*:\s*"`,
);

function decodeStringBody(raw: string): { text: string; closed: boolean } {
  let out = "";
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i] as string;
    if (c === '"') return { text: out, closed: true };
    if (c !== "\\") {
      out += c;
      continue;
    }
    const n = raw[++i];
    if (n === undefined) break; // the cut landed mid-escape
    if (n === "n") out += "\n";
    else if (n === "t") out += "\t";
    else if (n === "r") out += "\r";
    else if (n === "u") {
      const hex = raw.slice(i + 1, i + 5);
      if (!/^[0-9a-fA-F]{4}$/.test(hex)) break;
      out += String.fromCharCode(parseInt(hex, 16));
      i += 4;
    } else out += n; // \" \\ \/ and the rest
  }
  return { text: out, closed: false };
}

/** The readable text of an output preview, and whether it is a prefix only. */
export function readableText(preview: string): { text: string; cut: boolean } {
  const whole = preview.trim();
  if (whole.startsWith("{")) {
    try {
      const parsed = JSON.parse(whole) as Record<string, unknown>;
      for (const k of TEXT_KEYS) {
        const v = parsed[k];
        if (typeof v === "string" && v.trim()) return { text: v, cut: false };
      }
      const body = parsed["body"];
      if (body && typeof body === "object") return { text: JSON.stringify(body, null, 2), cut: false };
    } catch {
      const m = ENVELOPE_TEXT_START.exec(whole);
      if (m) {
        const { text, closed } = decodeStringBody(whole.slice(m[0].length));
        if (text.trim()) return { text, cut: !closed };
      }
      return { text: whole, cut: true };
    }
  }
  // Plain text. goal-host prefixes some excerpts with a bare type word.
  return { text: whole.replace(/^text\n/, ""), cut: false };
}

function usable(shape: string, text: string): boolean {
  if (NOT_OUTPUT.has(shape)) return false;
  const t = text.trim();
  if (t.length === 0) return false;
  if (PLACEHOLDER.test(t)) return false;
  if (REFUSAL.test(t)) return false;
  return true;
}

interface Candidate {
  readonly shape: string;
  readonly text: string;
  readonly totalChars: number;
  readonly cut: boolean;
  readonly source: BestOutputSource;
}

function rank(c: Candidate): number {
  return EVIDENCE.has(c.shape) ? 0 : 1;
}

function better(a: Candidate, b: Candidate): Candidate {
  if (rank(a) !== rank(b)) return rank(a) > rank(b) ? a : b;
  return b.totalChars > a.totalChars ? b : a;
}

function fromPreview(raw: RawProvenance, source: BestOutputSource): Candidate | null {
  const e = normalizeProvenance(raw);
  if (!e || e.kind !== "content") return null;
  const r = readableText(e.preview);
  if (!usable(e.shape, r.text)) return null;
  return { shape: e.shape, text: r.text, totalChars: e.chars, cut: r.cut || e.truncated, source };
}

function fromSegment(seg: AttemptSegment): Candidate | null {
  let best: Candidate | null = null;
  for (const j of seg.judged) {
    const r = readableText(j.excerpt);
    if (!usable(j.shape, r.text)) continue;
    let c: Candidate = {
      shape: j.shape,
      text: r.text,
      totalChars: Math.max(j.chars, r.text.length),
      // An excerpt shorter than the output is a prefix, whatever the envelope says.
      cut: r.cut || j.chars > j.excerpt.length,
      source: "walk_log_excerpt",
    };
    // A longer copy of the same output that this browser saw beats the excerpt.
    for (const p of seg.provenance ?? []) {
      const longer = fromPreview(p, "browser_copy");
      if (longer && longer.shape === c.shape && longer.text.length > c.text.length) {
        c = { ...longer, totalChars: Math.max(longer.totalChars, c.totalChars) };
      }
    }
    best = best ? better(best, c) : c;
  }
  return best;
}

export function pickBestOutput(walk: GoalWalkState, segments: readonly AttemptSegment[]): BestOutput | null {
  const attempts = segments.length;
  const order = [
    ...segments.filter((s) => s.reported),
    ...[...segments].reverse().filter((s) => !s.reported),
  ];
  for (const seg of order) {
    const c = fromSegment(seg);
    if (c) return { ...c, attempt: seg.number, attempts, verdict: seg.verdict };
  }
  // Nothing was judged: the pool as it stands — but only what a step PRODUCED.
  // Every walk seeds its variables (`seed var operator`, `seed var rhythm_id`, …)
  // into the same pool, and those are the request, not output.
  const seeded = new Set(
    walk.poolEvents
      .filter((e) => e.shape === "goal" || (typeof e.source === "string" && e.source.startsWith("seed var ")))
      .map((e) => e.shape),
  );
  const produced = new Set(walk.poolEvents.filter((e) => !seeded.has(e.shape)).map((e) => e.shape));
  let best: Candidate | null = null;
  for (const p of walk.poolProvenance) {
    const shape = typeof p.shape === "string" ? p.shape : "";
    if (seeded.has(shape) || (walk.poolEvents.length > 0 && !produced.has(shape))) continue;
    const c = fromPreview(p, "pool_preview");
    if (c) best = best ? better(best, c) : c;
  }
  if (!best) return null;
  const current = segments.find((s) => s.current) ?? null;
  return { ...best, attempt: current?.number ?? null, attempts, verdict: current?.verdict ?? null };
}
