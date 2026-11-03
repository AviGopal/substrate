#!/usr/bin/env bash
# shadow-eval.sh kills what a fixture leaves behind (scripts/substrate/gate/shadow-eval.sh: each fixture runs in its
# own session; when it returns, every process still in that session is killed).
#
# The failure it pins: federation-relay-large-frames.sh starts `timeout 220 bun relay.ts &` and its EXIT trap
# SIGKILLs the timeout, which does not reach the bun child (GNU timeout also moves its command into a new process
# group). Observed in an image container: one more live bun after every corpus run, and a long
# image-coverage-map.check.sh session read false FAILs late in its run.
#
#   (a) a fixture that backgrounds a child under `timeout` (a new process group) and returns: after shadow-eval
#       returns, no process of that child is alive
#   (b) a fixture that leaves a child in its own process group (no timeout): reaped too
#   (c) the corpus verdict is unchanged (the fixtures pass)
#   (d) positive control (optional, when a reference shadow-eval without the reaper is given as $2): the same
#       fixtures DO leak under it, so (a)/(b) measure something
# security (a fixture is untrusted code; the reaper runs as root on a live node):
#   (e) a fixture that writes a SENTINEL's session id (a process the test started in its own session) into every
#       file it can reach in its workspace, $S and TMPDIR cannot get it killed: the sentinel survives
#   (f) reap_session refuses session 1, the evaluator's own session and its caller's, and says so
#   (g) reap_session refuses a non-numeric id
# load (SHADOW_PRESSURE=N runs it, ONLY inside a CPU-capped cgroup; off by default because it spends CPU on purpose):
#   (h) with 4 busy loops per CPU, N corpus runs give 0 "could not isolate" REFUSE and 0 surviving children.
#       Observed: a 2-s isolation POLL refused a fixture and leaked its child in some glue rounds on
#       a loaded host; the handshake has no timing window to miss.
#
# usage: validation/scripts/gate-shadow-eval-reaps-fixture-children.test.sh [shadow-eval.sh] [reference-shadow-eval.sh]
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SE="${1:-$ROOT/scripts/substrate/gate/shadow-eval.sh}"; REF="${2:-}"
T="$(mktemp -d)"; FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
PROBE=lnleakprobe$$; PROBE="${PROBE:0:15}"   # comm is truncated to 15 characters
alive() { local n=0 d; for d in /proc/[0-9]*; do [ "$(cat "$d/comm" 2>/dev/null)" = "$PROBE" ] && n=$((n+1)); done; echo "$n"; }
reap() { local d; for d in /proc/[0-9]*; do [ "$(cat "$d/comm" 2>/dev/null)" = "$PROBE" ] && kill -KILL "${d#/proc/}" 2>/dev/null; done; }
trap 'reap; for p in ${SPID:-} ${SREAL:-}; do kill -KILL "$p" 2>/dev/null; done; rm -rf "$T"' EXIT
mkdir -p "$T/acc/validation/scripts/gate/fixtures" "$T/bin"; cp "$(command -v sleep)" "$T/bin/$PROBE"; chmod 755 "$T" "$T/bin" "$T/bin/$PROBE"
cat > "$T/acc/validation/scripts/gate/fixtures/leak-timeout.sh" <<FX
#!/usr/bin/env bash
# kind: known-valid
( exec timeout 120 "$T/bin/$PROBE" 120 ) > /dev/null 2>&1 &
echo "ok - backgrounded a child under timeout"; exit 0
FX
cat > "$T/acc/validation/scripts/gate/fixtures/leak-plain.sh" <<FX
#!/usr/bin/env bash
# kind: known-valid
"$T/bin/$PROBE" 120 > /dev/null 2>&1 &
echo "ok - backgrounded a plain child"; exit 0
FX
# (e) the sentinel: in its own session, named so comm identifies it, its sid published for the hostile fixture
SENT=lnsentinel$$; SENT="${SENT:0:15}"; cp "$(command -v sleep)" "$T/bin/$SENT"; chmod 755 "$T/bin/$SENT"
stat4() { # <pid> -> "pid ppid pgrp sid comm" from /proc/<pid>/stat, or "pid=<pid> gone"
  local st c a; st="$(cat "/proc/$1/stat" 2>/dev/null)" || { echo "pid=$1 gone"; return 1; }
  c="${st#*(}"; c="${c%)*}"; st="${st##*) }"; read -r -a a <<< "$st"
  echo "pid=$1 ppid=${a[1]:-} pgrp=${a[2]:-} sid=${a[3]:-} comm=$c"; }
