#!/usr/bin/env bash
# kind: known-valid
# The candidate walk-owner-seed.ts writes the walk vessels' owner rows the way records expects them. Run by
# shadow-eval.sh with CANDIDATE_DIR (see its header).
#
# WHY. walk-owner-seed.service runs the baked /vessels copy, so a seeder change converges in place only when the
# coverage map proves it at level behaviour, and that needs a fixture judging what the seeder WRITES, not whether it
# parses. Without one, a node keeps running the seeder it was baked with.
#
# HOW. The candidate seeder runs twice as its unit runs it, with DISCOVERY_URL pointed at a fixture-owned stand-in
# for discovery on a random loopback port that serves record_read / record_write from memory, and a fixture key as
# METABOB_API_KEY. Legs:
#   - every request is POST /resolve under that key, so records is reached through discovery, by shape;
#   - every record_write declares writer and role "owner" (records takes them from node-self);
#   - two channel rows, each a call whose pointer.type is llm_completion, and no written row holds an address
#     (no endpoint / resolve_endpoint field, no http URL);
#   - shape_schema rows for answer, outcome, request, due and activity_template, and due requires `at` (records
#     stamps `t` on every row, and the walk's wait-until reads due.at);
#   - the walk's arm row: walk-vessel, treated;
#   - no vessel_key row (records no longer reads one);
#   - the second run writes nothing (each row only when records lacks it);
#   - the key value never reaches the seeder's output.
#
# NEEDS a bun that the shadow sandbox's nobody can execute. Without one this fails as "cannot judge", by design: a
# skip would read as a pass.
#
# SAFETY. Loopback only. The seeder reads no file and can reach only the stand-in.
set -uo pipefail
: "${CANDIDATE_DIR:?run by shadow-eval.sh}"
SEED="$CANDIDATE_DIR/scripts/substrate/walk-owner-seed.ts"
BUN="$(command -v bun || echo /usr/local/bin/bun)"
[ -f "$SEED" ] || { echo "FAIL - the candidate has no scripts/substrate/walk-owner-seed.ts"; exit 1; }
[ -n "$("$BUN" -e 'console.log(process.versions.bun ?? "")' 2>/dev/null)" ] \
  || { echo "FAIL - cannot judge: no bun at $BUN (a skip would read as a pass)"; exit 1; }
W="$(mktemp -d "${TMPDIR:-/tmp}/fx-walk-owner-seed.XXXXXX")" || { echo "FAIL - mktemp"; exit 1; }
trap 'rm -rf "$W"' EXIT
cp "$SEED" "$W/walk-owner-seed.ts"
cat > "$W/drive.ts" <<'TS'
// drive.ts: prints one "FAIL - <leg>" line per broken leg and "VERDICT pass|fail".
const KEY = `mb-walkseedfixture-${"k".repeat(32)}`;
type Row = Record<string, any>;
const rows: Row[] = [];
const seen: Array<{ path: string; method: string; auth: string; pointer: Row }> = [];
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(req) {
  const path = new URL(req.url).pathname;
  const pointer = (((await req.json().catch(() => ({}))) as Row).pointer ?? {}) as Row;
  seen.push({ path, method: req.method, auth: req.headers.get("authorization") ?? "", pointer });
  if (path !== "/resolve") return json({ error: "not found" }, 404);
  if (pointer.type === "record_read") {
    const where = (pointer.where ?? {}) as Row;
    return json(rows.filter((r) => r.shape === pointer.shape).filter((r) => Object.entries(where).every(([k, v]) => String(r[k]) === String(v))));
  }
  if (pointer.type === "record_write") {
    const row = { ...pointer.row, id: `row-${rows.length + 1}`, seq: rows.length + 1, writer: pointer.writer, role: pointer.role };
    rows.push(row);
    return json(row);
  }
  return json({ error: "Not found", shape: pointer.type }, 404);
} });
const run = async () => {
  const p = Bun.spawn([process.execPath, `${import.meta.dir}/walk-owner-seed.ts`], {
    env: { PATH: process.env.PATH ?? "", DISCOVERY_URL: `http://127.0.0.1:${server.port}`, METABOB_API_KEY: KEY },
    stdout: "pipe", stderr: "pipe",
  });
  const code = await p.exited;
  return { code, out: (await new Response(p.stdout).text()) + (await new Response(p.stderr).text()) };
};
let failed = 0;
const leg = (ok: boolean, what: string) => { if (!ok) { failed++; console.log(`FAIL - ${what}`); } };
const first = await run();
leg(first.code === 0, `the seeder exits 0 (exit ${first.code}: ${first.out.split("\n").slice(-3).join(" | ").slice(0, 300)})`);
const writes = seen.filter((s) => s.pointer.type === "record_write");
leg(seen.length > 0 && seen.every((s) => s.method === "POST" && s.path === "/resolve"), "every request is POST /resolve");
leg(seen.every((s) => s.auth === `ApiKey ${KEY}`), "every request carries the node key as ApiKey");
leg(writes.length > 0 && writes.every((s) => s.pointer.writer === "owner" && s.pointer.role === "owner"), "every write declares writer and role owner");
const of = (shape: string) => rows.filter((r) => r.shape === shape);
const channels = of("channel");
leg(channels.length === 2 && channels.every((c) => Array.isArray(c.calls) && c.calls.length > 0 && c.calls.every((x: Row) => x?.pointer?.type === "llm_completion")),
  `two channel rows whose calls are llm_completion pointers (got ${channels.length})`);
const text = JSON.stringify(rows);
leg(!/endpoint/.test(text) && !/https?:\/\//.test(text), "no written row holds an address");
const targets = new Set(of("shape_schema").map((r) => r.target));
leg(["answer", "outcome", "request", "due", "activity_template"].every((t) => targets.has(t)), `shape_schema targets (got ${[...targets].join(",")})`);
const due = of("shape_schema").find((r) => r.target === "due");
leg(JSON.stringify(due?.schema?.required) === JSON.stringify(["at"]), "the due schema requires at");
leg(of("arm").some((r) => r.vessel_id === "walk-vessel" && r.arm === "treated"), "the walk's arm row: walk-vessel, treated");
leg(of("vessel_key").length === 0, "no vessel_key row");
const before = rows.length;
const second = await run();
leg(second.code === 0 && rows.length === before, `a second run writes nothing (wrote ${rows.length - before}, exit ${second.code})`);
leg(!(first.out + second.out).includes(KEY), "the key value never reaches the seeder's output");
server.stop(true);
console.log(`VERDICT ${failed === 0 ? "pass" : "fail"}`);
process.exit(failed === 0 ? 0 : 1);
TS
out="$(cd "$W" && "$BUN" "$W/drive.ts" 2>&1)"; rc=$?
printf '%s\n' "$out" | grep -E '^FAIL - ' || true
if [ "$rc" -eq 0 ] && printf '%s\n' "$out" | grep -q '^VERDICT pass$'; then
  echo "ok - walk-owner-seed.ts writes the owner rows through discovery, declared owner, with no address, once"
  exit 0
fi
printf '%s\n' "$out" | grep -q '^VERDICT ' || echo "FAIL - the drive did not finish: $(printf '%s' "$out" | tail -3 | tr '\n' '|' | cut -c1-300)"
exit 1
