#!/usr/bin/env bash
# substrate-status's known-answer goal is asked of the walk: an owner's world_changed row written into records through
# discovery under this node's own key, graded by the walk's outcome row for it. This runs the real `--probe goal`
# against a stand-in discovery and checks each way it can end:
#   the walk grades r 1                    -> pass, exit 0
#   the walk grades r 0                    -> fail, exit 1
#   no outcome within the bound (a walk that is masked, stopped or never answers)
#                                          -> unknown, exit 3, never a pass
#   records refuses an owner's ask from another node (a spoke) -> unknown, exit 3, with that reason
# and that the ask written is a world_changed row in the owner's role, under the node's own key.
#
# usage: validation/scripts/status-usable-walk.test.sh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STATUS="$ROOT/scripts/substrate/substrate-status.sh"
T="$(mktemp -d "${TMPDIR:-/tmp}/status-usable-walk.XXXXXX")"; trap 'kill "${SRV:-}" 2>/dev/null; rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
command -v bun >/dev/null 2>&1 || { echo "SKIP - bun is not on PATH (the stand-in discovery runs on it)"; exit 0; }

KEY=fixture-node-key-0001
# The stand-in discovery: records' answers by MODE (a file, so each case changes it without a restart); every request's
# Authorization and pointer are kept for the checks below.
cat > "$T/disc.ts" <<'EOF'
import { appendFileSync, readFileSync } from "node:fs"
const dir = process.argv[2]
const s = Bun.serve({ port: 0, async fetch(r) {
  const b: any = await r.json().catch(() => ({}))
  const p = b?.pointer ?? {}
  appendFileSync(`${dir}/seen.jsonl`, JSON.stringify({ auth: r.headers.get("authorization"), pointer: p }) + "\n")
  const mode = readFileSync(`${dir}/mode`, "utf8").trim()
  if (p.type === "record_write") {
    if (mode === "spoke") return Response.json({ body: { failure: { status: 403, body: "another node writes its own rows, never a person's, an operator's or this node's owner rows" } } })
    return Response.json({ body: { id: `ask-${mode}`, shape: "world_changed", seq: 1 } })
  }
  if (p.type === "record_read" && p.shape === "outcome") {
    const ask = p.where?.event_ref
    if (ask !== `ask-${mode}`) return Response.json({ body: [] })
    return Response.json({ body: mode === "r1" ? [{ id: "o-0", r: 0, event_ref: ask }, { id: "o-1", r: 1, event_ref: ask }] : mode === "r0" ? [{ id: "o-2", r: 0, event_ref: ask }] : [] })
  }
  return Response.json({ failure: { status: 400, body: "unexpected" } }, { status: 400 })
} })
console.log(s.port)
EOF
echo none > "$T/mode"
bun "$T/disc.ts" "$T" > "$T/port" 2>"$T/srv.err" & SRV=$!
for _ in $(seq 1 50); do [ -s "$T/port" ] && break; sleep 0.1; done
PORT="$(head -1 "$T/port")"
[ -n "$PORT" ] || { echo "FAIL - the stand-in discovery did not start: $(cat "$T/srv.err")"; exit 1; }
printf 'METABOB_API_KEY=%s\nDISCOVERY_ENDPOINT=http://127.0.0.1:%s\n' "$KEY" "$PORT" > "$T/env"

probe() { # <mode> -> RC and OUT
  echo "$1" > "$T/mode"; : > "$T/seen.jsonl"
  OUT="$(SUBSTRATE_ENV_FILE="$T/env" STATUS_GOAL_TIMEOUT=3 bash "$STATUS" --probe goal --json 2>/dev/null)"; RC=$?
}

probe r1
[ "$RC" = 0 ] && [ "$(jq -r .value <<<"$OUT")" = pass ] && ok "the walk's r 1 on the ask passes (exit 0)" || bad "r 1: exit $RC, $OUT"
w="$(jq -c 'select(.pointer.type == "record_write")' "$T/seen.jsonl" | head -1)"
[ "$(jq -r '[.pointer.row.shape, .pointer.role, .auth] | join(" ")' <<<"$w")" = "world_changed owner ApiKey $KEY" ] \
  && ok "the ask is a world_changed row in the owner's role, under the node's own key" || bad "the ask written was: $w"
[ -n "$(jq -r '.pointer.row.what // empty' <<<"$w")" ] && ok "the ask carries the known-answer goal as what" || bad "the ask has no what: $w"

probe r0
[ "$RC" = 1 ] && [ "$(jq -r .value <<<"$OUT")" = fail ] && ok "the walk's r 0 on the ask fails (exit 1)" || bad "r 0: exit $RC, $OUT"

# MUST-FAIL: no outcome ever written (the walk masked or never answering) never reads as a pass.
probe none
[ "$RC" = 3 ] && [ "$(jq -r .value <<<"$OUT")" = unknown ] && ok "[MUST-FAIL] no outcome within the bound is unknown (exit 3), never a pass" || bad "no outcome: exit $RC, $OUT"
[ "$(jq -r .dispatch_id <<<"$OUT")" = ask-none ] && ok "the unanswered ask is named, so the next --wait round polls it" || bad "no ask named: $OUT"

probe spoke
[ "$RC" = 3 ] && grep -q "takes no owner's ask" <<<"$OUT" && ok "a records that takes no owner's ask from here reads unknown, with the reason" || bad "spoke: exit $RC, $OUT"

[ "$FAILS" = 0 ] && { echo PASS; exit 0; }
echo "FAILED ($FAILS)"; exit 1
