#!/usr/bin/env bash
# kind: known-valid
# The candidate auto-describe-resolvers.ts describes every advertised, undescribed served store write, from its
# advertisement, and leaves an already-described shape alone. Run by shadow-eval.sh with CANDIDATE_DIR (see its header).
#
# WHY. goal-host recalls target candidates from concept-db's shape index, which holds only the shapes discovery
# describes. The describer skipped every *_write, so no served store write was ever described, none could be recalled,
# and a goal asking to change what a surface keeps was read as a report. The timer runs the installed copy
# (/usr/local/share/substrate/active-scripts/auto-describe-resolvers.ts), so this fixture is what lets a describer
# change converge in place: judged by what the tick POSTs to discovery, not by whether it parses.
#
# HOW. The candidate's script is copied out and its exported main() is driven in a child bun against a fixture-owned
# fake discovery, LLM resolver and SurrealDB on one random loopback port (every address the script knows points
# there; the key is a placeholder). Legs:
#   - an advertised, undescribed store write is POSTed, with a description derived from its advertisement (its object
#     and effect, the vessel that keeps it, and that vessel's described reader of the same object);
#   - every undescribed write is POSTed before any LLM-described shape, and internal tick machinery is not;
#   - each POST names the tick and its run (source auto-describe-resolvers@<run start>);
#   - a walk-minted composite (composedDeliverable_*) and a listed shape no live vessel serves are not POSTed;
#   - an already-described shape is never POSTed, and a second tick POSTs nothing;
#   - an unreadable description read POSTs nothing.
#
# NEEDS a bun that the shadow sandbox's nobody can execute. Without one this fails as "cannot judge", by design: a
# skip would read as a pass.
#
# SAFETY. Loopback only. The script's log and cursor go to the fixture's own directory (main's argument).
set -uo pipefail
: "${CANDIDATE_DIR:?run by shadow-eval.sh}"
AD="$CANDIDATE_DIR/scripts/substrate/auto-describe-resolvers.ts"
BUN="$(command -v bun || echo /usr/local/bin/bun)"
[ -f "$AD" ] || { echo "FAIL - the candidate has no scripts/substrate/auto-describe-resolvers.ts"; exit 1; }
[ -n "$("$BUN" -e 'console.log(process.versions.bun ?? "")' 2>/dev/null)" ] \
  || { echo "FAIL - cannot judge: no bun at $BUN (a skip would read as a pass)"; exit 1; }
