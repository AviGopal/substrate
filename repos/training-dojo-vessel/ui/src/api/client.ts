/**
 * Every call in this file is same-origin and relative. There is no configurable
 * base URL and no environment variable naming a host, on purpose:
 *
 *  - goal-host has NO CORS and NO inbound auth. A browser cannot call it, and
 *    if it could, the API key would have to be in the bundle. This vessel's own
 *    server is the security boundary; it holds the key and this code never sees
 *    one.
 *  - An absolute URL here would also be a rule P12 violation the moment it is
 *    bundled.
 */

import type {
  ActiveDispatch,
  Book,
  BookStep,
  BookStepKind,
  BookSummary,
  DbTarget,
  DispatchOutcome,
  DispatchRequest,
  FleetShapes,
  GoalWalkState,
  GradeSubmission,
  InterfaceGap,
  SchemaSnapshot,
  SchemaSnapshotDiff,
  ShapeRegistryLeg,
  SolicitationOutcome,
  TableRowsResult,
  TestNote,
  UnparsedClause,
} from "./types";

export class SurfaceError extends Error {
  readonly httpStatus: number;
  constructor(message: string, httpStatus: number) {
    super(message);
    this.name = "SurfaceError";
    this.httpStatus = httpStatus;
  }
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    // A proxy that fell over can answer HTML. Say so rather than rendering
    // "undefined" into a failure slot.
    return { error: text.slice(0, 400) };
  }
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * Normalize the `unparsed` array off the wire.
 *
 * Tolerates a bare string as well as the record, because an older vessel on the
 * other end of this proxy sends strings — and a surface that renders nothing at
 * all when a clause was refused is worse than one that renders the clause with
 * no reason attached.
 */
function asClauses(raw: unknown): readonly UnparsedClause[] {
  if (!Array.isArray(raw)) return [];
  const out: UnparsedClause[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      out.push({ text: item, reason: "", suggestedGoal: "" });
      continue;
    }
    if (typeof item !== "object" || item === null) continue;
    const rec = item as Record<string, unknown>;
    const text = str(rec["text"]);
    if (!text) continue;
    out.push({
      text,
      reason: str(rec["reason"]) ?? "",
      suggestedGoal: str(rec["suggested_goal"]) ?? "",
    });
  }
  return out;
}

/* ────────────────────────────── dispatch ─────────────────────────────────── */

/**
 * `POST /api/run-goal`.
 *
 * Returns a discriminated outcome rather than throwing, because three of the
 * four responses are things the reader needs told honestly — a coalesced
 * dispatch is somebody ELSE'S older run and claiming credit for it is a lie; a
 * refusal is terminal and arrives as 200; a drain is temporary and retryable.
 */
/**
 * An instruction about the SURFACE is tried against the surface first.
 *
 * Order matters and is deliberate. The parser is a deterministic, closed set of
 * rules; it either understands an instruction or refuses it, cheaply and
 * without an LLM. Only what it refuses becomes a goal. That is the floor-first
 * arrangement the substrate asks for everywhere else — the LLM is one resolver
 * among many, never the controller — applied to the surface's own controls.
 *
 * A refusal here is NOT an error: it means "this was not about me", and the
 * instruction goes to the walk unchanged. Anything the parser understood only
 * PARTLY is reported with the clause it dropped, because silently applying half
 * an instruction is worse than applying none.
 */
async function trySurfaceIntent(instruction: string): Promise<DispatchOutcome | null> {
  let res: Response;
  try {
    res = await fetch("/api/surface-intent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ instruction }),
    });
  } catch {
    // The surface being unreachable must not swallow the instruction; let the
    // normal dispatch path run and report its own failure honestly.
    return null;
  }
  if (res.status === 422) return null; // not about the surface — send it to the walk
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as null | {
    applied?: boolean;
    changes?: Array<{ field?: string; from?: string; to?: string; because?: string }>;
    unparsed?: string[];
    policy?: { revision?: number };
  };
  if (!body || body.applied !== true) return null;
  return {
    kind: "reshaped",
    changes: (body.changes ?? []).map((c) => ({
      field: String(c.field ?? ""),
      from: String(c.from ?? ""),
      to: String(c.to ?? ""),
      because: String(c.because ?? ""),
    })),
    // Read the clause RECORD. The wire has always carried {text, reason,
    // suggested_goal} on both the 200 and the 422 branch; this used to be
    // `.map(String)`, which turned each one into the literal `[object Object]`
    // and discarded the only two fields that tell a person what to do next.
    unparsed: asClauses(body.unparsed),
    revision: typeof body.policy?.revision === "number" ? body.policy.revision : -1,
  };
}

