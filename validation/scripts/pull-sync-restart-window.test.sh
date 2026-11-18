#!/usr/bin/env bash
# pull-sync marks each restart it makes as an owner infra_window span (scripts/substrate/substrate-pull-sync.sh: the
# systemctl function, restart_span, restart_ready, restart_window_close): records' fold and the walk failure detector
# then leave a call cut by the restart (status 0) out of every failed move, and nothing else the tick did. Runs the
# script's own functions with curl stubbed as discovery in front of an in-memory records store whose head the test sets,
# and the systemctl binary stubbed on PATH (a restart moves the head as the cut rows it causes would).
#   (a) a restart is one span: from the first row after the head before it to the head once the unit answers its health
#       port; written at the tick's end as ONE owner infra_window row, statuses [0], naming the unit, after its span;
#       the tick's later work is outside it; the window file is gone;
#   (b) two restarts with work between are two spans, the work in neither; a unit with no port ends its span once
#       active; a restart answers its own status;
#   (c) a head that cannot be read before a restart keeps no span, says so, and the restart still runs, its status kept;
#   (d) a head that cannot be read after it drops the span, said, nothing written;
#   (e) a row the store does not take is said, and its span kept with its end: the next tick's start writes exactly it;
#   (f) a span with no end (its tick was killed during the restart) is dropped at the next start, said, not written;
#   (g) nothing written during the restart writes nothing; one row is a one-row span;
#   (h) a unit not ready within the shaped bound (pull_sync.restart_ready_seconds, read once per tick) ends its span
#       there, said;
#   (i) every other systemctl goes to the binary unchanged and keeps no span; the EXIT trap and the tick's start call
#       restart_window_close; no restart in the script reaches the binary past the function;
#   (j) a unit the inventory gives no health_port, whose unit file declares one Environment=<NAME>_PORT=<digits> line,
#       ends its span once that port's /health answers; a _PORT anywhere else in the text (a comment, PassEnvironment=,
#       a second assignment on one line) is not taken; several declared, or none, end at active and say so, and no
#       other line of the unit text reaches the log;
#   (k) a unit inactive for its first checks ends its span only once it is active (with no port, at active);
#   (l) a restart with an option (--no-block) spans the unit alone: the option is no unit, never asked about;
#   (m) the env file a unit references is never opened (a sentinel FIFO records any reader).
# usage: validation/scripts/pull-sync-restart-window.test.sh [path/to/substrate-pull-sync.sh]
set -uo pipefail
SCRIPT="${1:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/substrate/substrate-pull-sync.sh}"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
command -v jq >/dev/null || { echo "FAIL - no jq: cannot judge"; exit 1; }
FNS="shape_route dev_resolve store_head systemctl restart_ready restart_span restart_window_close"
for f in $FNS; do sed -n "/^$f() {/,/^}/p" "$SCRIPT"; done > "$T/fns.sh"
for f in $FNS; do grep -q "^$f()" "$T/fns.sh" || { echo "FAIL - could not extract $f"; exit 1; }; done
LOG="$T/log.txt"; log() { echo "$*" >> "$LOG"; }
gap_resolve() { return 7; }
sleep() { :; }
ROWS="$T/rows.json"; export HEAD="$T/head"; WRITES="$T/writes.txt"; export CALLS="$T/calls.txt"
DISCOVERY=http://discovery.test; SHAPE_ROUTES=" "; SR_ROUTE=""; DEV_VESSEL=""
export METABOB_API_KEY=""
export RESTART_WINDOW_FILE="$T/restart-window.json"
RESTART_READY_S=""
tuning_param() { TP_VALUE=5; echo "$1" >> "$T/tp.txt"; }   # the shaped bound, as tuning_param sets it
INV="$T/inv.json"
echo '{"vessels":[{"repo":"walk-vessel","unit":"walk-vessel.service","health_port":8500},{"repo":"records-vessel","unit":"records-vessel.service"},{"repo":"described-shape-vessel","unit":"described-shape-vessel.service"}]}' > "$INV"
# the systemctl binary: a restart moves the head by $MOVE (the rows the cut calls write) and answers $RC; is-active
# answers $ACTIVE; every call is logged
mkdir -p "$T/bin"
cat > "$T/bin/systemctl" <<'EOF'
#!/usr/bin/env bash
echo "$*" >> "$CALLS"
case "${1:-}" in
  restart) echo $(( $(cat "$HEAD") + ${MOVE:-0} )) > "$HEAD"; exit "${RC:-0}" ;;
  is-active) n="$(cat "$ISACT" 2>/dev/null || echo 0)"; echo $((n + 1)) > "$ISACT"
    if [ "$n" -lt "${INACTIVE_FOR:-0}" ]; then echo $(( $(cat "$HEAD") + 1 )) > "$HEAD"; exit 3; fi   # starting: a check moves the head
    [ "${ACTIVE:-1}" = 1 ] ;;
  cat) printf '%s\n' "${UNIT_TEXT:-}" ;;
  *) exit 0 ;;
