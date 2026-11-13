#!/usr/bin/env bash
# kind: known-valid
# The candidate walk-owner-seed.ts holds a clone to the repository the root wants changed: its git_worktree requires rows
# bind the call's own repo, and no other change tool's do. Run by shadow-eval.sh with CANDIDATE_DIR (see its header).
#
# WHY. The walk makes a clone (git_worktree) only when the root holds a change wanted or an open gap. Without the repo in
# the precondition, any root wanting any change could have a clone made of any repository, and did: a gap about one
# vessel's tests had clones of others made for it. The repo is a top-level field of the change_wanted judgment and of a
# detector's gap row, so the requires row can name it, bound to the call's own repo ({"x-pointer": "repo"}). Only
# git_worktree's pointer has a repo: binding another tool's row to it would close that tool for every root.
#
# HOW. The candidate seeder runs beside the candidate inventory, with DISCOVERY_URL pointed at a fixture-owned stand-in
# that serves record_read / record_write from memory, holding the rows the seeder wrote before this change. Legs:
#   - the latest git_worktree requires rows, for change_wanted and for gap, bind repo to the call's repo and keep what
#     they required before (wanted true; status open, latest per gap_id);
#   - the latest requires rows of every other change tool name no repo;
#   - over the earlier rows the run writes exactly two change-tool requires rows, both git_worktree's (each replaces the one before
#     for the same tool and shape);
#   - the change_wanted judge is told repo may be super, and that a change with no repo opens no clone;
#   - a second run writes nothing.
#
# NEEDS a bun that the shadow sandbox's nobody can execute. Without one this fails as "cannot judge", by design.
#
# SAFETY. Loopback only. The seeder reads only the inventory copy beside it and reaches only the stand-in.
set -uo pipefail
: "${CANDIDATE_DIR:?run by shadow-eval.sh}"
SEED="$CANDIDATE_DIR/scripts/substrate/walk-owner-seed.ts"
INV="$CANDIDATE_DIR/scripts/substrate/vessels.inventory.json"
BUN="$(command -v bun || echo /usr/local/bin/bun)"
[ -f "$SEED" ] || { echo "FAIL - the candidate has no scripts/substrate/walk-owner-seed.ts"; exit 1; }
[ -f "$INV" ] || { echo "FAIL - the candidate has no scripts/substrate/vessels.inventory.json"; exit 1; }
[ -n "$("$BUN" -e 'console.log(process.versions.bun ?? "")' 2>/dev/null)" ] \
  || { echo "FAIL - cannot judge: no bun at $BUN (a skip would read as a pass)"; exit 1; }