by_name() { local d; for d in /proc/[0-9]*; do [ "$(cat "$d/comm" 2>/dev/null)" = "$1" ] && echo "${d#/proc/}"; done; }
setsid "$T/bin/$SENT" 300 > /dev/null 2>&1 & SPID=$!
# $! is the pid bash forked. It is the sentinel only if setsid did not fork (setsid forks when it finds itself a
# process-group leader), so the sentinel is found by name: exactly one process named $SENT, leading its own session.
# That pid is published and watched; $! is kept so a failed (e) can say which reading the log supports.
SMATCH=(); for _ in $(seq 1 30); do mapfile -t SMATCH < <(by_name "$SENT"); [ "${#SMATCH[@]}" -gt 0 ] && break; sleep 0.1; done
SREAL=""; SETUP=""
if [ "${#SMATCH[@]}" -eq 1 ]; then
  SREAL="${SMATCH[0]}"; s="$(stat4 "$SREAL")"; s="${s#* sid=}"; s="${s%% *}"
  [ "$s" = "$SREAL" ] || SETUP="the one process named $SENT (pid $SREAL) is not its session's leader (sid=$s)"
else SETUP="${#SMATCH[@]} processes named $SENT after 3 s"; fi
if [ -n "$SETUP" ]; then
  echo "diag (e): sentinel lookup ambiguous: $SETUP"; for p in "${SMATCH[@]}"; do echo "diag (e):   $(stat4 "$p")"; done
  SREAL="$SPID"
elif [ "$SREAL" != "$SPID" ]; then
  echo "diag (e): SPID $SPID is not the sentinel (comm=$(cat "/proc/$SPID/comm" 2>/dev/null || echo gone)); the sentinel is pid $SREAL"