esac
EOF
chmod +x "$T/bin/systemctl"; export PATH="$T/bin:$PATH"
# the health port: answers 200 from its $HEALTH_AFTER-th check on; each check before that moves the head by one (a
# caller's "no answer" while the unit starts)
healthy() { local n; n="$(cat "$T/hc" 2>/dev/null || echo 0)"; echo $((n + 1)) > "$T/hc"; echo "$1" >> "$T/ports"
  [ "$n" -ge "${HEALTH_AFTER:-0}" ] && return 0; echo $(( $(cat "$HEAD") + 1 )) > "$HEAD"; return 1; }
curl() {
  cat > /dev/null
  local d="" a prev=""; for a in "$@"; do case "$prev" in -d) d="$a" ;; esac; prev="$a"; done
  local t; t="$(printf '%s' "$d" | jq -r '.pointer.type // empty')"
  case "$t" in
    vesselCapability) printf '{"content":{"vessels":[{"vesselId":"v"}]}}' ;;
    record_read)
      if [ "$(printf '%s' "$d" | jq -r '.pointer.head // false')" = true ]; then
        [ -n "${NOHEAD:-}" ] && { printf '{}'; return 0; }
        printf '{"at_seq":%s}' "$(cat "$HEAD")"
      else jq -c --arg s "$(printf '%s' "$d" | jq -r .pointer.shape)" 'map(select(.shape == $s))' "$ROWS"; fi ;;
    record_write)
      [ -n "${WFAIL:-}" ] && { printf '{}'; return 0; }
      local n row; n="$(cat "$HEAD")"
      row="$(printf '%s' "$d" | jq -c --argjson n "$n" '.pointer as $p | $p.row + {id: ("row-" + (($n + 1) | tostring)), seq: ($n + 1), writer: $p.writer, role: $p.role}')"
      jq -c --argjson r "$row" '. + [$r]' "$ROWS" > "$ROWS.new" && mv "$ROWS.new" "$ROWS"; echo $((n + 1)) > "$HEAD"
      echo "$row" >> "$WRITES"; printf '%s' "$row" ;;
    *) printf '{}' ;;
  esac
}
# shellcheck disable=SC1090
source "$T/fns.sh"
export ISACT="$T/isact"
fresh() { echo '[]' > "$ROWS"; : > "$WRITES"; : > "$LOG"; : > "$CALLS"; rm -f "$RESTART_WINDOW_FILE" "$T/hc" "$T/ports" "$ISACT"; echo "$1" > "$HEAD"
  unset NOHEAD WFAIL; MOVE=0; RC=0; ACTIVE=1; HEALTH_AFTER=0; UNIT_TEXT=""; INACTIVE_FOR=0; export MOVE RC ACTIVE UNIT_TEXT INACTIVE_FOR; }