/**
 * `checkSurfaceIntent`: default true for the live ask box, where a human
 * typing casual English MIGHT mean a UI command ("make the text bigger").
 * A lessonbook step is pre-authored curriculum text, never a person steering
 * this surface — and the parser's own word-level matching cannot tell "a
 * SMALL online shop" (a step about database design) from "make the text
 * smaller" (an actual UI instruction). Skipping the check for a source that
 * was never going to mean the second thing is the fix; loosening the parser
 * itself would just make it worse at the thing it exists for.
 */
export async function dispatchGoal(
  req: DispatchRequest,
  opts: { checkSurfaceIntent?: boolean } = {},
): Promise<DispatchOutcome> {
  const reshaped = opts.checkSurfaceIntent !== false ? await trySurfaceIntent(req.goal) : null;
  if (reshaped) return reshaped;

  const res = await fetch("/api/run-goal", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(req),
  });
  const body = await readJson(res);

  // Branch on the flag, NOT on the status code: a refusal is 200 and an
  // acceptance is 202, so `res.ok` is true for both and tells you nothing.
  if (body.refused === true) {
    return {
      kind: "refused",
      dispatchId: str(body.dispatchId) ?? "",
      reason: str(body.goalReachReason),
    };
  }
  if (body.draining === true || res.status === 503) {
    return { kind: "draining", message: str(body.error) ?? "the dispatcher is draining" };
  }
  const dispatchId = str(body.dispatchId);
  if (res.ok && dispatchId) {
    return { kind: "accepted", dispatchId, coalesced: body.coalesced === true };
  }
  return {
    kind: "rejected",
    message: str(body.error) ?? `dispatch failed (HTTP ${res.status})`,
    httpStatus: res.status,
  };
}

/* ────────────────────────────── resolve ──────────────────────────────────── */

async function resolveShape<T>(payload: Record<string, unknown>): Promise<T> {
  const res = await fetch("/api/resolve", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload),
  });
  const body = await readJson(res);
  if (!res.ok || body.resolved !== true) {
    throw new SurfaceError(str(body.error) ?? `resolve failed (HTTP ${res.status})`, res.status);
  }
  return body.body as T;
}

export function fetchWalkState(dispatchId: string): Promise<GoalWalkState> {
  return resolveShape<GoalWalkState>({ type: "goalWalkState", dispatchId });
}

export async function fetchActiveDispatches(): Promise<readonly ActiveDispatch[]> {
  const body = await resolveShape<{ dispatches?: readonly ActiveDispatch[] }>({
    type: "activeDispatches",
  });
  return Array.isArray(body?.dispatches) ? body.dispatches : [];
}

/** Answer a mid-walk question in place. */
export function answerSolicitation(args: {
  solicitationId: string;
  outcome: SolicitationOutcome;
  answer: string;
}): Promise<unknown> {
  return resolveShape({
    type: "solicitationResponse_write",
    solicitationId: args.solicitationId,
    outcome: args.outcome,
    answer: args.answer,
  });
}

/**
 * The salvage path: push context into a walk that is already running rather
 * than killing it and re-typing the goal. 409 when the dispatch is no longer
 * running — that is a real answer, not a bug, and is surfaced as one.
 */
export function injectContext(args: {
  dispatchId: string;
  shape: string;
  content: string;
  summary?: string;
}): Promise<unknown> {
  return resolveShape({ type: "poolImpulse_write", ...args });
}

/* ────────────────────────────── discovery ────────────────────────────────── */