W="$(mktemp -d "${TMPDIR:-/tmp}/fx-walk-owner-clone.XXXXXX")" || { echo "FAIL - mktemp"; exit 1; }
trap 'rm -rf "$W"' EXIT
mkdir -p "$W/run"
cp "$SEED" "$W/run/walk-owner-seed.ts"
cp "$INV" "$W/run/vessels.inventory.json"
cat > "$W/drive.ts" <<'TS'
// drive.ts: prints one "FAIL - <leg>" line per broken leg and "VERDICT pass|fail".
const KEY = `mb-walkclonefixture-${"k".repeat(32)}`;
type Row = Record<string, any>;
const rows: Row[] = [];
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
const put = (row: Row, writer = "owner", role = "owner") => { const r = { ...row, id: `row-${rows.length + 1}`, seq: rows.length + 1, writer, role }; rows.push(r); return r; };
const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: async (req) => {
  const path = new URL(req.url).pathname;
  const pointer = (((await req.json().catch(() => ({}))) as Row).pointer ?? {}) as Row;
  if (path !== "/resolve") return json({ error: "not found" }, 404);
  if (pointer.type === "record_read") {
    const where = (pointer.where ?? {}) as Row;
    return json(rows.filter((r) => r.shape === pointer.shape).filter((r) => Object.entries(where).every(([k, v]) => String(r[k]) === String(v))));
  }
  if (pointer.type === "record_write") return json(put(pointer.row as Row, pointer.writer, pointer.role));
  return json({ error: "Not found", shape: pointer.type }, 404);
} });
const dir = `${import.meta.dir}/run`;
const run = async () => {
  const p = Bun.spawn([process.execPath, `${dir}/walk-owner-seed.ts`], {
    env: { PATH: process.env.PATH ?? "", DISCOVERY_URL: `http://127.0.0.1:${server.port}`, METABOB_API_KEY: KEY },
    stdout: "pipe", stderr: "pipe",
  });
  const code = await p.exited;
  return { code, out: (await new Response(p.stdout).text()) + (await new Response(p.stderr).text()) };
};
let failed = 0;
const leg = (ok: boolean, what: string) => { if (!ok) { failed++; console.log(`FAIL - ${what}`); } };
// The change tools and the rows the seeder wrote for them before this change, as a node's records holds them.
const TOOLS = ["git_worktree", "fs_edit", "fs_write", "code_replace_lines", "code_insert_after_line", "code_add_import", "git_commit", "git_land"];
for (const t of TOOLS) {
  put({ shape: "requires", for: t, needs: "change_wanted", where: { wanted: true }, input_refs: [] });
  put({ shape: "requires", for: t, needs: "gap", where: { status: "open" }, latest_by: "gap_id", input_refs: [] });
}
const before = rows.length;
const first = await run();
leg(first.code === 0, `the seeder exits 0 (exit ${first.code}: ${first.out.split("\n").slice(-3).join(" | ").slice(0, 300)})`);
const latest = (tool: string, needs: string) => rows.filter((r) => r.shape === "requires" && r.for === tool && r.needs === needs).at(-1);
const bound = (r: Row | undefined) => JSON.stringify(r?.where?.repo) === JSON.stringify({ "x-pointer": "repo" });
const cw = latest("git_worktree", "change_wanted");
leg(!!cw && bound(cw) && cw.where.wanted === true && cw.role === "owner", `git_worktree's change_wanted row binds repo to the call's and still needs wanted true (got ${JSON.stringify(cw?.where)})`);
const gap = latest("git_worktree", "gap");
leg(!!gap && bound(gap) && gap.where.status === "open" && gap.latest_by === "gap_id" && gap.role === "owner",
  `git_worktree's gap row binds repo to the call's and still needs an open gap, latest per gap_id (got ${JSON.stringify(gap?.where)}, ${gap?.latest_by})`);
for (const t of TOOLS.filter((t) => t !== "git_worktree")) for (const n of ["change_wanted", "gap"]) {
  const r = latest(t, n);
  leg(!!r && r.where?.repo === undefined, `${t}'s ${n} row names no repo (its pointer has none; got ${JSON.stringify(r?.where)})`);
}
const wrote = rows.slice(before).filter((r) => r.shape === "requires" && TOOLS.includes(r.for) && ["change_wanted", "gap"].includes(r.needs));
leg(wrote.length === 2 && wrote.every((r) => r.for === "git_worktree"),
  `over the earlier rows the run writes exactly git_worktree's two change requires rows (wrote ${wrote.map((r) => `${r.for}:${r.needs}`).join(",") || "none"})`);
const judge = rows.filter((r) => r.shape === "shape_schema" && r.target === "change_wanted" && String(r.variant ?? "") === "").at(-1);
const words = String(judge?.description ?? "");
leg(/\bsuper\b/.test(words) && /no repo opens no clone/.test(words), "the change_wanted judge is told repo may be super, and that a change with no repo opens no clone");
const n = rows.length;
const second = await run();
leg(second.code === 0 && rows.length === n, `a second run writes nothing (wrote ${rows.length - n}, exit ${second.code})`);
server.stop(true);
console.log(`VERDICT ${failed === 0 ? "pass" : "fail"}`);
process.exit(failed === 0 ? 0 : 1);
TS
out="$(cd "$W" && "$BUN" "$W/drive.ts" 2>&1)"; rc=$?
printf '%s\n' "$out" | grep -E '^FAIL - ' || true
if [ "$rc" -eq 0 ] && printf '%s\n' "$out" | grep -q '^VERDICT pass$'; then
  echo "ok - walk-owner-seed.ts holds a clone to the repository the root's change_wanted or open gap names, and binds no other change tool to a repo"
  exit 0
fi
printf '%s\n' "$out" | grep -q '^VERDICT ' || echo "FAIL - the drive did not finish: $(printf '%s' "$out" | tail -3 | tr '\n' '|' | cut -c1-300)"
exit 1