spans() { jq -c '[.[] | select(.shape == "infra_window") | {from_seq, to_seq}]' "$ROWS"; }
gone() { [ -f "$RESTART_WINDOW_FILE" ] && echo kept || echo gone; }

fresh 100; MOVE=5; HEALTH_AFTER=2
systemctl restart walk-vessel.service; A_RC=$?
echo 150 > "$HEAD"   # the tick's later work: a gate suite's rows
restart_window_close
W="$(jq -c '[.[] | select(.shape == "infra_window")]' "$ROWS")"
if [ "$A_RC" = 0 ] && [ "$(jq length <<<"$W")" = 1 ] \
  && [ "$(jq -c '.[0] | {window_id, from_seq, to_seq, statuses, writer, role}' <<<"$W")" = '{"window_id":"restart-101-107","from_seq":101,"to_seq":107,"statuses":[0],"writer":"owner","role":"owner"}' ] \
  && jq -e '.[0].reason | test("walk-vessel")' <<<"$W" >/dev/null && jq -e '.[0].seq > .[0].to_seq' <<<"$W" >/dev/null && [ "$(gone)" = gone ]; then
  ok "(a) a restart is one owner span, from the row after the head before it to the head once its health answers; the tick's later work outside"
else bad "(a) rc=$A_RC windows: $(printf '%s' "$W" | cut -c1-400) file:$(gone)"; fi

fresh 100; MOVE=5
systemctl restart walk-vessel.service
echo 140 > "$HEAD"   # work between the restarts
MOVE=3; RC=3; systemctl restart records-vessel.service; B_RC=$?
restart_window_close
B="$(spans)"
if [ "$B" = '[{"from_seq":101,"to_seq":105},{"from_seq":141,"to_seq":143}]' ] && [ "$B_RC" = 3 ]; then ok "(b) two restarts are two spans; the work between is in neither; a unit with no health port ends its span once active; a restart's status is kept"
else bad "(b) spans: $B rc=$B_RC"; fi

fresh 100; NOHEAD=1; RC=4; MOVE=2
systemctl restart walk-vessel.service; C_RC=$?
restart_window_close
if [ "$C_RC" = 4 ] && grep -q '^restart walk-vessel.service' "$CALLS" && [ ! -s "$WRITES" ] && [ "$(gone)" = gone ] && grep -q 'could not be read before restarting walk-vessel' "$LOG"; then
  ok "(c) an unreadable head before a restart keeps no span and says so; the restart still runs, its status kept"
else bad "(c) rc=$C_RC calls=$(tr '\n' ';' < "$CALLS") wrote=$(cat "$WRITES") file:$(gone)"; fi

fresh 100; MOVE=2
store_head() { if [ -s "$T/second" ]; then printf ''; else echo x > "$T/second"; printf '%s' "$(cat "$HEAD")"; fi; }
systemctl restart walk-vessel.service
source "$T/fns.sh"; rm -f "$T/second"   # the real store_head back
restart_window_close
if [ ! -s "$WRITES" ] && [ "$(gone)" = gone ] && grep -q 'could not be read after restarting walk-vessel' "$LOG"; then ok "(d) an unreadable head after a restart drops its span, said, nothing written"
else bad "(d) wrote=$(cat "$WRITES") file:$(gone)"; fi

fresh 100; MOVE=10
systemctl restart walk-vessel.service
WFAIL=1; restart_window_close; unset WFAIL
D1="$(gone)/$(grep -c 'NOT written' "$LOG")/$(spans | jq length)"
echo 300 > "$HEAD"
restart_window_close   # the next tick's start
D2="$(spans)"
if [ "$D1" = "kept/1/0" ] && [ "$D2" = '[{"from_seq":101,"to_seq":110}]' ] && [ "$(gone)" = gone ]; then ok "(e) a refused write is said; the next tick's start writes exactly the span, its own end kept"
else bad "(e) $D1 then $D2 file:$(gone)"; fi

