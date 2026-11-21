#!/usr/bin/env bash
# kind: known-valid
# The candidate walk-owner-seed.ts writes the owner's bound on a walk's wait: one wait_bound row whose within_ms is a
# positive whole number of milliseconds. Run by shadow-eval.sh with CANDIDATE_DIR (see its header).
#
# WHY. records holds a wait with nothing ahead until a row answers it; a stall no row ever answers (a recovery discovery
# did not see) held a root for hours. With no row the wait stays unbounded, and a bound that is not a positive number
# bounds nothing, so either is the stall again.
#
# HOW. The candidate seeder runs twice as its unit runs it, with DISCOVERY_URL pointed at a fixture-owned stand-in for
# discovery on a random loopback port that serves record_read / record_write from memory, and a fixture key as
# METABOB_API_KEY (the stand-in and run() are walk-owner-seed-gap-site.sh's, copied: a drive written from a heredoc
# cannot import another fixture's). Legs:
#   - the seeder exits 0;
#   - exactly one wait_bound row, written as the owner, its within_ms a positive integer;
#   - the second run writes no second one.
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
W="$(mktemp -d "${TMPDIR:-/tmp}/fx-walk-owner-wait-bound.XXXXXX")" || { echo "FAIL - mktemp"; exit 1; }
trap 'rm -rf "$W"' EXIT
cp "$SEED" "$W/walk-owner-seed.ts"
cat > "$W/drive.ts" <<'TS'
// drive.ts: prints one "FAIL - <leg>" line per broken leg and "VERDICT pass|fail".
const KEY = `mb-walkwaitboundfixture-${"k".repeat(32)}`;
type Row = Record<string, any>;
const rows: Row[] = [];
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: async (req) => {
  const path = new URL(req.url).pathname;
  const pointer = (((await req.json().catch(() => ({}))) as Row).pointer ?? {}) as Row;
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
const bounds = () => rows.filter((r) => r.shape === "wait_bound");
const b = bounds();
leg(b.length === 1 && b[0].role === "owner" && Number.isInteger(b[0].within_ms) && b[0].within_ms > 0,
  `one owner wait_bound row with a positive whole within_ms (got ${JSON.stringify(b.map((r) => ({ role: r.role, within_ms: r.within_ms })))})`);
const second = await run();
leg(second.code === 0 && bounds().length === 1, `the second run writes no second wait_bound (exit ${second.code}, ${bounds().length} rows)`);
server.stop(true);
console.log(`VERDICT ${failed === 0 ? "pass" : "fail"}`);
process.exit(failed === 0 ? 0 : 1);
TS
out="$(cd "$W" && "$BUN" "$W/drive.ts" 2>&1)"; rc=$?
printf '%s\n' "$out" | grep -E '^FAIL - ' || true
if [ "$rc" -eq 0 ] && printf '%s\n' "$out" | grep -q '^VERDICT pass$'; then
  echo "ok - walk-owner-seed.ts writes one owner wait_bound with a positive whole within_ms, once"
  exit 0
fi
printf '%s\n' "$out" | grep -q '^VERDICT ' || echo "FAIL - the drive did not finish: $(printf '%s' "$out" | tail -3 | tr '\n' '|' | cut -c1-300)"
exit 1