/**
 * The fleet's shape vocabulary. Starters are derived from THIS, at render time.
 * There is no hardcoded starter list anywhere in this surface: a fixed list
 * goes stale silently and starts advertising capabilities the fleet no longer
 * has.
 *
 * PROXY ROUTE: `GET /api/discovery/shapes`, unioning local discovery's
 * `GET /registry/shapes` with the hub's (when this substrate is a federated
 * spoke) → `{ shapes: string[], registries: [{registry, ok, count}] }`.
 *
 * `registries` is not decoration: it is the only way to tell "the fleet
 * genuinely has nothing to suggest" from "the hub leg could not be read, so
 * you are looking at this substrate's own plumbing." Dropping it here would
 * throw away exactly the distinction the server computed it to preserve.
 */
function asRegistries(raw: unknown): readonly ShapeRegistryLeg[] {
  if (!Array.isArray(raw)) return [];
  const out: ShapeRegistryLeg[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const r = item as Record<string, unknown>;
    if (typeof r.registry !== "string") continue;
    out.push({
      registry: r.registry,
      ok: r.ok === true,
      count: typeof r.count === "number" ? r.count : 0,
    });
  }
  return out;
}

export async function fetchFleetShapes(): Promise<FleetShapes> {
  const res = await fetch("/api/discovery/shapes", { credentials: "same-origin" });
  if (!res.ok) throw new SurfaceError(`shape list unavailable (HTTP ${res.status})`, res.status);
  const body = await readJson(res);
  return {
    shapes: Array.isArray(body.shapes) ? (body.shapes.filter((s) => typeof s === "string") as string[]) : [],
    registries: asRegistries(body.registries),
  };
}

/**
 * Does anything actually serve this shape? Used to REFINE starters after they
 * have already rendered — never to gate the first paint. A surface that waits
 * on N capability lookups before showing a single suggestion has reproduced the
 * blank box it exists to remove.
 */
export async function fetchCapability(shape: string): Promise<boolean> {
  const res = await fetch("/api/discovery/resolve", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ pointer: { type: "vesselCapability", shape } }),
  });
  if (!res.ok) return false;
  const body = await readJson(res);
  const inner = (body.body ?? body) as Record<string, unknown>;
  const producers = inner.producers ?? inner.vessels ?? inner.providers;
  if (Array.isArray(producers)) return producers.length > 0;
  return body.resolved === true;
}

/* ──────────────────────────────── grading ────────────────────────────────── */

/**
 * A human verdict into the oracle corpus.
 *
 * CONTRACT NOTE — this is the one route in this file that is not in the
 * verified proxy set. A human grade is NOT a goal-host shape: goal-host's
 * served-shape list does not include `goal_verification_label_write`, and
 * posting it to `/api/resolve` would be rejected. The real channel is
 * activity-api's impulse resolve, which goal-host itself writes to when it
 * records a machine verdict.
 *
 * The server side must therefore expose `POST /api/grade` forwarding to
 * activity-api with:
 *
 *   { pointer: { type: "goal_verification_label_write",
 *                goal, execution_id, activity_id: "unattributed",
 *                verdict, confidence: 1, labeler: "human", notes } }
 *
 * `labeler: "human"` is load-bearing — goal-host only lets a HUMAN verdict
 * override `reached`, and only a human label burns the consumption latch.
 *
 * If the route is absent this throws and the UI says so. It does not render a
 * green tick over a verdict that went nowhere.
 */
export async function submitGrade(g: GradeSubmission): Promise<void> {
  const res = await fetch("/api/grade", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      execution_id: g.executionId,
      goal: g.goal,
      verdict: g.verdict,
      // A human verdict is the ground truth this corpus is FOR, so it carries
      // full confidence. Omitting the field sent `confidence: null` through the
      // proxy and the trace store rejected it — "Found NULL for field
      // `confidence` … but expected a float" — so every verdict a person
      // submitted 500'd and never reached the corpus. The doc comment above this
      // function has always specified `confidence: 1`; the body did not send it.
      confidence: 1,
      labeler: "human",
      notes: g.notes,
    }),
  });
  if (!res.ok) {
    const body = await readJson(res);
    throw new SurfaceError(
      str(body.error) ?? `the verdict was not recorded (HTTP ${res.status})`,
      res.status,
    );
  }
}


/* ────────────────────────── render policy ────────────────────────────────── */