fresh 100
echo '[{"from":101,"units":"walk-vessel"}]' > "$RESTART_WINDOW_FILE"   # a tick killed during its restart
echo 300 > "$HEAD"
restart_window_close
if [ ! -s "$WRITES" ] && [ "$(gone)" = gone ] && grep -q 'has no end' "$LOG"; then ok "(f) a span with no end (its tick killed) is dropped at the next start, said, not written"
else bad "(f) wrote=$(cat "$WRITES") file:$(gone)"; fi

fresh 100; MOVE=0
systemctl restart walk-vessel.service; restart_window_close
G1="$(cat "$WRITES")$(gone | grep kept)"
fresh 100; MOVE=1
systemctl restart walk-vessel.service; restart_window_close
G2="$(spans)"
if [ -z "$G1" ] && [ "$G2" = '[{"from_seq":101,"to_seq":101}]' ]; then ok "(g) nothing written during a restart writes nothing; one row is a one-row span"
else bad "(g) unmoved:[$G1] one-row:$G2"; fi

fresh 100; MOVE=2; HEALTH_AFTER=99
systemctl restart walk-vessel.service; restart_window_close
H="$(spans)"
if [ "$H" = '[{"from_seq":101,"to_seq":107}]' ] && grep -q 'walk-vessel was not ready within 5s' "$LOG" && [ "$(sort -u "$T/tp.txt")" = pull_sync.restart_ready_seconds ]; then ok "(h) a unit not ready within the bound ends its span there, said"
else bad "(h) spans: $H log: $(tr '\n' ';' < "$LOG" | cut -c1-200)"; fi

fresh 100; MOVE=2; HEALTH_AFTER=3; UNIT_TEXT="$(printf '[Service]\nType=simple\nEnvironment=DESCRIBED_VESSEL_ID=described\nEnvironment=DESCRIBED_PORT=8520\n# Environment=OLD_PORT=1\nPassEnvironment=PROXY_PORT=3128\nEnvironment=NEIGHBOUR_TOKEN=placeholder-not-a-port EXTRA_PORT=9\nExecStart=/bin/true')"
systemctl restart described-shape-vessel.service; restart_window_close
J1="$(spans)/$(sort -u "$T/ports" 2>/dev/null | tr '\n' ' ')"
fresh 100; MOVE=2; HEALTH_AFTER=3; UNIT_TEXT="$(printf '[Service]\nEnvironment=A_PORT=1\nEnvironment=B_PORT=2')"
systemctl restart described-shape-vessel.service; restart_window_close
J2="$(spans)/$( [ -s "$T/ports" ] && echo asked || echo none)/$(grep -c 'declares no single health port' "$LOG")"
J3="$(grep -cE 'NEIGHBOUR_TOKEN|placeholder-not-a-port|PassEnvironment|A_PORT|B_PORT' "$LOG")"
if [ "$J1" = '[{"from_seq":101,"to_seq":105}]/8520 ' ] && [ "$J2" = '[{"from_seq":101,"to_seq":102}]/none/1' ] && [ "$J3" = 0 ]; then
  ok "(j) a unit with no inventory health_port ends its span at the /health of the one port its environment declares; several, at active"
else bad "(j) one port: $J1 several: $J2 unit text in the log: $J3"; fi

