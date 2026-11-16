// owner-infra-window.ts — write ONE owner infra_window row: the owner's mark that a span of this node's store was an
// outage, so records' fold debits no one for walk failures inside it of the statuses it names (records dcd051d2).
//
// One-shot, by the USER's go ("Reviewed script, my go"): run once by deployment on the node whose store had the outage,
// with the span and statuses the USER approved; then removed from the tree (its removal is planned with it), so it is
// never a fossil. Writes as the owner exactly as walk-owner-seed does (record_write, writer and role owner, node key).
//
// Usage: bun owner-infra-window.ts --window-id <id> --from <seq> --to <seq> --statuses 404[,402...] --reason "<who, why>"
//        [--write]          (without --write: a dry run that prints the row and the checks, and writes nothing)
// A rerun with the same window_id and fields finds it present and writes nothing (exit 0).
// Refuses: a malformed status list, from > to, a span reaching past the store's head (a window describes what already
// happened; records also ends any window at its own row), a span overlapping a live window, a window_id already live,
// and an empty reason (law 12: the row says who wrote it and why).

type Row = Record<string, unknown>;
export type Args = { windowId: string; from: number; to: number; statuses: number[]; reason: string };
export type Plan = { ok: true; row: Row; present?: string } | { ok: false; why: string };

/** The row to write, or why not: pure, over the store's head and its infra_window rows (oldest first). */
export function plan(a: Args, head: number, existing: Row[]): Plan {
  if (!a.windowId) return { ok: false, why: "a window_id is required" };
  if (!Number.isInteger(a.from) || !Number.isInteger(a.to) || a.from < 0) return { ok: false, why: "from and to must be non-negative integer seqs" };
  if (a.from > a.to) return { ok: false, why: `from (${a.from}) is after to (${a.to})` };
  if (a.to > head) return { ok: false, why: `the span reaches past the store's head (${head}): a window marks what already happened` };
  if (a.statuses.length === 0 || a.statuses.some((s) => !Number.isInteger(s) || s < 100 || s > 599)) {
    return { ok: false, why: `statuses must be a non-empty list of HTTP status codes, got ${JSON.stringify(a.statuses)}` };
  }
  if (a.reason.trim() === "") return { ok: false, why: "a reason is required: who wrote this window and why" };
  const latest = new Map<string, Row>();
  for (const r of existing) latest.set(String(r.window_id ?? r.id), r);
  const live = [...latest.entries()].filter(([, r]) => r.retracted !== true);
  const row: Row = { shape: "infra_window", window_id: a.windowId, from_seq: a.from, to_seq: a.to, statuses: a.statuses, reason: a.reason.trim(), input_refs: [] };
  // A rerun of the same window is not a second window: an identical live row means it is already written.
  const same = live.find(([id]) => id === a.windowId);
  if (same) {
    const fields = ["from_seq", "to_seq", "statuses", "reason"];
    if (fields.every((f) => JSON.stringify(same[1][f]) === JSON.stringify(row[f]))) return { ok: true, row, present: String(same[1].id ?? a.windowId) };
    return { ok: false, why: `window_id ${a.windowId} is already live with other fields` };
  }
  const overlap = live.find(([, r]) => Number(r.from_seq) <= a.to && a.from <= Number(r.to_seq));
  if (overlap) return { ok: false, why: `the span overlaps live window ${overlap[0]} (${overlap[1].from_seq}..${overlap[1].to_seq})` };
  return { ok: true, row };
}

export function parseArgs(argv: string[]): Args & { write: boolean } {
  const val = (k: string): string => { const i = argv.indexOf(k); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : ""; };
  return {
    windowId: val("--window-id"), from: Number(val("--from") || NaN), to: Number(val("--to") || NaN),
    statuses: val("--statuses") === "" ? [] : val("--statuses").split(",").map((s) => Number(s.trim())),
    reason: val("--reason"), write: argv.includes("--write"),
  };
}

async function main(): Promise<void> {
  const DISCOVERY_URL = process.env.DISCOVERY_URL ?? "http://127.0.0.1:8100";
  const KEY = process.env.METABOB_API_KEY;
  if (!KEY) throw new Error("METABOB_API_KEY is not set: the node key comes from the env file");
  const resolve = async (pointer: Row): Promise<unknown> => {
    const r = await fetch(new URL("/resolve", DISCOVERY_URL).href, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `ApiKey ${KEY}` },
      body: JSON.stringify({ pointer }), signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) throw new Error(`${String(pointer.type)} ${r.status}: ${(await r.text()).slice(0, 300)}`);
    return r.json();
  };
  const rowsOf = (v: unknown): Row[] => Array.isArray(v) ? v as Row[] : Array.isArray((v as { content?: unknown })?.content) ? (v as { content: Row[] }).content : [];
  const a = parseArgs(process.argv.slice(2));
  const headAnswer = (await resolve({ type: "record_read", head: true })) as { at_seq?: unknown; content?: { at_seq?: unknown } };
  const head = Number(headAnswer?.at_seq ?? headAnswer?.content?.at_seq);
  if (!Number.isFinite(head)) throw new Error("records answered no head");
  const existing = rowsOf(await resolve({ type: "record_read", shape: "infra_window" }));
  const p = plan(a, head, existing);
  if (!p.ok) { console.error(`[owner-infra-window] refused: ${p.why}`); process.exit(1); }
  console.log(`[owner-infra-window] head ${head}; ${existing.length} existing window row(s); row: ${JSON.stringify(p.row)}`);
  if (p.present !== undefined) { console.log(`[owner-infra-window] present (${p.present}): this window is already written; nothing to do`); return; }
  if (!a.write) { console.log("[owner-infra-window] dry run: nothing written (add --write)"); return; }
  const w = (await resolve({ type: "record_write", row: p.row, writer: "owner", role: "owner" })) as Row;
  console.log(`[owner-infra-window] wrote ${String(w.id ?? JSON.stringify(w).slice(0, 80))} at seq ${String(w.seq ?? "?")}`);
}

if (import.meta.main) await main();
