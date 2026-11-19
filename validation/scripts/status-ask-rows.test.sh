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
#   (f) MUST-FAIL: a row the printed ones cite (input_refs) that names no root (a tool call's answer) is read by id and
#       printed, and so is what it cites in turn, each once, in seq order
#   (g) MUST-FAIL: cited rows are read for at most ASK_ROWS_ROUNDS rounds; what the bound leaves unread is said in a
#       line ({cited_unread: n}), never dropped silently
#   (h) MUST-FAIL: at most ASK_ROWS_IDS cited ids are read in all; the rest are counted in that line
#   (i) an id already printed or already asked is never asked again (a row citing back to one is no loop)
#   (j) each of uses, evidence_refs, event_ref and selection_ref is a citation as input_refs is
#   (k) MUST-FAIL: a citing field that holds one id, not a list (a form records accepts), is read as records reads it, and
#       its rows are printed; it never empties the output
#   (l) GUARD: a cited read answered with something that is not a list of rows is a read_failed line, the rows already
#       read are printed, and the output is never empty
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
import { appendFileSync, existsSync, readFileSync } from "node:fs"
const dir = process.argv[2]
const ask = { id: "ask-1", seq: 10, shape: "world_changed", role: "owner" }
const sel = { id: "sel-1", seq: 11, shape: "selection", root: "ask-1" }
const out = { id: "out-1", seq: 14, shape: "outcome", role: "described", root: "ask-1", r: 0, why: "no answer states a count" }
const s = Bun.serve({ port: 0, async fetch(r) {
  const b: any = await r.json().catch(() => ({}))
  const p = b?.pointer ?? {}
  appendFileSync(`${dir}/seen.jsonl`, JSON.stringify({ auth: r.headers.get("authorization"), pointer: p }) + "\n")
  if (p.type !== "record_read") return Response.json({ failure: { status: 400, body: "unexpected" } }, { status: 400 })
  if (Array.isArray(p.ids)) {
    // a cited read answered with something that is not a list of rows: one answer not a list, one a list of non-rows
    if (p.ids.includes("bad-1")) return Response.json({ body: "not rows" })
    if (p.ids.includes("bad-2")) return Response.json({ body: [7, "x", null, ["nested"]] })
    // rows that name no root: a tool call's answer (hop-1) and what it was made from (deep-1, which cites back),
    // a chain that never ends (n-N cites n-N+1), and rows cited only by one field each (k-*)
    const by: Record<string, any> = {
      "ask-1": ask,
      "hop-1": { id: "hop-1", seq: 12.5, shape: "vesselList", input_refs: ["deep-1", "ask-1"] },
      "deep-1": { id: "deep-1", seq: 9, shape: "registry_read", input_refs: ["hop-1"] },
      "k-uses": { id: "k-uses", seq: 20, shape: "x" }, "k-ev": { id: "k-ev", seq: 21, shape: "x" },
      "k-event": { id: "k-event", seq: 22, shape: "x" }, "k-sel": { id: "k-sel", seq: 23, shape: "x" },
    }
    const row = (i: string) => by[i] ?? (/^n-[0-9]+$/.test(i) ? { id: i, seq: 30 + Number(i.slice(2)), shape: "x", input_refs: [`n-${Number(i.slice(2)) + 1}`] } : undefined)
    return Response.json({ body: p.ids.map(row).filter(Boolean) })
  }
  if (p.where?.root === "ask-1" && existsSync(`${dir}/refuse`)) return Response.json({ failure: { status: 403, body: "refused" } }, { status: 403 })
  if (p.where?.root === "ask-1") {
    const cites: Record<string, object> = {
      cite: { input_refs: ["hop-1"] }, chain: { input_refs: ["n-1"] },
      wide: { input_refs: Array.from({ length: 250 }, (_, i) => `w-${i}`) },
      fields: { uses: ["k-uses"], evidence_refs: ["k-ev"], event_ref: "k-event", selection_ref: "k-sel" },
      // a citing field records accepts as one id, not a list (it reads every one as [x].flat())
      strings: { input_refs: "hop-1", uses: "k-uses", evidence_refs: "k-ev" },
      malformed: { input_refs: ["bad-1"], uses: ["bad-2"] },
    }
    const mode = existsSync(`${dir}/mode`) ? readFileSync(`${dir}/mode`, "utf8").trim() : ""
    return Response.json({ body: [{ ...out, ...(cites[mode] ?? {}) }, sel] })            // newest first: printed by seq
  }
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

# The cited rows: one run per mode, the ids reads it made kept apart.
cited() { # <mode> -> OUT, RC, IDS (every id the ids reads asked, in order, one per line)
  echo "$1" > "$T/mode"; : > "$T/seen.jsonl"
  OUT="$(SUBSTRATE_ENV_FILE="$T/env" timeout 60 bash "$STATUS" --ask-rows ask-1 2>/dev/null)"; RC=$?
  IDS="$(jq -r 'select(.pointer.ids) | .pointer.ids[]' "$T/seen.jsonl")"
  rm -f "$T/mode"
}
cited cite
GOT="$(printf '%s\n' "$OUT" | jq -sc 'map(.id // .call_id // (keys | join(",")))' 2>/dev/null)"
if [ "$RC" = 0 ] && [ "$GOT" = '["deep-1","ask-1","sel-1","c-1","hop-1","c-2","out-1"]' ]; then
  ok "(f) a cited row with no root, and what it cites, are read by id and printed, each once, in seq order"
else bad "(f) rc=$RC rows=$GOT"; fi
if [ "$(printf '%s\n' "$IDS" | sort | uniq -d)" = "" ] && [ "$(printf '%s\n' "$IDS" | grep -c '^ask-1$')" = 1 ] \
  && ! grep -q '"record_write"' "$T/seen.jsonl" && [ "$(jq -r '.auth' "$T/seen.jsonl" | sort -u)" = "ApiKey $KEY" ]; then
  ok "(i) no id is asked twice, a row citing back is no loop, and every read is a read under the node's own key"
else bad "(i) ids asked: $(printf '%s ' $IDS)"; fi
cited chain
GOT="$(printf '%s\n' "$OUT" | jq -sc '[.[] | select(has("cited_unread")) | .cited_unread]' 2>/dev/null)"
CH="$(printf '%s\n' "$OUT" | jq -sc '[.[] | .id // empty | select(startswith("n-"))]' 2>/dev/null)"
if [ "$RC" = 0 ] && [ "$GOT" = '[1]' ] && [ "$CH" = '["n-1","n-2","n-3"]' ]; then
  ok "(g) cited rows are read for three rounds, and the one the bound leaves unread is said ({cited_unread: 1})"
else bad "(g) rc=$RC unread=$GOT chain=$CH"; fi
cited wide
GOT="$(printf '%s\n' "$OUT" | jq -sc '[.[] | select(has("cited_unread")) | .cited_unread]' 2>/dev/null)"
if [ "$RC" = 0 ] && [ "$GOT" = '[50]' ] && [ "$(printf '%s\n' "$IDS" | grep -c '^w-')" = 200 ]; then
  ok "(h) at most 200 cited ids are read in all (beyond the three root reads); the 50 left are counted, not dropped silently"
else bad "(h) rc=$RC unread=$GOT w-ids asked=$(printf '%s\n' "$IDS" | grep -c '^w-')"; fi
cited fields
GOT="$(printf '%s\n' "$OUT" | jq -sc '[.[] | .id // empty | select(startswith("k-"))]' 2>/dev/null)"
[ "$RC" = 0 ] && [ "$GOT" = '["k-uses","k-ev","k-event","k-sel"]' ] \
  && ok "(j) uses, evidence_refs, event_ref and selection_ref each cite a row that is read" || bad "(j) rc=$RC rows=$GOT"

cited strings
GOT="$(printf '%s\n' "$OUT" | jq -sc 'map(.id // empty)' 2>/dev/null)"
[ "$RC" = 0 ] && [ "$GOT" = '["deep-1","ask-1","sel-1","hop-1","out-1","k-uses","k-ev"]' ] \
  && ok "(k) input_refs, uses and evidence_refs holding one id each are read as records reads them, and printed" || bad "(k) rc=$RC rows=$GOT"
cited malformed
GOT="$(printf '%s\n' "$OUT" | jq -sc 'map(.id // .call_id // (if has("read_failed") then "F:" + (.answer | tostring) else keys[0] end))' 2>/dev/null)"
[ "$RC" = 0 ] && [ "$GOT" = '["F:not rows","ask-1","sel-1","c-1","c-2","out-1"]' ] \
  && ok "(l) a cited read that answers no list of rows is a read_failed line; the rows already read are printed" || bad "(l) rc=$RC rows=$GOT"

echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; }
echo "$FAILS FAILED"; exit 1