export interface RenderPolicy {
  readonly tokenOverrides: Readonly<Record<string, string>>;
  readonly formByShape: Readonly<Record<string, string>>;
  readonly maxPreviewChars: number | null;
  readonly ledgerDefaultExpanded: boolean;
  readonly revision: number;
  readonly updatedAt: number;
  readonly note: string | null;
}

/**
 * The behaviour impulse the surface renders by. Fetched on the live cadence,
 * not at startup — a policy read once at boot would be a constant again.
 */
export async function fetchRenderPolicy(): Promise<RenderPolicy> {
  const res = await fetch("/api/render-policy", { credentials: "same-origin" });
  if (!res.ok) throw new Error(`render policy unavailable (${res.status})`);
  return (await res.json()) as RenderPolicy;
}

/* ────────────────────────── interface gaps ───────────────────────────────── */

export async function fetchGaps(): Promise<readonly InterfaceGap[]> {
  const res = await fetch("/api/gaps", { credentials: "same-origin" });
  if (!res.ok) throw new Error(`gap store unavailable (${res.status})`);
  const j = (await res.json()) as { gaps?: InterfaceGap[] };
  return j.gaps ?? [];
}

/* ────────────────────────── schema watch ──────────────────────────────────
 *
 * PROXY ROUTES: `GET /api/schema/latest`, `GET /api/schema/diffs`,
 * `POST /api/schema/scan-now` (see `src/routes/proxy.ts`) — all three
 * discovery-route to activity-api's `db_admin` resolver server-side, the same
 * way `/api/gaps` discovery-routes to `substrateGap`. Absent that capability
 * (not yet landed there as of this vessel's first build), these 502/404 and
 * the Tables/Diff-history pages say so rather than fabricating a snapshot.
 */

/** Which databases Tables/Diff-history/Table Explorer can point at (`GET /api/schema/targets`). */
export async function fetchDbTargets(): Promise<readonly DbTarget[]> {
  const res = await fetch("/api/schema/targets", { credentials: "same-origin" });
  if (!res.ok) throw new SurfaceError(`target list unavailable (HTTP ${res.status})`, res.status);
  const body = await readJson(res);
  return Array.isArray(body.targets) ? (body.targets as DbTarget[]) : [];
}

export async function fetchSchemaSnapshot(targetKey?: string): Promise<SchemaSnapshot | null> {
  const qs = targetKey ? `?target=${encodeURIComponent(targetKey)}` : "";
  const res = await fetch(`/api/schema/latest${qs}`, { credentials: "same-origin" });
  if (res.status === 404) return null; // no snapshot has ever been taken — not an error
  if (!res.ok) {
    const body = await readJson(res);
    throw new SurfaceError(str(body.error) ?? `schema snapshot unavailable (HTTP ${res.status})`, res.status);
  }
  const body = await readJson(res);
  return (body.snapshot ?? null) as SchemaSnapshot | null;
}

export async function fetchSchemaDiffs(targetKey?: string, limit = 50): Promise<readonly SchemaSnapshotDiff[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (targetKey) params.set("target", targetKey);
  const res = await fetch(`/api/schema/diffs?${params.toString()}`, { credentials: "same-origin" });
  if (!res.ok) {
    const body = await readJson(res);
    throw new SurfaceError(str(body.error) ?? `schema diff history unavailable (HTTP ${res.status})`, res.status);
  }
  const body = await readJson(res);
  return Array.isArray(body.diffs) ? (body.diffs as SchemaSnapshotDiff[]) : [];
}

/**
 * Starts a scan; does NOT wait for it to finish — a cold first scan runs
 * well past any reasonable request timeout (measured ~36s for just two of
 * this hub's largest tables). The caller polls `fetchSchemaSnapshot` for the
 * result instead of awaiting one here (see `useScanNow`'s `scanning` flag).
 */
export async function scanSchemaNow(targetKey?: string): Promise<{ status: "started" | "already_scanning" }> {
  const res = await fetch("/api/schema/scan-now", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ target: targetKey }),
  });
  const body = await readJson(res);
  if (!res.ok) {
    throw new SurfaceError(str(body.error) ?? `scan failed (HTTP ${res.status})`, res.status);
  }
  return body as { status: "started" | "already_scanning" };
}

