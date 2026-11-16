#!/usr/bin/env bash
# acceptance-upgrade-seeded-wait.test.sh: the upgrade acceptance judges fleet_seeded with a bounded wait for the seeded
# level, never a --quick snapshot: right after the installer's wait returns, units can still be queued, and a snapshot
# then failed every run since 3d5e613e (agf_c0x5weqjxa8u). The network run's spoke_seeded is held to the same rule.
# Each check is run against a stand-in substrate-status that answers "still starting" on its first evaluation and
# seeded on the next, as a wait re-evaluates and a snapshot does not.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
F="$ROOT/scripts/substrate/acceptance/run-upgrade-acceptance.sh"
T="$(mktemp -d "${TMPDIR:-/tmp}/acc-upg.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
# the stand-in: the first evaluation sees units still queued; a --wait evaluates again and sees seeded
cat >"$T/substrate-status" <<'S'
#!/usr/bin/env bash
n=0; [ -f "$STATE" ] && n=$(cat "$STATE"); n=$((n+1)); echo "$n" >"$STATE"
wait=0; for a in "$@"; do [ "$a" = --wait ] && wait=1; done
[ "$n" -ge 2 ] && { echo "seeded: pass"; exit 0; }
[ "$wait" = 1 ] && { echo "seeded: pass (after waiting)"; exit 0; }
echo "live fail: systemd is still starting (6 job(s) queued)"; exit 1
S
chmod +x "$T/substrate-status"
# judged <name> <file> <container var>: the seeded verdict's command in <file>, run against the stand-in. It is the
# seeded level as the install page reads it (--wait seeded, which checks core units with restart stability), bounded,
# never a --quick snapshot (which also counted non-core ported units, and judged before units had started).
judged() {
  local cmd; cmd="$(grep -E "eng exec \"\\\$$3\" substrate-status .*seeded" "$2" | grep -v '^ *#' | head -1 | sed -n "s/.*eng exec \"\\\$$3\" \(substrate-status[^>]*\)>.*/\1/p")"
  [ -n "$cmd" ] || { bad "$1: no seeded verdict found in $2"; return; }
  rm -f "$T/n"; STATE="$T/n" PATH="$T:$PATH" bash -c "$cmd" >/dev/null 2>&1; local rc=$?
  if [ "$rc" = 0 ] && printf '%s' "$cmd" | grep -q -- '--wait seeded' && printf '%s' "$cmd" | grep -qE -- '--timeout [0-9]+' && ! printf '%s' "$cmd" | grep -q -- '--quick'; then
    ok "$1 waits for seeded, bounded (\"$cmd\"), and passes a fleet whose units were still queued at first"
  else bad "$1 is judged by \"$cmd\" (rc $rc against units still queued at first)"; fi
}
judged "upgrade fleet_seeded" "$ROOT/scripts/substrate/acceptance/run-upgrade-acceptance.sh" C
judged "network spoke_seeded" "$ROOT/scripts/substrate/acceptance/run-network-acceptance.sh" SPOKE_C
echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