fi
SB_SPID="$(stat4 "$SPID")"; SB_REAL="$(stat4 "$SREAL")"; SB_SHELL="$(stat4 $$)"
echo "$SREAL" > "$T/sentinel.sid"; chmod 644 "$T/sentinel.sid"
cat > "$T/acc/validation/scripts/gate/fixtures/hostile.sh" <<FX
#!/usr/bin/env bash
# kind: known-valid
sid="\$(cat "$T/sentinel.sid")"
for d in "\${WORKSPACE_ROOT:-/nonexistent}" "\$(dirname "\${WORKSPACE_ROOT:-/x}")" "\${TMPDIR:-/tmp}"; do
  # unlink-and-recreate, not overwrite: a root-owned file in a nobody-owned directory can be replaced this way
  for f in "\$d"/pgid-* "\$d"/out "\$d"/*sid*; do [ -e "\$f" ] && { rm -f "\$f" 2>/dev/null; printf '%s\n' "\$sid" > "\$f" 2>/dev/null; }; done
  rm -f "\$d/pgid-hostile.sh" 2>/dev/null; printf '%s\n' "\$sid" > "\$d/pgid-hostile.sh" 2>/dev/null
done
echo "ok - wrote the sentinel's session id everywhere it could"; exit 0
FX
chmod 755 "$T/acc/validation/scripts/gate/fixtures/"*.sh
sent_alive() { [ "$(cat "/proc/$SREAL/comm" 2>/dev/null)" = "$SENT" ]; }
sent_diag() { # what a reader of a CI log needs to tell a reaper kill (A) from a mis-recorded pid (B)
  local id said
  echo "diag (e): \$!=$SPID sentinel-by-name=$SREAL test shell: $SB_SHELL"
  echo "diag (e): before: \$! $SB_SPID | sentinel $SB_REAL"
  echo "diag (e): after:  \$! $(stat4 "$SPID") | sentinel $(stat4 "$SREAL")"
  echo "diag (e): processes named $SENT now: $(by_name "$SENT" | tr '\n' ' ')"
  for id in $(printf '%s\n' "$SPID" "$SREAL" | sort -u); do
    said="$(grep -E "session $id([^0-9]|\$)" <<<"$out")"
    if [ -n "$said" ]; then sed "s/^/diag (e): the reaper names session $id: /" <<<"$said"
    else echo "diag (e): the reaper's output does not name session $id"; fi
  done; }
# The candidate is a throwaway repository holding this tree's scripts/substrate, never $ROOT itself: the pre-commit
# hook runs the glue corpus on a checkout-index export of the index, which has no .git, and shadow-eval stages the
# candidate from git. Without this, shadow-eval refused before any fixture ran, and (a)(b)(e) passed vacuously.
mkdir -p "$T/super/scripts" && cp -a "$ROOT/scripts/substrate" "$T/super/scripts/" \
  && git -C "$T/super" init -q -b dev && git -C "$T/super" add -A \
  && git -C "$T/super" -c user.name=reaper-test -c user.email=reaper-test@localhost commit -qm candidate \
  || { echo "FAIL - could not build the throwaway candidate repository"; exit 1; }
run() { TMPDIR="$T" bash "$1" --accepted "$T/acc" --super "$T/super" --candidate HEAD 2>&1; }
out="$(run "$SE")"
n="$(alive)"
[ "$n" = 0 ] && ok "(a)(b) no fixture child survives shadow-eval ($PROBE alive: $n)" || bad "(a)(b) $n fixture child(ren) survive shadow-eval"
if grep -q '^shadow: 3 fixture(s) pass' <<<"$out"; then ok "(c) the verdict is unchanged: all three fixtures pass"
else bad "(c) verdict changed: $(tail -1 <<<"$out")"; grep -E '^(REFUSE|FAIL) - ' <<<"$out" | sed 's/^/  evaluator said: /'; fi
if [ -n "$SETUP" ]; then bad "(e) SETUP ERROR, not judged: sentinel lookup ambiguous: $SETUP"
elif sent_alive; then ok "(e) the hostile fixture could not get the sentinel (another session) killed"
else bad "(e) the sentinel was KILLED: a fixture chose what the reaper kills"; sent_diag; fi
{ sed -n '/^proc_sid() {/,/; }$/p' "$SE"; sed -n '/^reap_session() {/,/^  return 0; }$/p' "$SE"; } > "$T/fns.sh"
if grep -q '^reap_session() {' "$T/fns.sh"; then
  r1="$( . "$T/fns.sh"; OWN_SID="$(proc_sid $$)"; PARENT_SID="$(proc_sid "$PPID")"; reap_session 1 )"
  r2="$( . "$T/fns.sh"; OWN_SID="$(proc_sid $$)"; PARENT_SID="$(proc_sid "$PPID")"; reap_session "$OWN_SID" )"
  r3="$( . "$T/fns.sh"; OWN_SID=x; PARENT_SID=y; reap_session 12abc )"
  grep -q 'reap refused: session 1 is' <<<"$r1" && grep -q 'reap refused: session .* is init, this evaluator' <<<"$r2" \
    && ok "(f) reap_session refuses session 1 and the evaluator's own session, by name" || bad "(f) no refusal: '$r1' / '$r2'"
  grep -q "reap refused: session id '12abc' is not a number" <<<"$r3" && ok "(g) a non-numeric id is refused" || bad "(g) '$r3'"
else bad "(f)(g) could not extract reap_session from $SE"; fi
if [ -n "$REF" ]; then
  reap; run "$REF" > /dev/null 2>&1; n="$(alive)"
  [ "$n" -ge 1 ] && ok "(d) control: the reference shadow-eval leaks $n child(ren)" || bad "(d) control: the reference did not leak, so (a)/(b) prove nothing"
  reap
fi
# (h) burns CPU on purpose, so it refuses to run where that would load a shared host: it needs a cgroup CPU limit
# (cpu.max other than "max", as in `docker run --cpus N`). Run uncapped on a shared host it
# drives the load very high and voids every other session's timing reading.
cap_ok() { local m; m="$(cat /sys/fs/cgroup/cpu.max 2>/dev/null)"; case "$m" in ''|max*) return 1 ;; *) return 0 ;; esac; }
if [ "${SHADOW_PRESSURE:-0}" -gt 0 ] 2>/dev/null && ! cap_ok; then
  echo "  (h) skipped: SHADOW_PRESSURE needs a CPU-capped cgroup (run it in a container started with --cpus); this one is uncapped"
elif [ "${SHADOW_PRESSURE:-0}" -gt 0 ] 2>/dev/null; then
  echo "  (h) RUNNING: cpu.max=$(cat /sys/fs/cgroup/cpu.max), $(( $(nproc) * 4 )) busy loops, $SHADOW_PRESSURE corpus runs"
  BUSY=(); for _ in $(seq 1 $(( $(nproc) * 4 ))); do ( while :; do :; done ) & BUSY+=($!); done
  refused=0; leaked=0
  for i in $(seq 1 "$SHADOW_PRESSURE"); do
    o="$(run "$SE")"; refused=$(( refused + $(grep -c 'could not isolate' <<<"$o") )); n="$(alive)"; leaked=$(( leaked + n )); reap
    grep -E '^(REFUSE|FAIL) - ' <<<"$o" | sed "s/^/  run $i, evaluator said: /"
  done
  kill -KILL "${BUSY[@]}" 2>/dev/null; wait "${BUSY[@]}" 2>/dev/null
  [ "$refused" = 0 ] && [ "$leaked" = 0 ] && ok "(h) under CPU pressure, $SHADOW_PRESSURE runs: 0 isolation REFUSE, 0 leaked children" \
    || bad "(h) under CPU pressure, $SHADOW_PRESSURE runs: $refused isolation REFUSE, $leaked leaked children"
fi
[ "$FAILS" = 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS failure(s)"; exit 1; }
