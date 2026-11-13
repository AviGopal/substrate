#!/usr/bin/env bash
# kind: known-valid
# The candidate walk-owner-seed.ts writes one owner `repository` row per repository the candidate vessels.inventory.json
# names, and the change_wanted judge is shown them. Run by shadow-eval.sh with CANDIDATE_DIR (see its header).
#
# WHY. The change_wanted judge decides whether a person's ask is a change to files. Shown the ask alone it read nearly
# every ask as "not files", since a person names a vessel or what it shows, never a repository. The repository rows are
# what it is shown instead, derived from the inventory, so the inventory itself must reach the run dir when it changes:
# that needs coverage at level behaviour, and that needs a fixture that judges the rows the inventory makes.
#
# HOW. The candidate seeder runs beside a copy of the candidate inventory, as the boot seed lays them out in the run dir,
# with DISCOVERY_URL pointed at a fixture-owned stand-in that serves record_read / record_write from memory. Legs:
#   - the candidate inventory names at least one repository with a unit that is not retired;
#   - one row of shape repository per repository the inventory names, written owner, with the units built from it, their
#     roles, and retired true exactly when every one of its units is retired;
#   - the change_wanted shape_schema shows the repository rows as context, latest per repo;
#   - a second run writes nothing;
#   - after one repository's units are retired in the inventory, the next run writes exactly one row: that repository's,
#     now retired;
#   - after another repository is removed from the inventory altogether, the next run writes exactly one row: that
#     repository's, retired, with no units.
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
W="$(mktemp -d "${TMPDIR:-/tmp}/fx-walk-owner-repos.XXXXXX")" || { echo "FAIL - mktemp"; exit 1; }
trap 'rm -rf "$W"' EXIT
mkdir -p "$W/run"
cp "$SEED" "$W/run/walk-owner-seed.ts"
cp "$INV" "$W/run/vessels.inventory.json"
cat > "$W/drive.ts" <<'TS'
// drive.ts: prints one "FAIL - <leg>" line per broken leg and "VERDICT pass|fail".
const KEY = `mb-walkreposfixture-${"k".repeat(32)}`;
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
// What the inventory says, read here on its own terms: each repository, the units naming it, their roles, and whether
// every one of them is retired.
const expected = (inv: Row): Map<string, Row> => {
  const m = new Map<string, Row>();
  for (const u of Array.isArray(inv?.vessels) ? inv.vessels : []) {
    if (typeof u?.repo !== "string" || !u.repo || typeof u.unit !== "string") continue;
    const e = m.get(u.repo) ?? { units: [] as string[], roles: new Set<string>(), retired: true };
    e.units.push(u.unit);
    if (typeof u.role === "string" && u.role) e.roles.add(u.role);
    e.retired = e.retired && u.retired === true;
    m.set(u.repo, e);
  }
  return m;
};
const latest = (repo: string) => rows.filter((r) => r.shape === "repository" && r.repo === repo).at(-1);
const agrees = (repo: string, e: Row) => {
  const r = latest(repo);
  return !!r && r.role === "owner" && r.writer === "owner"
    && JSON.stringify(r.units) === JSON.stringify([...e.units].sort())
    && JSON.stringify(r.roles) === JSON.stringify([...e.roles].sort())
    && r.retired === e.retired;
};
const inv = await Bun.file(`${dir}/vessels.inventory.json`).json().catch(() => null);
const want = expected(inv);
const live = [...want.entries()].filter(([, e]) => !e.retired);
leg(live.length > 0, `the candidate inventory names a repository with a unit that is not retired (names ${want.size} repositories, ${live.length} live)`);
const first = await run();
leg(first.code === 0, `the seeder exits 0 (exit ${first.code}: ${first.out.split("\n").slice(-3).join(" | ").slice(0, 300)})`);
const got = new Set(rows.filter((r) => r.shape === "repository").map((r) => r.repo));
leg(got.size === want.size && [...want.keys()].every((k) => got.has(k)), `one repository row per repository the inventory names (want ${want.size}, got ${got.size})`);
for (const [repo, e] of want) leg(agrees(repo, e), `the ${repo} row holds the inventory's units, roles and retired state, written owner`);
const judge = rows.filter((r) => r.shape === "shape_schema" && r.target === "change_wanted" && String(r.variant ?? "") === "").at(-1);
leg(!!judge && (judge.context ?? []).some((c: Row) => c?.shape === "repository" && c?.latest_by === "repo"), "the change_wanted schema shows the repository rows, latest per repo");
const before = rows.length;
const second = await run();
leg(second.code === 0 && rows.length === before, `a second run writes nothing (wrote ${rows.length - before}, exit ${second.code})`);
// Retire one live repository's units in the inventory beside the seeder, as an inventory change reaching the run dir.
if (live.length > 0) {
  const [gone] = live[0]!;
  const changed = { ...inv, vessels: inv.vessels.map((u: Row) => (u?.repo === gone ? { ...u, retired: true } : u)) };
  await Bun.write(`${dir}/vessels.inventory.json`, JSON.stringify(changed));
  const n = rows.length;
  const third = await run();
  const added = rows.slice(n);
  leg(third.code === 0 && added.length === 1 && added[0]?.shape === "repository" && added[0]?.repo === gone && added[0]?.retired === true,
    `after ${gone} is retired in the inventory the next run writes exactly its row, retired (wrote ${added.map((r) => `${r.shape}:${r.repo ?? r.target ?? ""}`).join(",") || "nothing"})`);
}
// Remove another live repository from the inventory altogether, as the fleet retires most things.
if (live.length > 1) {
  const [removed] = live[1]!;
  const now = await Bun.file(`${dir}/vessels.inventory.json`).json();
  await Bun.write(`${dir}/vessels.inventory.json`, JSON.stringify({ ...now, vessels: now.vessels.filter((u: Row) => u?.repo !== removed) }));
  const n = rows.length;
  const fourth = await run();
  const added = rows.slice(n);
  leg(fourth.code === 0 && added.length === 1 && added[0]?.shape === "repository" && added[0]?.repo === removed && added[0]?.retired === true
    && JSON.stringify(added[0]?.units) === "[]",
    `after ${removed} is removed from the inventory the next run writes exactly its row, retired with no units (wrote ${added.map((r) => `${r.shape}:${r.repo ?? r.target ?? ""}:${r.retired}`).join(",") || "nothing"})`);
} else leg(false, "the inventory names a second live repository, to remove one");
server.stop(true);
console.log(`VERDICT ${failed === 0 ? "pass" : "fail"}`);
process.exit(failed === 0 ? 0 : 1);
TS
out="$(cd "$W" && "$BUN" "$W/drive.ts" 2>&1)"; rc=$?
printf '%s\n' "$out" | grep -E '^FAIL - ' || true
if [ "$rc" -eq 0 ] && printf '%s\n' "$out" | grep -q '^VERDICT pass$'; then
  echo "ok - walk-owner-seed.ts writes one owner repository row per repository the inventory names, shows them to the change_wanted judge, and follows an inventory change"
  exit 0
fi
printf '%s\n' "$out" | grep -q '^VERDICT ' || echo "FAIL - the drive did not finish: $(printf '%s' "$out" | tail -3 | tr '\n' '|' | cut -c1-300)"
exit 1
