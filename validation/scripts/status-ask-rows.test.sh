#!/usr/bin/env bash
# substrate-status --ask-rows <id> prints the rows records holds for one ask's root, so a usable miss (the walk's grade of
# the known-answer ask) can be read after the fleet is gone: install acceptance keeps them. Against a stand-in discovery:
#   (a) MUST-FAIL: the ask, every row naming it as root, and its calls, one JSON row per line, each once (a row two reads
#       return is printed once), in seq order
#   (b) MUST-FAIL: it reads only, through discovery under the node's own key: no record_write is sent
#   (c) no id is a usage error, exit 2
#   (d) MUST-FAIL: a read records refuses is printed first as its own line ({read_failed, answer}), and the other reads'
#       rows still follow: an empty file is never what a failed read leaves
#   (e) discovery unreachable: each of the three reads is a read_failed line, answer null, exit 0
# usage: validation/scripts/status-ask-rows.test.sh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STATUS="$ROOT/scripts/substrate/substrate-status.sh"
T="$(mktemp -d "${TMPDIR:-/tmp}/status-ask-rows.XXXXXX")"; trap 'kill "${SRV:-}" 2>/dev/null; rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
command -v bun >/dev/null 2>&1 || { echo "FAIL - bun is not on PATH (the stand-in discovery runs on it)"; exit 1; }

KEY=fixture-node-key-0001
cat > "$T/disc.ts" <<'EOF'
import { appendFileSync, existsSync } from "node:fs"
const dir = process.argv[2]
const ask = { id: "ask-1", seq: 10, shape: "world_changed", role: "owner" }
const sel = { id: "sel-1", seq: 11, shape: "selection", root: "ask-1" }
const out = { id: "out-1", seq: 14, shape: "outcome", role: "described", root: "ask-1", r: 0, why: "no answer states a count" }
const s = Bun.serve({ port: 0, async fetch(r) {
  const b: any = await r.json().catch(() => ({}))
  const p = b?.pointer ?? {}
  appendFileSync(`${dir}/seen.jsonl`, JSON.stringify({ auth: r.headers.get("authorization"), pointer: p }) + "\n")
  if (p.type !== "record_read") return Response.json({ failure: { status: 400, body: "unexpected" } }, { status: 400 })
  if (Array.isArray(p.ids)) return Response.json({ body: p.ids.includes("ask-1") ? [ask] : [] })
  if (p.where?.root === "ask-1" && existsSync(`${dir}/refuse`)) return Response.json({ failure: { status: 403, body: "refused" } }, { status: 403 })
  if (p.where?.root === "ask-1") return Response.json({ body: [out, sel] })               // newest first: printed by seq
  // calls carry a call_id and no id, as records' calls do
  if (p.root === "ask-1" && p.calls === "all") return Response.json({ body: [{ call_id: "c-2", seq: 13, state: "ended", type: "record_read" }, { call_id: "c-1", seq: 12, state: "failed", type: "answer" }, sel] })
  return Response.json({ body: [] })
} })
console.log(s.port)
EOF
bun "$T/disc.ts" "$T" > "$T/port" 2>"$T/srv.err" & SRV=$!
for _ in $(seq 1 50); do [ -s "$T/port" ] && break; sleep 0.1; done
PORT="$(head -1 "$T/port")"
[ -n "$PORT" ] || { echo "FAIL - the stand-in discovery did not start: $(cat "$T/srv.err")"; exit 1; }
printf 'METABOB_API_KEY=%s\nDISCOVERY_ENDPOINT=http://127.0.0.1:%s\n' "$KEY" "$PORT" > "$T/env"

: > "$T/seen.jsonl"
OUT="$(SUBSTRATE_ENV_FILE="$T/env" timeout 30 bash "$STATUS" --ask-rows ask-1 2>/dev/null)"; RC=$?
GOT="$(printf '%s\n' "$OUT" | jq -sc 'map(.id // .call_id)' 2>/dev/null)"
if [ "$RC" = 0 ] && [ "$GOT" = '["ask-1","sel-1","c-1","c-2","out-1"]' ]; then
  ok "(a) the ask, its root's rows and its calls, each once, in seq order"
else bad "(a) rc=$RC rows=$GOT"; fi
if ! grep -q '"record_write"' "$T/seen.jsonl" && [ "$(jq -r '.auth' "$T/seen.jsonl" | sort -u)" = "ApiKey $KEY" ] && [ "$(wc -l < "$T/seen.jsonl")" -ge 3 ]; then
  ok "(b) reads only, each under the node's own key"
else bad "(b) $(cut -c1-200 "$T/seen.jsonl" | head -5)"; fi
SUBSTRATE_ENV_FILE="$T/env" timeout 30 bash "$STATUS" --ask-rows >/dev/null 2>&1; RC=$?
[ "$RC" = 2 ] && ok "(c) no ask id is a usage error" || bad "(c) rc=$RC"
touch "$T/refuse"
OUT="$(SUBSTRATE_ENV_FILE="$T/env" timeout 30 bash "$STATUS" --ask-rows ask-1 2>/dev/null)"; RC=$?
rm -f "$T/refuse"
FIRST="$(printf '%s
' "$OUT" | head -1 | jq -c '[.read_failed.where.root, .answer.failure.status]' 2>/dev/null)"
REST="$(printf '%s
' "$OUT" | tail -n +2 | jq -sc 'map(.id // .call_id)' 2>/dev/null)"
if [ "$RC" = 0 ] && [ "$FIRST" = '["ask-1",403]' ] && [ "$REST" = '["ask-1","sel-1","c-1","c-2"]' ]; then
  ok "(d) a refused read is its own line, first, and the other reads' rows follow"
else bad "(d) rc=$RC first=$FIRST rest=$REST"; fi
printf 'METABOB_API_KEY=%s\nDISCOVERY_ENDPOINT=http://127.0.0.1:%s\n' "$KEY" "$(bun -e 'const s = Bun.serve({ port: 0, fetch: () => new Response() }); console.log(s.port); s.stop(true)')" > "$T/env-down"
OUT="$(SUBSTRATE_ENV_FILE="$T/env-down" timeout 30 bash "$STATUS" --ask-rows ask-1 2>/dev/null)"; RC=$?
GOT="$(printf '%s\n' "$OUT" | jq -sc 'map([(.read_failed | keys_unsorted | map(select(. != "type")) | .[0]), .answer])' 2>/dev/null)"
if [ "$RC" = 0 ] && [ "$GOT" = '[["ids",null],["where",null],["root",null]]' ]; then
  ok "(e) discovery unreachable: each read is a read_failed line, answer null"
else bad "(e) rc=$RC got=$GOT"; fi
echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; }
echo "$FAILS FAILED"; exit 1
