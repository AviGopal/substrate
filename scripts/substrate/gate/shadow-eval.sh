#!/usr/bin/env bash
# shadow-eval.sh — run the ACCEPTED fixture corpus against a candidate gate, sandboxed.
#
#   shadow-eval.sh --accepted <accepted-dir> --super <clone> --candidate <sha>
#
# The corpus is read from accepted/ (validation/scripts/gate/fixtures/*.sh), never from the
# candidate: a candidate may ADD fixtures, which join only once it is promoted (H2). Each
# fixture is a check that exits 0 when the candidate behaves as the accepted gate requires
# (`# kind: known-invalid` fixtures replay a refused change; `# kind: known-valid` ones a
# required acceptance). The candidate's committed scripts/substrate is staged by `git archive`
# into a scratch dir; fixtures get it as PULLSYNC_BIN / CANDIDATE_DIR, a throwaway
# WORKSPACE_ROOT and HOME, and a scrubbed environment. As root they run under
# `setpriv --reuid=nobody --no-new-privs`; otherwise as the calling uid (said, not silent).
#
# Exit 0 only when every fixture passes. An EMPTY corpus fails: nothing checked is not a pass
# (an image-restored gate carries no validation/ tree, so it can promote nothing).
set -uo pipefail
ACC=""; SUPER=""; CAND=""
while [ $# -gt 0 ]; do
  case "$1" in --accepted) ACC="$2"; shift ;; --super) SUPER="$2"; shift ;; --candidate) CAND="$2"; shift ;; esac; shift
