#!/usr/bin/env bash
# walk-owner-seed-keep-visibility.test.sh: the producers' context keeps what a request must not lose (qa, database, d929):
#   (a) every producer's request_acts keep entry takes only the newest row (latest_by), so the growing rows cannot fill the keep share;
#   (a2) the outcome grader's entry stays every row, until a newest row is shown to lose nothing (the USER);
#   (b) the request schema keeps its newest commit (gitCommitResult) beside its clone;
#   (c) the answer schema shows a file read whole (fileContent, whole, in place of its cut hop);
#   (d) the template writer is taught to bind per-request values with placeholders (sig.in…, calls.N.output…).
# Driven against a stand-in discovery (loopback only, no fleet key).
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SEED="$ROOT/scripts/substrate/walk-owner-seed.ts"
BUN="$(command -v bun || echo /usr/local/bin/bun)"
[ -n "$("$BUN" -e 'console.log(process.versions.bun ?? "")' 2>/dev/null)" ] || { echo "FAIL - cannot judge: no bun at $BUN"; exit 1; }
W="$(mktemp -d "${TMPDIR:-/tmp}/seed-keep-visibility.XXXXXX")" || { echo "FAIL - mktemp"; exit 1; }
trap 'rm -rf "$W"' EXIT
cp "$SEED" "$W/walk-owner-seed.ts"
cat > "$W/drive.ts" <<'TS'
type Row = Record<string, any>;
const rows: Row[] = [];
let mode: "served" | "absent" | "old" = "served";
const policy: Row = { rev: 1, arms: [{ model: "vendor/paid", cost_per_mtok: 1, alpha: 1, beta: 1 }] };
const writes: Row[] = [];
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(req) {
  const pointer = (((await req.json().catch(() => ({}))) as Row).pointer ?? {}) as Row;
  // records' read: the rows of a shape, and of every where field equal as strings (a field a row lacks reads "undefined")
  if (pointer.type === "record_read") return json(rows.filter((r) => r.shape === pointer.shape
    && Object.entries((pointer.where ?? {}) as Row).every(([k, v]) => String(r[k]) === String(v))));
  if (pointer.type === "record_write") { const row = { ...pointer.row, id: `row-${rows.length + 1}` }; rows.push(row); return json(row); }
  // llm-resolver's policy, in one of three states the test sets: served, not served (404), or not taking the field.
  if (pointer.type === "llmModelPolicy" && mode !== "absent") return json({ resolved: true, shape: "llmModelPolicy", body: policy });
  if (pointer.type === "llmModelPolicy_write" && mode !== "absent") {
    writes.push(pointer);
    if (mode === "old") return json({ resolved: false, shape: "llmModelPolicyWriteResult", error: "body must include arms[]" });
    if ("denied_models" in pointer) policy.denied_models = pointer.denied_models;
    return json({ resolved: true, shape: "llmModelPolicyWriteResult", body: { rev: 2 } });
  }
  return json({ error: "Not found" }, 404);
} });
const seed = async (): Promise<number> => {
  const p = Bun.spawn([process.execPath, `${import.meta.dir}/walk-owner-seed.ts`], {
    env: { PATH: process.env.PATH ?? "", DISCOVERY_URL: `http://127.0.0.1:${server.port}`, METABOB_API_KEY: "mb-test-" + "k".repeat(32) },
    stdout: "pipe", stderr: "pipe",
  });
  const killer = setTimeout(() => p.kill(), 60_000);
  const code = await p.exited;
  clearTimeout(killer);
  return code;
};
const code = await seed();
server.stop(true);
let failed = 0;
const leg = (ok: boolean, what: string) => { console.log(`${ok ? "ok  " : "FAIL"} - ${what}`); if (!ok) failed++; };
const latest = (t: string, variant = "") => rows.filter((r) => r.shape === "shape_schema" && r.target === t && (r.variant ?? "") === variant).at(-1);
const entries = (r: Row | undefined): Row[] => [r?.context ?? []].flat().filter((e: unknown) => typeof e === "object" && e !== null) as Row[];
leg(code === 0, "the seeder ran");
const actsEntries = ["answer", "request"].flatMap((t) => entries(latest(t)).filter((e) => e.shape === "request_acts").map((e) => [t, e] as const))
  .concat(entries(latest("request", "gap")).filter((e) => e.shape === "request_acts").map((e) => ["request/gap", e] as const));
leg(actsEntries.length >= 3 && actsEntries.every(([, e]) => e.keep === true && typeof e.latest_by === "string"),
  `(a) every request_acts keep entry takes only the newest row (${actsEntries.map(([t, e]) => `${t}:${String(e.latest_by)}`).join(", ")})`);
const commit = (t: string, v = "") => entries(latest(t, v)).find((e) => e.shape === "gitCommitResult");
// The grader's request_acts entry stays every row (the USER: "Split it out; make lossless first").
const graderActs = entries(latest("outcome")).filter((e) => e.shape === "request_acts");
leg(graderActs.length === 1 && graderActs[0].keep === true && graderActs[0].latest_by === undefined,
  "(a2) the outcome grader still sees every request_acts row (no latest_by) until a newest row is shown to lose nothing");
leg(commit("request")?.keep === true && typeof commit("request")?.latest_by === "string" && commit("request", "gap")?.keep === true,
  "(b) the request schema (and its gap variant) keeps its newest commit");
const file = entries(latest("answer")).find((e) => e.shape === "fileContent");
leg(file?.whole === true && file?.latest_by === "path" && file?.covers?.shape === "hop" && file?.covers?.on === "call_id",
  "(c) the answer schema shows a file read whole, newest per path, in place of its cut hop");
const tmpl = latest("activity_template");
leg(String(tmpl?.description ?? "").includes("{{ sig.in[0].cwd }}") && String(tmpl?.description ?? "").includes("[\"gitWorktree\"]")
  && String(tmpl?.description ?? "").includes("{{ calls.0.output.cwd }}"),
  "(d) the template writer is taught both placeholder forms, so per-request values are bound, not copied");
process.exit(failed === 0 ? 0 : 1);
TS
cd "$W" && "$BUN" drive.ts
