#!/usr/bin/env bash
# walk-owner-seed-denied-models.test.sh: the owner seed writes llm-resolver's denied_models (the USER, 11-15: "No free
# endpoints") by the class's own marker only when the policy has never set it; a value the owner set, this or another,
# is left (a rerun writes nothing); a node with no llm-resolver, or one that cannot take the field yet, still seeds
# (driven against a stand-in discovery; loopback only, no fleet key).
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SEED="$ROOT/scripts/substrate/walk-owner-seed.ts"
BUN="$(command -v bun || echo /usr/local/bin/bun)"
[ -n "$("$BUN" -e 'console.log(process.versions.bun ?? "")' 2>/dev/null)" ] || { echo "FAIL - cannot judge: no bun at $BUN"; exit 1; }
W="$(mktemp -d "${TMPDIR:-/tmp}/seed-denied-models.XXXXXX")" || { echo "FAIL - mktemp"; exit 1; }
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
const first = await seed();
const firstWrites = writes.length;
const again = await seed();
const againWrites = writes.length;
// the owner changes the policy through its own write: the next boot must not put the seed's value back (research)
policy.denied_models = ["owner-chosen"];
const owned = await seed();
const ownedWrites = writes.length;
const ownedValue = JSON.stringify(policy.denied_models); // read now: the legs below change the policy
mode = "absent";
const absent = await seed();
mode = "old"; delete policy.denied_models;
const old = await seed();
server.stop(true);
let failed = 0;
const leg = (ok: boolean, what: string) => { console.log(`${ok ? "ok  " : "FAIL"} - ${what}`); if (!ok) failed++; };
leg(first === 0 && firstWrites === 1 && JSON.stringify(writes[0]?.denied_models) === JSON.stringify([":free"]),
  "(a) the seed writes the owner's model denial, by its class marker, when the policy lacks it");
leg(again === 0 && againWrites === 1, "(b) run again, the denial already in force: nothing written (idempotent)");
leg(owned === 0 && ownedWrites === 1 && ownedValue === JSON.stringify(["owner-chosen"]),
  "(e) a value the owner set (another one) survives the next boot: the seed writes only when the field was never set");
leg(absent === 0, "(c) a node with no llm-resolver: the seed still succeeds (the denial is skipped, logged)");
leg(old === 0 && writes.length === 2, "(d) an llm-resolver that refuses the field: the seed still succeeds (logged)");
process.exit(failed === 0 ? 0 : 1);
TS
cd "$W" && "$BUN" drive.ts
