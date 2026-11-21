#!/usr/bin/env bash
# kind: known-valid
# The candidate walk-owner-seed.ts offers the walk's judgment of a gap's edit site (the change_wanted gap variant) only
# on a gap no stack localized, and only with a code search as input. Run by shadow-eval.sh with CANDIDATE_DIR (see its
# header).
#
# WHY. A gap whose row says localized false on top is work until the walk names its site. Offered on any gap, a later
# "cannot find it" would hand a released gap back to a person, and a site naming another repo would open a clone for a
# gap that needs none. Without a code search as input, the judgment names a site it never looked for.
#
# HOW. The candidate seeder runs as its unit runs it, with DISCOVERY_URL pointed at a fixture-owned stand-in for
# discovery on a random loopback port that serves record_read / record_write from memory, and a fixture key as
# METABOB_API_KEY (the stand-in and run() are walk-owner-seed-rows.sh's, copied, written in the form of
# walk-owner-seed-clone-repo.sh's handler: a drive written from a heredoc cannot import another fixture's). Legs:
#   - the seeder exits 0;
#   - the change_wanted gap variant's shape_schema row takes exactly one gap input, whose where is localized false and
#     nothing else, and a codeSearchResult input.
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
W="$(mktemp -d "${TMPDIR:-/tmp}/fx-walk-owner-gap-site.XXXXXX")" || { echo "FAIL - mktemp"; exit 1; }
trap 'rm -rf "$W"' EXIT
cp "$SEED" "$W/walk-owner-seed.ts"
cat > "$W/drive.ts" <<'TS'
// drive.ts: prints one "FAIL - <leg>" line per broken leg and "VERDICT pass|fail".
const KEY = `mb-walkgapsitefixture-${"k".repeat(32)}`;
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
const site = rows.find((r) => r.shape === "shape_schema" && r.target === "change_wanted" && r.variant === "gap");
const gapIn = (site?.inputs ?? []).filter((i: Row) => i?.shape === "gap");
leg(gapIn.length === 1 && JSON.stringify(gapIn[0].where) === JSON.stringify({ localized: false }) &&
  (site?.inputs ?? []).some((i: Row) => i?.shape === "codeSearchResult"),
  `the change_wanted gap judgment takes only a gap with localized false, and a code search (got ${JSON.stringify(site?.inputs)})`);
server.stop(true);
console.log(`VERDICT ${failed === 0 ? "pass" : "fail"}`);
process.exit(failed === 0 ? 0 : 1);
TS
out="$(cd "$W" && "$BUN" "$W/drive.ts" 2>&1)"; rc=$?
printf '%s\n' "$out" | grep -E '^FAIL - ' || true
if [ "$rc" -eq 0 ] && printf '%s\n' "$out" | grep -q '^VERDICT pass$'; then
  echo "ok - walk-owner-seed.ts offers the gap edit-site judgment only on a gap no stack localized, with a code search"
  exit 0
fi
printf '%s\n' "$out" | grep -q '^VERDICT ' || echo "FAIL - the drive did not finish: $(printf '%s' "$out" | tail -3 | tr '\n' '|' | cut -c1-300)"
exit 1
