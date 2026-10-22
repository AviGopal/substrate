#!/usr/bin/env bash
# unit-restart-backoff.test.sh: restart backoff in the units works on the fleet's systemd, not only on paper.
#
# WHY. The image runs systemd 252. RestartSteps= and RestartMaxDelaySec= arrived in 254, and 252 ignores them as
# unknown keys, so a unit that names them still restarts every RestartSec= for as long as it fails: goal-host carried
# "RestartSteps=3 / RestartMaxDelaySec=30" for months and never backed off once. This checks what the units DO:
#   (a) no unit file or drop-in under scripts/substrate/units/ names a key this systemd ignores (RestartSteps=,
#       RestartMaxDelaySec=), so no unit claims a backoff it does not get;
#   (b) each unit listed in BACKOFF carries Restart=on-failure and the '-'-prefixed NRestarts ExecStartPre= line
#       (a fault in it never blocks a start);
#   (c) run with NRestarts stubbed, that line waits nothing on a first or manual start (0) and 5, 10, 20, 40 s on the
#       first four automatic restarts, then 55 s; an unreadable count waits nothing;
#   (d) systemd passes the line's script through unchanged: no %-specifier, no ${...} substitution, and the
#       NRestarts it reads is the unit's own.
# Reads only the committed unit files; no systemd, git or network needed.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; U="$ROOT/scripts/substrate/units"
BACKOFF=(identity-vessel.service goal-host-vessel.service)
T="$(mktemp -d "${TMPDIR:-/tmp}/unitbackoff.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
[ -d "$U" ] || { echo "FAIL - no scripts/substrate/units/"; exit 1; }

hits="$(grep -rnE '^[[:space:]]*(RestartSteps|RestartMaxDelaySec)[[:space:]]*=' "$U" 2>/dev/null | sed "s#^$U/##")"
if [ -z "$hits" ]; then ok "(a) no unit names RestartSteps=/RestartMaxDelaySec= (ignored by systemd 252)"
else while IFS= read -r h; do bad "(a) $h: systemd 252 ignores this key, so the backoff it claims never happens"; done <<<"$hits"; fi

mkdir -p "$T/bin"
printf '#!/bin/sh\n[ "$*" = "show -p NRestarts --value $STUB_UNIT" ] || { echo "unexpected: $*" >&2; exit 9; }\necho "$STUB_N"\n' > "$T/bin/systemctl"
printf '#!/bin/sh\necho "$1" > "$STUB_OUT"\n' > "$T/bin/sleep"
chmod +x "$T/bin/systemctl" "$T/bin/sleep"
want=" 0:- 1:5 2:10 3:20 4:40 5:55 6:55 9:55 unset:-"

for unit in "${BACKOFF[@]}"; do
  f="$U/$unit"
  [ -f "$f" ] || { bad "$unit: no unit file"; continue; }
  grep -qE '^[[:space:]]*Restart[[:space:]]*=[[:space:]]*on-failure[[:space:]]*$' "$f" || bad "$unit: (b) does not restart on failure"
  line="$(grep -E '^[[:space:]]*ExecStartPre[[:space:]]*=' "$f" | grep 'NRestarts' | head -1)"
  if [ -z "$line" ]; then bad "$unit: (b) no NRestarts backoff ExecStartPre= (a fixed-RestartSec hot loop on systemd 252)"; continue; fi
  v="${line#*=}"; v="${v#"${v%%[![:space:]]*}"}"
  case "$v" in -/bin/sh\ -c\ \'*\') ;; *) bad "$unit: (b) the backoff line is not \"-/bin/sh -c '<script>'\": $v"; continue ;; esac
  script="${v#-/bin/sh -c \'}"; script="${script%\'}"
  case "$script" in *%*|*'${'*) bad "$unit: (d) the script holds a %-specifier or \${...}, which systemd would rewrite" ;; esac
  got=""
  for n in 0 1 2 3 4 5 6 9 ""; do
    rm -f "$T/slept"
    STUB_UNIT="$unit" STUB_N="$n" STUB_OUT="$T/slept" PATH="$T/bin:/usr/bin:/bin" sh -c "$script" > /dev/null 2>"$T/err"; rc=$?
    w="-"; [ -f "$T/slept" ] && w="$(cat "$T/slept")"
    [ "$rc" = 0 ] || w="$w(rc=$rc)"
    got="$got ${n:-unset}:$w"
  done
  if [ "$got" = "$want" ]; then ok "$unit: (b)(c)(d) '-'-prefixed NRestarts backoff, waits:$got"
  else bad "$unit: (c) waits by NRestarts were$got, want$want$( [ -s "$T/err" ] && printf ' (%s)' "$(head -c 120 "$T/err")")"; fi
done

[ "$FAILS" -eq 0 ] || { echo "FAIL - $FAILS problem(s) in unit restart backoff"; exit 1; }
echo "ok - restart backoff works on systemd 252 for ${#BACKOFF[@]} unit(s), and no unit relies on a key it ignores"
