#!/usr/bin/env bash
# walk-owner-seed-waits-for-records.test.sh: at boot the seeder runs before records has registered with discovery,
# which answers 404 for a shape no vessel serves yet. The seeder must wait that out and then write its rows, because
# walk-vessel and described-shape-vessel Require it: a failed first run failed them, and systemd never started them
# again when the seeder's next try succeeded (observed on a recreated node: both inactive from boot).
#   (a) discovery answers 404 for the first calls, then serves records: the seeder exits 0 and writes its rows;
#   (b) any other failure (500) is not waited out: the seeder exits non-zero at once;
#   (c) the key value never reaches the seeder's output;
#   (d) a records restarting mid-run answers reads with no list of rows (a 200 with another body): the seeder reads
#       again, exits 0, and writes each row once (as many as an undisturbed run).
# Loopback only, a stand-in discovery owned by the test; no node, no key of the fleet.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SEED="$ROOT/scripts/substrate/walk-owner-seed.ts"
BUN="$(command -v bun || echo /usr/local/bin/bun)"
[ -n "$("$BUN" -e 'console.log(process.versions.bun ?? "")' 2>/dev/null)" ] || { echo "FAIL - cannot judge: no bun at $BUN"; exit 1; }
W="$(mktemp -d "${TMPDIR:-/tmp}/seed-waits.XXXXXX")" || { echo "FAIL - mktemp"; exit 1; }
trap 'rm -rf "$W"' EXIT
cp "$SEED" "$W/walk-owner-seed.ts"
cat > "$W/drive.ts" <<'TS'
const KEY = `mb-seedwaitstest-${"k".repeat(32)}`;
type Row = Record<string, any>;
const run = async (mode: "late" | "broken" | "restarting") => {
  const rows: Row[] = [];
  let calls = 0;
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(req) {
    const pointer = (((await req.json().catch(() => ({}))) as Row).pointer ?? {}) as Row;
    calls++;
    if (mode === "broken") return json({ error: "boom" }, 500);
    if (calls <= 2) return json({ error: "Not found", shape: pointer.type }, 404);
    if (mode === "restarting" && calls >= 6 && calls <= 8) return json({ status: "starting" });
    if (pointer.type === "record_read") return json(rows.filter((r) => r.shape === pointer.shape));
    if (pointer.type === "record_write") { const row = { ...pointer.row, id: `row-${rows.length + 1}` }; rows.push(row); return json(row); }
    return json({ error: "Not found" }, 404);
  } });
  const p = Bun.spawn([process.execPath, `${import.meta.dir}/walk-owner-seed.ts`], {
    env: { PATH: process.env.PATH ?? "", DISCOVERY_URL: `http://127.0.0.1:${server.port}`, METABOB_API_KEY: KEY },
    stdout: "pipe", stderr: "pipe",
  });
  const killer = setTimeout(() => p.kill(), 60_000);
  const code = await p.exited;
  clearTimeout(killer);
  const out = (await new Response(p.stdout).text()) + (await new Response(p.stderr).text());
  server.stop(true);
  return { code, out, rows };
};
let failed = 0;
const leg = (ok: boolean, what: string) => { console.log(`${ok ? "ok  " : "FAIL"} - ${what}`); if (!ok) failed++; };
const late = await run("late");
leg(late.code === 0 && late.rows.length > 0, `(a) records reachable only after two 404s: exit 0 and rows written (exit ${late.code}, ${late.rows.length} rows)`);
const broken = await run("broken");
leg(broken.code !== 0 && broken.rows.length === 0, `(b) a 500 is not waited out: non-zero exit, nothing written (exit ${broken.code})`);
leg(!(late.out + broken.out).includes(KEY), "(c) the key value never reaches the output");
const restarting = await run("restarting");
leg(restarting.code === 0 && restarting.rows.length === late.rows.length,
  `(d) reads answered with no list mid-run are read again: exit 0, each row once (exit ${restarting.code}, ${restarting.rows.length} of ${late.rows.length} rows)`);
process.exit(failed === 0 ? 0 : 1);
TS
out="$(cd "$W" && "$BUN" "$W/drive.ts" 2>&1)"; rc=$?
printf '%s\n' "$out" | grep -E '^(ok  |FAIL) - '
[ "$rc" -eq 0 ] && { echo; echo PASS; exit 0; }
echo; echo "FAILED"; exit 1