/* ────────────────────────────── lessonbook ─────────────────────────────────
 *
 * PROXY ROUTES: `src/routes/lessonbook.ts` — plain CRUD over this vessel's own
 * curriculum store. None of these dispatch a goal; `dispatchGoal` above is
 * still the only thing that does, same call a step's "Send" button makes.
 */

export async function fetchBooks(): Promise<readonly BookSummary[]> {
  const res = await fetch("/api/lessonbook/books", { credentials: "same-origin" });
  if (!res.ok) throw new SurfaceError(`the bookshelf is unavailable (HTTP ${res.status})`, res.status);
  const body = await readJson(res);
  return Array.isArray(body.books) ? (body.books as BookSummary[]) : [];
}

export async function fetchBook(bookId: string): Promise<Book> {
  const res = await fetch(`/api/lessonbook/books/${encodeURIComponent(bookId)}`, { credentials: "same-origin" });
  if (!res.ok) {
    const body = await readJson(res);
    throw new SurfaceError(str(body.error) ?? `book unavailable (HTTP ${res.status})`, res.status);
  }
  const body = await readJson(res);
  return body.book as Book;
}

export async function createBook(args: { title: string; topic: string; description: string }): Promise<Book> {
  const res = await fetch("/api/lessonbook/books", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(args),
  });
  const body = await readJson(res);
  if (!res.ok) throw new SurfaceError(str(body.error) ?? `the book was not created (HTTP ${res.status})`, res.status);
  return body.book as Book;
}

export async function deleteBook(bookId: string): Promise<void> {
  const res = await fetch(`/api/lessonbook/books/${encodeURIComponent(bookId)}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (!res.ok) throw new SurfaceError(`the book was not deleted (HTTP ${res.status})`, res.status);
}

export async function addBookStep(
  bookId: string,
  prompt: string,
  opts: { kind?: BookStepKind; afterStepId?: string } = {},
): Promise<BookStep> {
  const res = await fetch(`/api/lessonbook/books/${encodeURIComponent(bookId)}/steps`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ prompt, ...opts }),
  });
  const body = await readJson(res);
  if (!res.ok) throw new SurfaceError(str(body.error) ?? `the step was not added (HTTP ${res.status})`, res.status);
  return body.step as BookStep;
}

/** A remedial example, added right after the test it is meant to fix. */
export async function addSublesson(testStepId: string, bookId: string, prompt: string): Promise<BookStep> {
  const res = await fetch(`/api/lessonbook/steps/${encodeURIComponent(testStepId)}/sublesson`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ bookId, prompt }),
  });
  const body = await readJson(res);
  if (!res.ok) throw new SurfaceError(str(body.error) ?? `the sublesson was not added (HTTP ${res.status})`, res.status);
  return body.step as BookStep;
}

export async function deleteBookStep(stepId: string): Promise<void> {
  const res = await fetch(`/api/lessonbook/steps/${encodeURIComponent(stepId)}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (!res.ok) throw new SurfaceError(`the step was not deleted (HTTP ${res.status})`, res.status);
}

/** The browser records the outcome it already polled — this never asks goal-host anything itself. */
export async function recordBookStepRun(
  stepId: string,
  args: { dispatchId: string; status: "running" | "completed" | "failed"; reached: boolean | null; reason?: string | null },
): Promise<BookStep> {
  const res = await fetch(`/api/lessonbook/steps/${encodeURIComponent(stepId)}/run`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new SurfaceError(`the run outcome was not recorded (HTTP ${res.status})`, res.status);
  const body = (await res.json()) as { step: BookStep };
  return body.step;
}

export async function resetBookStepRun(stepId: string): Promise<void> {
  const res = await fetch(`/api/lessonbook/steps/${encodeURIComponent(stepId)}/reset`, {
    method: "POST",
    credentials: "same-origin",
  });
  if (!res.ok) throw new SurfaceError(`the step was not reset (HTTP ${res.status})`, res.status);
}

export async function resetBookRuns(bookId: string): Promise<void> {
  const res = await fetch(`/api/lessonbook/books/${encodeURIComponent(bookId)}/reset`, {
    method: "POST",
    credentials: "same-origin",
  });
  if (!res.ok) throw new SurfaceError(`the book was not reset (HTTP ${res.status})`, res.status);
}

/** Retrofit unit tests every 5 lessons, or fill a gap opened up by lessons added since. */
export async function autotestBook(bookId: string): Promise<{ inserted: number }> {
  const res = await fetch(`/api/lessonbook/books/${encodeURIComponent(bookId)}/autotest`, {
    method: "POST",
    credentials: "same-origin",
  });
  if (!res.ok) throw new SurfaceError(`tests were not added (HTTP ${res.status})`, res.status);
  return (await readJson(res)) as { inserted: number };
}

/**
 * Test notes — a reviewer's own qualitative read of a test's result, fetched
 * only when a test row is expanded (same "don't preload" posture as
 * everything else added alongside Table Explorer).
 */
export async function fetchTestNotes(stepId: string): Promise<readonly TestNote[]> {
  const res = await fetch(`/api/lessonbook/steps/${encodeURIComponent(stepId)}/notes`, { credentials: "same-origin" });
  if (!res.ok) throw new SurfaceError(`notes unavailable (HTTP ${res.status})`, res.status);
  const body = await readJson(res);
  return Array.isArray(body.notes) ? (body.notes as TestNote[]) : [];
}

export async function addTestNote(stepId: string, note: string, author?: string): Promise<TestNote> {
  const res = await fetch(`/api/lessonbook/steps/${encodeURIComponent(stepId)}/notes`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ note, ...(author ? { author } : {}) }),
  });
  const body = await readJson(res);
  if (!res.ok) throw new SurfaceError(str(body.error) ?? `the note was not added (HTTP ${res.status})`, res.status);
  return body.note as TestNote;
}