W="$(mktemp -d "${TMPDIR:-/tmp}/fx-auto-describe.XXXXXX")" || { echo "FAIL - mktemp"; exit 1; }
trap 'rm -rf "$W"' EXIT
cp "$AD" "$W/auto-describe-resolvers.ts"
cat > "$W/tick.ts" <<'TS'
// tick.ts <metrics-dir>: one timer run of the candidate (its endpoints are read from env when it loads).
const m: any = await import("./auto-describe-resolvers.ts");
if (typeof m.main !== "function") { console.log("NO_MAIN"); process.exit(3); }
await m.main(process.argv[2]);
TS
cat > "$W/drive.ts" <<'TS'
// drive.ts: prints one "FAIL - <leg>" line per broken leg and "VERDICT pass|fail".
import { mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
const VESSELS = [
  { vesselId: "fx-surface-vessel", shapes: ["boardLayout_write", "fx_surface:board_layout", "boardNote", "boardNote_write"] },
  { vesselId: "fx-report-vessel", shapes: ["fleet_digest", "nightly_tick", "composedDeliverable_board_for_today"] },
];
const UNSERVED = ["strayLedger_write", "stray_digest"]; // listed, but no live vessel serves them
const SEEDED: Record<string, string> = {
  "fx_surface:board_layout": "produces the board layout a person sees; use for goals that read the board",
  boardNote: "produces the notes pinned to the board; use for goals that read notes",
};
let descriptions: Record<string, string> = {}, posts: Array<{ shape: string; description: string; source: string }> = [];
let failDescRead = false;
const reset = () => { descriptions = { ...SEEDED }; posts = []; failDescRead = false; };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(req) {
  const u = new URL(req.url);
  if (u.pathname === "/registry/shapes") return json({ shapes: [...new Set([...VESSELS.flatMap((v) => v.shapes), ...UNSERVED])] });
  if (u.pathname === "/registry/shape-descriptions" && req.method === "GET")
    return failDescRead ? new Response("unavailable", { status: 500 }) : json({ shape_descriptions: descriptions });
  if (u.pathname === "/registry/shape-descriptions" && req.method === "POST") {
    const b = (await req.json()) as any; posts.push(b); descriptions[b.shape] = b.description; return json({ success: true }, 201);
  }
  if (u.pathname === "/resolve") {
    const b = (await req.json()) as any;
    if (b?.pointer?.type === "vesselCapability")
      return json({ content: { shape: b.pointer.shape, vessels: VESSELS.filter((v) => v.shapes.includes(b.pointer.shape)).map((v) => ({ vesselId: v.vesselId, vesselName: v.vesselId, protocol: "http" })) } });
    const shape = /Shape id: (\S+)/.exec(b?.prompt ?? "")?.[1] ?? "?";
    return json({ resolved: true, content: `produces ${shape} rows; use for goals that read ${shape}` });
  }
  const m = /^\/vessels\/(.+)$/.exec(u.pathname);
  if (m) { const v = VESSELS.find((x) => x.vesselId === decodeURIComponent(m[1])); return v ? json({ vesselId: v.vesselId, shapes: v.shapes }) : json({ error: "Vessel not found" }, 404); }
  if (u.pathname === "/sql") return json([{ result: [] }]);
  return json({ error: "not found" }, 404);
} });
const EP = `http://127.0.0.1:${server.port}`;
let failed = 0;
const leg = (name: string, ok: boolean) => { if (!ok) { failed++; console.log(`FAIL - ${name}`); } };
const tick = async (dir: string) => {
  const p = Bun.spawn([process.execPath, join(import.meta.dir, "tick.ts"), dir], {
    env: { PATH: process.env.PATH ?? "", HOME: dir, AUTO_DESCRIBE_RESOLVERS: "1", METABOB_API_KEY: "placeholder-not-a-key",
      DISCOVERY_VESSEL_ENDPOINT: EP, LLM_VESSEL_ENDPOINT: EP, SURREALDB_URL: EP, SURREAL_PASS: "placeholder" },
    stdout: "pipe", stderr: "pipe" });
  const [out, , code] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited]);
  if (code !== 0) throw new Error(`the tick exited ${code}${out.includes("NO_MAIN") ? " (the candidate exports no main)" : ""}`);
};
const dir = () => mkdtempSync(join(process.env.TMPDIR ?? "/tmp", "tick-"));
try {
  reset(); const d1 = dir(); await tick(d1);
  const w = posts.find((p) => p.shape === "boardLayout_write");
  leg("an advertised, undescribed store write is described from its advertisement",
    !!w && w.description.startsWith("writes the board layout kept by the fx surface vessel (fx-surface-vessel)")
    && w.description.includes("read back as fx_surface:board_layout (produces the board layout a person sees)"));
  const order = posts.map((p) => p.shape);
  leg("every undescribed write is described before any LLM-described shape, internal machinery is not",
    JSON.stringify(order.slice(0, 2)) === JSON.stringify(["boardLayout_write", "boardNote_write"])
    && order.includes("fleet_digest") && !order.includes("nightly_tick"));
  const run = w?.source.startsWith("auto-describe-resolvers@") ? w.source.slice("auto-describe-resolvers@".length) : "";
  let logged = false;
  try { logged = readFileSync(join(d1, "auto-describe.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l)).some((l) => l.shape === "boardLayout_write" && l.run === run); } catch { /* no log */ }
  leg("each post names the tick and its run, and the log carries the same run", /^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(run) && logged);
  leg("a walk-minted composite and a shape no live vessel serves are not described",
    !["composedDeliverable_board_for_today", ...UNSERVED].some((s) => posts.some((p) => p.shape === s)));
  leg("an already-described shape is never posted", !posts.some((p) => p.shape in SEEDED) && descriptions["fx_surface:board_layout"] === SEEDED["fx_surface:board_layout"]);
  const n = posts.length; await tick(d1);
  leg("a second tick posts nothing (no churn)", posts.length === n);
  reset(); failDescRead = true; await tick(dir());
  leg("an unreadable description read posts nothing", posts.length === 0);
} catch (e) {
  failed++; console.log(`FAIL - the tick could not be driven: ${(e as Error).message}`);
}
server.stop(true);
console.log(`VERDICT ${failed === 0 ? "pass" : "fail"}`);
process.exit(failed === 0 ? 0 : 1);
TS
cd "$W" || { echo "FAIL - cd"; exit 1; }
timeout 120 "$BUN" "$W/drive.ts" > "$W/out" 2>&1; rc=$?
grep '^FAIL - ' "$W/out"
if [ "$rc" = 0 ] && grep -qx 'VERDICT pass' "$W/out"; then
  echo "ok - every advertised, undescribed served write is described from its advertisement; described shapes are untouched"; exit 0
fi
grep -q '^FAIL - ' "$W/out" || { echo "FAIL - the driver exited $rc with no verdict:"; tail -n 5 "$W/out" | sed 's/^/  /'; }
exit 1
