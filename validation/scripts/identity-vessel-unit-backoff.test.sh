#!/usr/bin/env bash
# identity-vessel-unit-backoff.test.sh: identity-vessel.service backs off a crash loop on the fleet's systemd.
#
# WHY. identity exits non-zero when its migrations cannot apply or its datastore does not answer, and with a fixed
# RestartSec=5 a broken start retries every 5 s for as long as it stays broken, against a store that may already be
# struggling. RestartSteps=/RestartMaxDelaySec= would back off, but they need systemd 254 and the fleet runs 252,
# which ignores them as unknown keys: a unit can carry them and still hot-loop. So the backoff must work without
# them, and this checks what the unit DOES, not which keys it names:
#   (a) Restart=on-failure, so a failed start is retried at all;
#   (b) the unit carries the NRestarts backoff ExecStartPre=, '-'-prefixed so a fault in it never blocks a start;
#   (c) run with NRestarts stubbed, that line waits nothing on a first or manual start (0) and 5, 10, 20, 40 s on the
#       first four automatic restarts, then 55 s from the fifth on; an unreadable count waits nothing;
#   (d) the line survives systemd's own parsing unchanged: no %-specifier, no ${...} substitution.
# Reads only the committed unit file; no systemd, git or network needed.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; UNIT="$ROOT/scripts/substrate/units/identity-vessel.service"
T="$(mktemp -d "${TMPDIR:-/tmp}/idbackoff.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }

[ -f "$UNIT" ] || { echo "FAIL - no unit file at scripts/substrate/units/identity-vessel.service"; exit 1; }

if grep -qE '^[[:space:]]*Restart[[:space:]]*=[[:space:]]*on-failure[[:space:]]*$' "$UNIT"; then ok "(a) Restart=on-failure"
else bad "(a) identity-vessel.service does not restart on failure"; fi

line="$(grep -E '^[[:space:]]*ExecStartPre[[:space:]]*=' "$UNIT" | grep 'NRestarts' | head -1)"
if [ -z "$line" ]; then
  bad "(b) identity-vessel.service has no NRestarts backoff ExecStartPre= (a 5 s hot loop on systemd 252)"
else
  v="${line#*=}"; v="${v#"${v%%[![:space:]]*}"}"
  case "$v" in -/bin/sh\ -c\ \'*\') ok "(b) a '-'-prefixed /bin/sh -c backoff line" ;; *) bad "(b) the backoff line is not \"-/bin/sh -c '<script>'\": $v" ;; esac
  script="${v#-/bin/sh -c \'}"; script="${script%\'}"
  case "$script" in *%*|*'${'*) bad "(d) the backoff script holds a %-specifier or \${...}, which systemd would rewrite" ;; *) ok "(d) systemd passes the script through unchanged" ;; esac
  mkdir -p "$T/bin"
  printf '#!/bin/sh\necho "$STUB_N"\n' > "$T/bin/systemctl"
  printf '#!/bin/sh\necho "$1" > "$STUB_OUT"\n' > "$T/bin/sleep"
  chmod +x "$T/bin/systemctl" "$T/bin/sleep"
  got=""
  for n in 0 1 2 3 4 5 6 9 ""; do
    rm -f "$T/slept"
    STUB_N="$n" STUB_OUT="$T/slept" PATH="$T/bin:/usr/bin:/bin" sh -c "$script" > /dev/null 2>&1; rc=$?
    w="-"; [ -f "$T/slept" ] && w="$(cat "$T/slept")"
    [ "$rc" = 0 ] || w="$w(rc=$rc)"
    got="$got ${n:-unset}:$w"
  done
  want=" 0:- 1:5 2:10 3:20 4:40 5:55 6:55 9:55 unset:-"
  if [ "$got" = "$want" ]; then ok "(c) waits by NRestarts:$got"
  else bad "(c) waits by NRestarts were$got, want$want"; fi
fi

[ "$FAILS" -eq 0 ] || { echo "FAIL - $FAILS problem(s) in identity-vessel.service's restart backoff"; exit 1; }
echo "ok - identity-vessel.service backs off a crash loop without RestartSteps="