/* ────────────────────────────── table explorer ─────────────────────────────
 *
 * `GET /api/schema/table/:name/rows` — never called except in direct response
 * to a reader picking a table, a row count, and pressing Fetch. No hook here
 * polls it.
 */
export async function fetchTableRows(table: string, limit: number, targetKey?: string): Promise<TableRowsResult> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (targetKey) params.set("target", targetKey);
  const res = await fetch(`/api/schema/table/${encodeURIComponent(table)}/rows?${params.toString()}`, {
    credentials: "same-origin",
  });
  const body = await readJson(res);
  if (!res.ok) throw new SurfaceError(str(body.error) ?? `rows unavailable (HTTP ${res.status})`, res.status);
  return body as unknown as TableRowsResult;
}

/**
 * Create/update/delete a row. Refused server-side (`explore.ts`) for any
 * `DbTarget` that isn't `editable` — the substrate's own database — whatever
 * this call asks for, so there is no client-side gate to accidentally get
 * wrong; these three functions exist only for `training-dojo/lessonbook`
 * (and any future database this vessel is told it owns).
 */
export async function createTableRow(table: string, targetKey: string, fields: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`/api/schema/table/${encodeURIComponent(table)}/rows`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ target: targetKey, fields }),
  });
  const body = await readJson(res);
  if (!res.ok) throw new SurfaceError(str(body.error) ?? `the row was not created (HTTP ${res.status})`, res.status);
  return body.row as Record<string, unknown>;
}

export async function updateTableRow(
  table: string,
  targetKey: string,
  recordId: string,
  fields: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await fetch(`/api/schema/table/${encodeURIComponent(table)}/rows`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ target: targetKey, recordId, fields }),
  });
  const body = await readJson(res);
  if (!res.ok) throw new SurfaceError(str(body.error) ?? `the row was not updated (HTTP ${res.status})`, res.status);
  return body.row as Record<string, unknown>;
}

export async function deleteTableRow(table: string, targetKey: string, recordId: string): Promise<void> {
  const res = await fetch(`/api/schema/table/${encodeURIComponent(table)}/rows`, {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ target: targetKey, recordId }),
  });
  if (!res.ok) {
    const body = await readJson(res);
    throw new SurfaceError(str(body.error) ?? `the row was not deleted (HTTP ${res.status})`, res.status);
  }
}
