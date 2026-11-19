#!/usr/bin/env bash
# substrate-status's known-answer goal is asked of the walk: an owner's world_changed row written into records through
# discovery under this node's own key, graded by the walk's outcome row for it. This runs the real `--probe goal`
# against a stand-in discovery and checks each way it can end:
#   the walk's grader gives r 1 and the answer states the registry's count -> pass, exit 0
#   it gives r 1 but the answer states another number (a hollow completion) -> fail, exit 1
#   an r 1 in any role but the walk's grader's is not its grade -> no pass
#   the walk grades r 0                    -> fail, exit 1
#   no outcome within the bound (a walk that is masked, stopped or never answers)
#                                          -> unknown, exit 3, never a pass
#   records refuses an owner's ask from another node (a spoke) -> unknown, exit 3, with that reason
#   the --json verdict's usable level names the ask it polled (ask_id), and install acceptance reads that field (both
#   level forms; none when usable names none)
#   and install acceptance's block asks for that ask's rows and keeps them redacted, one JSON row per line, stderr
#   apart; with no ask_id it writes the line that says so and asks nothing
#   and a value shaped as a credential the secrets scan names, which the run was never given (a key minted inside the
#   container, in a tool's answer), is masked in those rows and their stderr too
# and that the ask written is a world_changed row in the owner's role, under the node's own key; and that on a fleet
# not declared an acceptance install the ask is not written at all unless --plant-ask names the effect.
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
  if (p.type === "vesselRegistry") return Response.json({ content: { vessels: [{ vesselId: "a" }, { vesselId: "b" }, { vesselId: "c" }] } })
  if (p.type === "record_read" && Array.isArray(p.ids)) {
    const said: Record<string, string> = { "ans-right": "There are 3 vessels registered.", "ans-wrong": "There are 7 vessels registered.", "ans-inside": "There are 13 vessels, last seen 2030-11-14." }
    return Response.json({ body: p.ids.filter((i: string) => i in said).map((i: string) => ({ id: i, shape: "answer", text: said[i] })) })
  }
  if (p.type === "record_write") {
    if (mode === "spoke") return Response.json({ body: { failure: { status: 403, body: "another node writes its own rows, never a person's, an operator's or this node's owner rows" } } })
    return Response.json({ body: { id: `ask-${mode}`, shape: "world_changed", seq: 1 } })
  }
  if (p.type === "record_read" && p.shape === "outcome") {
    const ask = p.where?.event_ref
    if (ask !== `ask-${mode}`) return Response.json({ body: [] })
    const o = (id: string, r: number, ans: string, role = "described") => ({ id, r, role, event_ref: ask, evidence_refs: [ans] })
    return Response.json({ body: mode === "r1" ? [o("o-0", 0, "ans-wrong"), o("o-1", 1, "ans-right")]
      : mode === "r1wrong" ? [o("o-3", 1, "ans-wrong")]
      : mode === "r1inside" ? [o("o-5", 1, "ans-inside")]
      : mode === "r1walk" ? [o("o-4", 1, "ans-right", "walk")]
      : mode === "r0" ? [o("o-2", 0, "ans-wrong")] : [] })
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
printf 'METABOB_API_KEY=%s\nDISCOVERY_ENDPOINT=http://127.0.0.1:%s\nSUBSTRATE_ACCEPTANCE=1\n' "$KEY" "$PORT" > "$T/env"
printf 'METABOB_API_KEY=%s\nDISCOVERY_ENDPOINT=http://127.0.0.1:%s\n' "$KEY" "$PORT" > "$T/env-live"

probe() { # <mode> [env file] [args...] -> RC and OUT
  local m=$1 e=${2:-$T/env}; shift; [ $# -gt 0 ] && shift
  echo "$m" > "$T/mode"; : > "$T/seen.jsonl"
  OUT="$(SUBSTRATE_ENV_FILE="$e" STATUS_GOAL_TIMEOUT=3 bash "$STATUS" --probe goal --json "$@" 2>/dev/null)"; RC=$?
}
writes() { jq -c 'select(.pointer.type == "record_write")' "$T/seen.jsonl" | grep -c . ; }

probe r1
[ "$RC" = 0 ] && [ "$(jq -r .value <<<"$OUT")" = pass ] && ok "the walk's r 1 on the ask, its answer stating the registry's count, passes (exit 0)" || bad "r 1: exit $RC, $OUT"
w="$(jq -c 'select(.pointer.type == "record_write")' "$T/seen.jsonl" | head -1)"
[ "$(jq -r '[.pointer.row.shape, .pointer.role, .auth] | join(" ")' <<<"$w")" = "world_changed owner ApiKey $KEY" ] \
  && ok "the ask is a world_changed row in the owner's role, under the node's own key" || bad "the ask written was: $w"
[ -n "$(jq -r '.pointer.row.what // empty' <<<"$w")" ] && ok "the ask carries the known-answer goal as what" || bad "the ask has no what: $w"

# MUST-FAIL: r 1 is the walk saying it is done; an answer with another number is a hollow completion.
probe r1wrong
[ "$RC" = 1 ] && grep -q "hollow completion" <<<"$OUT" && ok "[MUST-FAIL] an r 1 whose answer states another number fails (exit 1)" || bad "hollow r 1: exit $RC, $OUT"

# MUST-FAIL: the count stated only inside another number ("13", a date) is not the count.
probe r1inside
[ "$RC" = 1 ] && grep -q "hollow completion" <<<"$OUT" && ok "[MUST-FAIL] the right number only inside another token (13, a date) fails" || bad "count inside a token: exit $RC, $OUT"

# MUST-FAIL: an r 1 under a role other than the walk's grader's is not the walk's grade.
probe r1walk
[ "$RC" != 0 ] && ok "[MUST-FAIL] an r 1 in another role does not pass (exit $RC)" || bad "r 1 in role walk passed: $OUT"

probe r0
[ "$RC" = 1 ] && [ "$(jq -r .value <<<"$OUT")" = fail ] && ok "the walk's r 0 on the ask fails (exit 1)" || bad "r 0: exit $RC, $OUT"

# MUST-FAIL: no outcome ever written (the walk masked or never answering) never reads as a pass.
probe none
[ "$RC" = 3 ] && [ "$(jq -r .value <<<"$OUT")" = unknown ] && ok "[MUST-FAIL] no outcome within the bound is unknown (exit 3), never a pass" || bad "no outcome: exit $RC, $OUT"
[ "$(jq -r .dispatch_id <<<"$OUT")" = ask-none ] && ok "the unanswered ask is named, so the next --wait round polls it" || bad "no ask named: $OUT"

probe spoke
[ "$RC" = 3 ] && grep -q "takes no owner's ask" <<<"$OUT" && ok "a records that takes no owner's ask from here reads unknown, with the reason" || bad "spoke: exit $RC, $OUT"

# MUST-FAIL: a fleet not declared an acceptance install gets no ask planted in its live records.
probe r1 "$T/env-live"
[ "$RC" = 3 ] && grep -q "not asked" <<<"$OUT" && [ "$(writes)" = 0 ] && ok "[MUST-FAIL] an undeclared fleet is not asked (exit 3) and nothing is written" || bad "undeclared: exit $RC, writes $(writes), $OUT"
probe r1 "$T/env-live" --plant-ask
[ "$RC" = 0 ] && [ "$(writes)" = 1 ] && ok "--plant-ask names the effect and asks on an undeclared fleet" || bad "--plant-ask: exit $RC, writes $(writes), $OUT"

# The verdict's usable level names the ask it polled as a field (ask_id), and install acceptance reads that field, never
# the evidence's words. The level builder is taken from the script and run with its inputs stubbed.
sed -n '/^level_rows() {/,/^}/p' "$STATUS" > "$T/levels.sh"
LV() { bash -c 'declare -A VAL EVID; LEVELS="live seeded served usable connected"; for l in $LEVELS; do VAL[$l]=pass; EVID[$l]="e $l"; done
  GOAL_LAST_ID="$1"; . "$2"; level_rows' _ "$1" "$T/levels.sh" 2>/dev/null; }
GOT="$(LV ask-r0 | jq -c '[.[] | select(has("ask_id")) | [.level, .ask_id]]' 2>/dev/null)"
[ "$GOT" = '[["usable","ask-r0"]]' ] && ok "[MUST-FAIL] the usable level, and only it, names the ask it polled (ask_id)" || bad "ask_id on levels: $GOT"
GOT="$(LV "" | jq -c '[.[] | select(has("ask_id"))] | length' 2>/dev/null)"
[ "$GOT" = 0 ] && ok "no ask polled: no ask_id on any level" || bad "no ask: $GOT"
READ="$ROOT/scripts/substrate/acceptance/usable-ask-id.jq"
rd() { printf '%s' "$1" | jq -r -f "$READ" 2>/dev/null; }
L='{"level":"live","value":"pass","evidence":"x"}'
A1="$(rd '{"levels":['"$L"',{"level":"usable","value":"fail","evidence":"the walk graded ask feed r 0","ask_id":"ask-9"}]}')"
A2="$(rd '{"levels":{"live":{"value":"pass"},"usable":{"value":"fail","ask_id":"ask-9"}}}')"
A3="$(rd '{"levels":['"$L"',{"level":"usable","value":"fail","evidence":"the walk graded ask feed r 0"}]}')"
A4="$(rd '{"levels":[{"level":"live","value":"pass","ask_id":"not-usable"},{"level":"usable","value":"unknown"}]}')"
[ "$A1|$A2" = "ask-9|ask-9" ] && ok "[MUST-FAIL] install acceptance reads usable's ask_id, with the levels as a list or keyed by level" || bad "read: list '$A1', keyed '$A2'"
[ "$A3|$A4" = "|" ] && ok "no ask_id on usable reads as none: never an id from the evidence's words or another level" || bad "no id: words '$A3', other level '$A4'"

# install acceptance's block that keeps the graded ask's rows, taken from the script and run with the container
# engine and the redaction stubbed: the ask_id the verdict names is asked for, and its rows land redacted, one JSON
# row per line; stderr is kept apart; no ask_id writes the line that says so, and asks nothing.
RA="$ROOT/scripts/substrate/acceptance/run-acceptance.sh"
{ grep '^mask_key_shapes() {' "$RA"; sed -n '/ask_id="\$(jq -r -f/,/^    fi$/p' "$RA"; } > "$T/rows-block.sh"
if grep -q -- '--ask-rows' "$T/rows-block.sh" && tail -1 "$T/rows-block.sh" | grep -q '^    fi$'; then
  # A key-shaped value no run variable holds, built here so no file carries one: the shape the scan's
  # substrate-api-key rule names.
  MINTED="mb_$(printf 'f%.0s' $(seq 1 40))"
  rows_run() { # <status.json> -> $T/res/diag/usable-rows.{jsonl,err}, $T/eng.calls
    rm -rf "$T/res"; mkdir -p "$T/res/diag"; cp "$1" "$T/res/diag/status.json"; : > "$T/eng.calls"
    MINTED="$MINTED" bash -c 'here="$1"; RESULT_DIR="$2"; ACCEPTANCE_CONTAINER=acc-test; calls="$3"
      eng() { printf "%s\n" "$*" >> "$calls"; printf "%s\n" "{\"id\":\"ask-9\",\"seq\":1}" "{\"why\":\"tok-secret-1\"}" "{\"output\":\"key=$MINTED;\"}"; echo "a warning tok-secret-1 $MINTED" >&2; }
      redact() { local t="$1"; printf "%s" "${t//tok-secret-1/<redacted>}"; }
      . "$4"' _ "$ROOT/scripts/substrate/acceptance" "$T/res" "$T/eng.calls" "$T/rows-block.sh" 2>/dev/null
  }
  printf '%s' '{"levels":[{"level":"live","value":"pass","evidence":"x"},{"level":"usable","value":"fail","evidence":"e","ask_id":"ask-9"}]}' > "$T/st-id.json"
  printf '%s' '{"levels":[{"level":"usable","value":"fail","evidence":"the walk graded ask feed r 0"}]}' > "$T/st-none.json"
  rows_run "$T/st-id.json"
  J="$(cat "$T/res/diag/usable-rows.jsonl" 2>/dev/null)"; E="$(cat "$T/res/diag/usable-rows.err" 2>/dev/null)"
  if [ "$(cat "$T/eng.calls")" = "exec acc-test substrate-status --ask-rows ask-9" ] \
    && [ "$(printf '%s\n' "$J" | head -2)" = "$(printf '%s\n%s' '{"id":"ask-9","seq":1}' '{"why":"<redacted>"}')" ] \
    && [ "$(printf '%s\n' "$E" | sed 's/ <redacted>$//')" = "a warning <redacted>" ]; then
    ok "[MUST-FAIL] the named ask's rows are asked for and kept redacted, one JSON row per line; stderr apart, redacted"
  else bad "rows block with an ask_id: calls '$(cat "$T/eng.calls")' jsonl '$J' err '$E'"; fi
  if [ "$(printf '%s\n' "$J" | tail -1)" = '{"output":"key=<redacted>;"}' ] && [ "$E" = "a warning <redacted> <redacted>" ] \
    && ! grep -qF "$MINTED" "$T/res/diag/usable-rows.jsonl" "$T/res/diag/usable-rows.err"; then
    ok "[MUST-FAIL] a key-shaped value the run was never given is masked in the kept rows and their stderr"
  else bad "key-shaped value: last row '$(printf '%s\n' "$J" | tail -1)' err '$E'"; fi
  rows_run "$T/st-none.json"
  J="$(cat "$T/res/diag/usable-rows.jsonl" 2>/dev/null)"
  [ "$J" = "the usable verdict names no graded ask" ] && [ ! -s "$T/eng.calls" ] \
    && ok "[MUST-FAIL] no ask_id: the file says the verdict names none, and nothing is asked" || bad "rows block, no ask_id: jsonl '$J' calls '$(cat "$T/eng.calls")'"
else bad "could not take the graded ask's rows block from run-acceptance.sh"; fi

[ "$FAILS" = 0 ] && { echo PASS; exit 0; }
echo "FAILED ($FAILS)"; exit 1
