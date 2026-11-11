#!/usr/bin/env bash
# walk-owner-seed.ts's request and due schemas, as the seeder writes them (driven against a stand-in discovery that
# serves records; loopback only, no key of the fleet):
#   (a) a request may name the next call (pointer) or decline (none); an empty one is neither;
#   (b) the request producer sees the answer and its grade (context answer, outcome), and is told a change is done only
#       when a git_land call ended;
#   (c) a due may run from a minute to a day: 3 h is allowed, 25 h refused;
#   (d) the due producer reads the grades people gave before (record_read outcome, role person);
#   (e) the answer producer is told a change is done only when a git_land call ended, and never to claim it before;
#   (f) the outcome grader is told an answer claiming a change with no ended git_land hop is r 0;
#   (g) and it can see the hops it is told to check;
#   (h) the request producer reads every gap row (open and closing alike), and is told a request names one next call
#       toward closing one, first a clone; that a gap's test file is not where to edit; and that a held gap is left;
#   (j) the request producer is told later calls on a change work in the cwd the clone's hop returned;
#   (i) the owner describes what a person reads of world_changed, answer and outcome rows: words what, text, r; an
#       older description already present without words is superseded by a later row.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SEED="$ROOT/scripts/substrate/walk-owner-seed.ts"
BUN="$(command -v bun || echo /usr/local/bin/bun)"
[ -n "$("$BUN" -e 'console.log(process.versions.bun ?? "")' 2>/dev/null)" ] || { echo "FAIL - cannot judge: no bun at $BUN"; exit 1; }
W="$(mktemp -d "${TMPDIR:-/tmp}/seed-request-due.XXXXXX")" || { echo "FAIL - mktemp"; exit 1; }
trap 'rm -rf "$W"' EXIT
cp "$SEED" "$W/walk-owner-seed.ts"
cat > "$W/drive.ts" <<'TS'
type Row = Record<string, any>;
// A stale owner description already present (an older answer description, without words): the seeder must supersede
// it with a later row, since readers take the latest row per shape it describes.
const rows: Row[] = [{ shape: "shape_description", of: "answer", description: "older wording", id: "row-0", input_refs: [] }];
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(req) {
  const pointer = (((await req.json().catch(() => ({}))) as Row).pointer ?? {}) as Row;
  if (pointer.type === "record_read") return json(rows.filter((r) => r.shape === pointer.shape));
  if (pointer.type === "record_write") { const row = { ...pointer.row, id: `row-${rows.length + 1}` }; rows.push(row); return json(row); }
  return json({ error: "Not found" }, 404);
} });
const p = Bun.spawn([process.execPath, `${import.meta.dir}/walk-owner-seed.ts`], {
  env: { PATH: process.env.PATH ?? "", DISCOVERY_URL: `http://127.0.0.1:${server.port}`, METABOB_API_KEY: "mb-test-" + "k".repeat(32) },
  stdout: "pipe", stderr: "pipe",
});
const killer = setTimeout(() => p.kill(), 60_000);
const code = await p.exited;
clearTimeout(killer);
server.stop(true);
let failed = 0;
const leg = (ok: boolean, what: string) => { console.log(`${ok ? "ok  " : "FAIL"} - ${what}`); if (!ok) failed++; };
const schema = (t: string) => rows.find((r) => r.shape === "shape_schema" && r.target === t);
// The few JSON Schema rules these schemas use: type object, required, anyOf of required, number bounds.
const fits = (s: Row, v: Row): boolean => {
  if (s.type === "object" && (typeof v !== "object" || v === null)) return false;
  if ((s.required ?? []).some((k: string) => !(k in v))) return false;
  if (s.anyOf && !s.anyOf.some((alt: Row) => fits(alt, v))) return false;
  for (const [k, sub] of Object.entries((s.properties ?? {}) as Record<string, Row>)) {
    if (!(k in v)) continue;
    if (sub.type === "number" && (typeof v[k] !== "number" || (sub.minimum !== undefined && v[k] < sub.minimum) || (sub.maximum !== undefined && v[k] > sub.maximum))) return false;
    if (sub.type === "string" && (typeof v[k] !== "string" || (sub.minLength !== undefined && v[k].length < sub.minLength))) return false;
    if (sub.type === "object" && !fits(sub, v[k])) return false;
  }
  return true;
};
leg(code === 0, `the seeder wrote its rows (exit ${code})`);
const req = schema("request");
const due = schema("due");
leg(!!req && fits(req.schema, { pointer: { type: "git_worktree" } }) && fits(req.schema, { none: "already answered" }) && !fits(req.schema, {}),
  "(a) a request names a call or declines; an empty one is neither");
leg(!!req && ["answer", "outcome"].every((s) => (req.context ?? []).includes(s)) && String(req.description).includes("git_land call that ended"),
  "(b) the request producer sees the answer and its grade, and is told when a change is done");
leg(!!due && fits(due.schema, { at: 0, within_ms: 3 * 3_600_000 }) && !fits(due.schema, { at: 0, within_ms: 25 * 3_600_000 }) && !fits(due.schema, { at: 0, within_ms: 59_000 }),
  "(c) a due runs from a minute to a day");
leg(!!due && (due.reads ?? []).some((r: Row) => r.type === "record_read" && r.shape === "outcome" && r.where?.role === "person"),
  "(d) the due producer reads the grades people gave before");
const answer = schema("answer");
const outcome = schema("outcome");
leg(!!answer && String(answer.description).includes("git_land call that ended") && String(answer.description).includes("never that it was done"),
  "(e) the answer producer never claims a change before it landed");
leg(!!outcome && String(outcome.description).includes("claims a change with no hop row showing a git_land call that ended is r 0"),
  "(f) the outcome grader grades a claimed but unlanded change r 0");
leg(!!outcome && (outcome.context ?? []).includes("hop"), "(g) the outcome grader sees the hops it is told to check");
leg(!!req && (req.reads ?? []).some((r: Row) => r.type === "record_read" && r.shape === "gap" && r.where === undefined)
  && String(req.description).includes("whose status is closed is already closed") && String(req.description).includes("first a clone of the repo the gap names")
  && String(req.description).includes("not the place to edit: the fix is in the source it checks")
  && String(req.description).includes("operator_hold is held: leave it"),
  "(h) the request producer sees every gap row and is told to ask one next call toward closing one");
const words = (of: string) => rows.filter((r) => r.shape === "shape_description" && r.of === of).at(-1)?.words;
leg(JSON.stringify([words("world_changed"), words("answer"), words("outcome")]) === JSON.stringify([["what"], ["text"], ["r"]]),
  "(i) the owner's descriptions name the words a person reads: what, text, r (a stale one superseded by a later row)");
leg(!!req && String(req.description).includes("the cwd the clone's hop returned, never a repos/ path"),
  "(j) later calls on a change work in the clone's cwd, not a repos/ path");
process.exit(failed === 0 ? 0 : 1);
TS
out="$(cd "$W" && "$BUN" "$W/drive.ts" 2>&1)"; rc=$?
printf '%s\n' "$out" | grep -E '^(ok  |FAIL) - '
[ "$rc" -eq 0 ] && { echo; echo PASS; exit 0; }
echo; echo "FAILED"; exit 1