fresh 100
systemctl is-active --quiet walk-vessel.service; I_RC=$?
ACTIVE=0; systemctl is-active --quiet walk-vessel.service; I_RC2=$?
TRAP_LINE="$(grep -n "^trap '.*' EXIT" "$SCRIPT" | tail -1)"
START_LINE="$(grep -nE '^restart_window_close[[:space:]]*(#|$)' "$SCRIPT" | head -1 | cut -d: -f1)"
DEF_LINE="$(grep -n '^systemctl() {' "$SCRIPT" | cut -d: -f1)"
PAST="$(grep -nE '(/usr/bin/|/bin/|env |sudo |exec |xargs |nohup |timeout [0-9]+ )systemctl +restart|command +systemctl +restart|(bash|sh) +-c +.*systemctl +restart' "$SCRIPT" | grep -v '^[0-9]*:[[:space:]]*#' | tr '\n' ';')"
if [ "$I_RC" = 0 ] && [ "$I_RC2" != 0 ] && [ "$(tr '\n' ';' < "$CALLS")" = 'is-active --quiet walk-vessel.service;is-active --quiet walk-vessel.service;' ] && [ "$(gone)" = gone ] \
   && grep -q 'restart_window_close' <<<"$TRAP_LINE" && [ -n "$START_LINE" ] && [ "${TRAP_LINE%%:*}" -lt "$START_LINE" ] \
   && [ -n "$DEF_LINE" ] && [ "$DEF_LINE" -lt "${TRAP_LINE%%:*}" ] && [ -z "$PAST" ]; then
  ok "(i) other systemctl calls go to the binary unchanged; the trap and the tick's start write the spans; no restart reaches the binary past the function"
else bad "(i) rc=$I_RC/$I_RC2 calls=$(tr '\n' ';' < "$CALLS") trap=[$TRAP_LINE] start=[$START_LINE] def=[$DEF_LINE] past=[$PAST]"; fi

fresh 100; MOVE=2; INACTIVE_FOR=3
systemctl restart records-vessel.service; restart_window_close
K="$(spans)"
if [ "$K" = '[{"from_seq":101,"to_seq":105}]' ]; then ok "(k) a unit inactive for its first checks ends its span only once active"
else bad "(k) spans: $K"; fi

fresh 100; MOVE=1
systemctl restart --no-block records-vessel.service; L_RC=$?; restart_window_close
L1="$(jq -r '[.[] | select(.shape == "infra_window") | .reason] | join("|")' "$ROWS")"
if [ "$L_RC" = 0 ] && [ "$(spans)" = '[{"from_seq":101,"to_seq":101}]' ] && grep -q '^restart --no-block records-vessel.service$' "$CALLS" \
   && ! grep -q -- '--no-block.service\|is-active --quiet --no-block' "$CALLS" && [ "${L1#pull-sync restarted records-vessel:}" != "$L1" ]; then
  ok "(l) a restart with an option spans the unit alone, and the option is never asked about"
else bad "(l) rc=$L_RC spans=$(spans) reason=[$L1] calls=$(tr '\n' ';' < "$CALLS")"; fi

fresh 100; MOVE=1
rm -f "$T/sentinel.env" "$T/sentinel.opened"; mkfifo "$T/sentinel.env"
# writers waiting on the FIFO, one after another: each gets past its open only if something opens the sentinel for
# reading, marks it, and closes (the reader gets EOF), so a reader is recorded and never left waiting, however many times
# it opens the sentinel
( while :; do exec 3>"$T/sentinel.env"; echo opened > "$T/sentinel.opened"; exec 3>&-; done ) & SENT=$!
UNIT_TEXT="$(printf '[Service]\nEnvironmentFile=%s\nEnvironmentFile=-%s\nEnvironment=DESCRIBED_PORT=8520' "$T/sentinel.env" "$T/sentinel.env")"
systemctl restart described-shape-vessel.service; restart_window_close
M_OPENED="$( [ -f "$T/sentinel.opened" ] && echo opened || echo closed)"
kill "$SENT" 2>/dev/null; wait "$SENT" 2>/dev/null
if [ "$M_OPENED" = closed ] && [ "$(spans)" = '[{"from_seq":101,"to_seq":101}]' ] && ! grep -q 'sentinel' "$LOG"; then
  ok "(m) the env file a unit references is never opened, nor named in the log"
else bad "(m) sentinel $M_OPENED, spans $(spans), log: $(grep -c sentinel "$LOG")"; fi

echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; }
echo "$FAILS FAILED"; exit 1