done
[ -n "$ACC" ] && [ -n "$SUPER" ] && [ -n "$CAND" ] || { echo "usage: shadow-eval.sh --accepted D --super S --candidate SHA" >&2; exit 64; }
shopt -s nullglob
CORPUS=("$ACC"/validation/scripts/gate/fixtures/*.sh)
shopt -u nullglob
[ "${#CORPUS[@]}" -gt 0 ] || { echo "REFUSE - the accepted corpus is empty; an unchecked candidate is not a pass"; exit 2; }

S="$(mktemp -d "${TMPDIR:-/tmp}/gate-shadow.XXXXXX")"; trap 'rm -rf "$S"' EXIT
mkdir -p "$S/cand" "$S/home" "$S/tmp"
if ! git -C "$SUPER" archive "$CAND" -- scripts/substrate 2>/dev/null | tar -x -C "$S/cand" 2>/dev/null \
   || [ ! -f "$S/cand/scripts/substrate/substrate-pull-sync.sh" ]; then
  echo "REFUSE - could not stage the candidate's committed scripts/substrate at ${CAND:0:12}"; exit 2
fi
cp -r "$ACC/validation/scripts/gate/fixtures" "$S/fixtures"
DROP=()
if [ "$(id -u)" = 0 ]; then
  chown -R nobody "$S" 2>/dev/null
  DROP=(setpriv --reuid=nobody --regid=nogroup --clear-groups --no-new-privs)
else
  echo "note: not root — fixtures run as uid $(id -u), not nobody"
fi
# EACH FIXTURE RUNS IN ITS OWN SESSION, and whatever it leaves behind is killed when it returns. A fixture that
# backgrounds a child (the relay fixture runs `timeout 220 bun relay.ts &`, and SIGKILL of timeout never reaches its
# child; GNU timeout also moves the child into a new process group) otherwise leaks it into every later corpus run.
# Measured in an accepted-image container: one more live bun after each run, 10 after 10, and a long
# image-coverage-map.check.sh session then read false FAILs late.
# The session id is the leader's pid, taken from $! by THIS root process. setsid run in the background is not a
# group leader, so it calls setsid() and execs without forking: sid = $!. Nothing the fixture can write is read
# back, because a fixture runs as nobody and must not be able to choose what root kills.
# OUTPUT goes to a root-owned 0700 directory outside $S ($S is chowned to nobody).
O="$(mktemp -d "${TMPDIR:-/tmp}/gate-shadow-out.XXXXXX")"; chmod 700 "$O"; trap 'rm -rf "$S" "$O"' EXIT
proc_sid() { # <pid> -> its session id (field 6 of /proc/<pid>/stat, read after the comm's closing paren)
  local st a; st="$(cat "/proc/$1/stat" 2>/dev/null)" || return 1; st="${st##*) }"; read -r -a a <<< "$st"; printf '%s' "${a[3]:-}"; }
OWN_SID="$(proc_sid $$)"; PARENT_SID="$(proc_sid "$PPID")"
reap_session() { # <sid>: SIGKILL every process still in that session; refuse a sid that is not a fixture's own
  local sid="$1" d n=0
  case "$sid" in ''|*[!0-9]*) echo "note: reap refused: session id '$sid' is not a number"; return 1 ;; esac
  if [ "$sid" -le 1 ] || [ "$sid" = "$OWN_SID" ] || [ "$sid" = "$PARENT_SID" ] || [ "$sid" = "$$" ]; then
    echo "note: reap refused: session $sid is init, this evaluator's or its caller's"; return 1; fi
  # Repeat until a pass finds nothing: a process can fork after a scan has passed it (timeout forking its child).
  local pass hit
  for pass in 1 2 3 4 5 6 7 8 9 10; do
    hit=0
    for d in /proc/[0-9]*; do [ "$(proc_sid "${d#/proc/}")" = "$sid" ] && kill -KILL "${d#/proc/}" 2>/dev/null && { n=$((n + 1)); hit=1; }; done
    [ "$hit" = 0 ] && break; sleep 0.1
  done
  [ "$hit" = 1 ] && echo "note: process(es) still in session $sid after 10 reap passes"
  [ "$n" -gt 0 ] && echo "note: reaped $n leftover process(es) of a fixture's session $sid"
  return 0; }
fail=0
for f in "$S"/fixtures/*.sh; do
  b="$(basename "$f")"; w="$S/ws-$b"; mkdir -p "$w"; [ "${#DROP[@]}" -gt 0 ] && chown nobody "$w"
  # HANDSHAKE, not a poll: the session leader (root, before privileges drop) writes its own pid to a root-owned
  # fifo after setsid() has run, closes the fd, then execs the fixture. The parent opens the fifo read-write (never
  # blocks), waits for that line bounded by the fixture timeout, and checks it is $!. Load cannot cause a false
  # refusal; the fixture never holds the fd, and nothing it can write is read back.
  fifo="$O/sid-$b"; rm -f "$fifo"; mkfifo -m 600 "$fifo"; exec 4<>"$fifo"
  setsid bash -c 'echo "$$" >&3; exec 3>&-; exec "$@"' _ "${DROP[@]}" env -i PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" HOME="$S/home" \
      TMPDIR="$S/tmp" LANG=C.UTF-8 WORKSPACE_ROOT="$w" PULLSYNC_BIN="$S/cand/scripts/substrate/substrate-pull-sync.sh" \
      CANDIDATE_DIR="$S/cand" GIT_AUTHOR_NAME=shadow GIT_AUTHOR_EMAIL=shadow@localhost \
      GIT_COMMITTER_NAME=shadow GIT_COMMITTER_EMAIL=shadow@localhost \
      timeout --kill-after=10 "${SHADOW_FIXTURE_TIMEOUT:-300}" bash "$f" > "$O/out" 2>&1 < /dev/null 3>"$fifo" 4<&- &
  lead=$!
  # ISOLATED? The leader's handshake line must be $! itself. If setsid forked (it found itself a group leader), the
  # line is another pid and `wait $!` would return before the fixture ends: refuse, and reap whatever started.
  hs=""; read -r -t "${SHADOW_FIXTURE_TIMEOUT:-300}" hs <&4; exec 4<&-; rm -f "$fifo"
  if [ "$hs" != "$lead" ]; then
    kill -KILL "$lead" 2>/dev/null
    case "$hs" in ''|*[!0-9]*) ;; *) reap_session "$hs" >&2 ;; esac
    reap_session "$lead" >&2; wait "$lead" 2>/dev/null
    echo "REFUSE - $b: could not isolate the fixture in its own session (handshake '${hs:-none}', expected $lead)"
    fail=$((fail+1)); continue
  fi
  wait "$lead"; rc=$?
  reap_session "$lead" >&2
  out="$(cat "$O/out")"
  if [ "$rc" = 0 ]; then echo "PASS - $b"; else echo "FAIL - $b (exit $rc): $(printf '%s' "$out" | grep -E 'FAIL' | head -3 | tr '\n' ' ')"; fail=$((fail+1)); fi
done
[ "$fail" = 0 ] && { echo "shadow: ${#CORPUS[@]} fixture(s) pass for ${CAND:0:12}"; exit 0; }
echo "shadow: $fail of ${#CORPUS[@]} fixture(s) failed for ${CAND:0:12}"; exit 1
