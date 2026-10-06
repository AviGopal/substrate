#!/usr/bin/env bash
# units-run-accepted-glue.test.sh: no unit runs a tick script from the super-repo clone.
#
# On a gated node the clone's HEAD is an unjudged candidate: Gate P soaks it while it is already checked
# out. A unit whose ExecStart names ${SUBSTRATE_ROOT}/scripts/... therefore runs candidate code on its next
# firing, before the gate accepts it (gap every-path-that-changes-running-code-must-pass-the-accepted-gate-first).
# Units run tick scripts from ${SUBSTRATE_RUN_DIR} instead, which pull-sync fills from the gate-overlaid stage
# and substrate-active-scripts-seed fills at boot from the accepted gate.
#
# Checks, on the EFFECTIVE ExecStart of every units/*.service (a drop-in's empty ExecStart= resets the list):
#   1. none names ${SUBSTRATE_ROOT}/scripts or $SUBSTRATE_ROOT/scripts;
#   2. every ${SUBSTRATE_RUN_DIR}/<file> exists in scripts/substrate, and a non-.ts file is one that both the
#      boot seed and pull-sync's reseed copy (else the unit finds nothing to run);
#   3. the boot seed, run in a sandbox, seeds from accepted with gate state, from the image when gate state has
#      no usable accepted copy, and from the clone only with no gate state at all.
# Negative controls: a unit naming the clone is flagged, and one whose drop-in resets ExecStart is not.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
UNITS="$ROOT/scripts/substrate/units"
SEED="$UNITS/substrate-active-scripts-seed.service"
PS="$ROOT/scripts/substrate/substrate-pull-sync.sh"
T="$(mktemp -d "${TMPDIR:-/tmp}/units-glue.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }

effective() { # unit-file -> its effective ExecStart values, one per line
  local u="$1" d f
  sed -n 's/^ExecStart=//p' "$u" > "$T/eff"
  d="${u}.d"
  if [ -d "$d" ]; then
    for f in $(ls "$d"/*.conf 2>/dev/null | sort); do
      if grep -qx 'ExecStart=' "$f"; then : > "$T/eff"; fi
      sed -n 's/^ExecStart=\(..*\)$/\1/p' "$f" >> "$T/eff"
    done
  fi
  cat "$T/eff"
}
clone_runners() { # units-dir -> "unit: execstart" for every effective ExecStart naming the clone
  local u
  for u in "$1"/*.service; do
    effective "$u" | grep -E '\$\{?SUBSTRATE_ROOT\}?/scripts' | sed "s|^|$(basename "$u"): |"
  done
}

# 1. No unit runs a script from the clone.
found="$(clone_runners "$UNITS")"
if [ -z "$found" ]; then ok "no unit's effective ExecStart runs a script from \${SUBSTRATE_ROOT}/scripts"
else printf '%s\n' "$found" | sed 's/^/  /'; bad "units run tick scripts from the clone ($(printf '%s\n' "$found" | wc -l))"; fi

# 2. Every run-dir file a unit names is something the run dir actually receives.
n=0
for u in "$UNITS"/*.service; do
  for x in $(effective "$u" | grep -oE '\$\{?SUBSTRATE_RUN_DIR\}?/[^ ]+' | sed -E 's#^\$\{?SUBSTRATE_RUN_DIR\}?/##'); do
    n=$((n+1))
    [ -f "$ROOT/scripts/substrate/$x" ] || { bad "$(basename "$u") runs \${SUBSTRATE_RUN_DIR}/$x, which scripts/substrate does not have"; continue; }
    case "$x" in
      *.ts) ;;
      *) grep -q "$x" "$SEED" && grep -q "$x" "$PS" \
           || bad "$(basename "$u") runs \${SUBSTRATE_RUN_DIR}/$x, which the boot seed or pull-sync's reseed does not copy" ;;
    esac
  done
done
[ "$n" -gt 0 ] && ok "every \${SUBSTRATE_RUN_DIR} file a unit runs ($n) is one the run dir receives" || bad "no unit runs from \${SUBSTRATE_RUN_DIR} (the check is reading nothing)"

# 3. The boot seed, RUN (its ExecStart with systemd's $$ unescaped and its four paths moved under $T), picks:
#    no gate state -> the clone; accepted.sha + accepted copies -> accepted; gate state WITHOUT a usable accepted
#    copy -> the image, never the clone (losing one file must not re-open the ungated path). Each source holds a
#    marker script naming itself, so the run dir says where it was seeded from.
seed_cmd="$(sed -n "s/^ExecStart=\/bin\/sh -c '\(.*\)'$/\1/p" "$SEED" | sed 's/\$\$/$/g')"
[ -n "$seed_cmd" ] || bad "could not read the boot seed's ExecStart"
seed_run() { # scenario-setup-fn -> where the run dir was seeded from (clone|accepted|image|none)
  local w="$T/seed.$1"; rm -rf "$w"; mkdir -p "$w/gate" "$w/clone" "$w/img" "$w/gate/accepted/scripts/substrate"
  for src in clone img; do echo "// $src" > "$w/$src/marker.ts"; done
  echo "// accepted" > "$w/gate/accepted/scripts/substrate/marker.ts"
  "$1" "$w"
  local c="${seed_cmd//\/workspace\/active-scripts/$w/rd}"; c="${c//\/workspace\/.gate/$w/gate}"
  c="${c//\/workspace\/git\/super-repo\/scripts\/substrate/$w/clone}"; c="${c//\/usr\/local\/share\/substrate\/active-scripts/$w/img}"
  sh -c "$c" >/dev/null 2>&1
  case "$(cat "$w/rd/marker.ts" 2>/dev/null)" in '// clone') echo clone ;; '// accepted') echo accepted ;; '// img') echo image ;; *) echo none ;; esac
}
s_nogate() { rm -rf "$1/gate/accepted"; }                       # entrypoint's empty .gate only
s_accepted() { echo abc > "$1/gate/accepted.sha"; }
s_bootstrapped() { rm -rf "$1/gate/accepted"; : > "$1/gate/bootstrapped"; }
s_ledger_no_sha() { : > "$1/gate/ledger.jsonl"; }              # accepted/ present, accepted.sha lost
s_sha_empty_acc() { echo abc > "$1/gate/accepted.sha"; rm -f "$1/gate/accepted/scripts/substrate/marker.ts"; }
for sc in "s_nogate clone" "s_accepted accepted" "s_bootstrapped image" "s_ledger_no_sha image" "s_sha_empty_acc image"; do
  set -- $sc; got="$(seed_run "$1")"
  [ "$got" = "$2" ] && ok "boot seed, ${1#s_}: seeds from the $2" || bad "boot seed, ${1#s_}: seeded from the $got, expected the $2"
done

# Negative controls: the detector flags a clone runner, and honours a drop-in reset.
mkdir -p "$T/u/bad.service.d" "$T/u/fixed.service.d"
printf '[Service]\nExecStart=/root/.bun/bin/bun ${SUBSTRATE_ROOT}/scripts/substrate/x.ts\n' > "$T/u/bad.service"
printf '[Service]\nExecStart=/root/.bun/bin/bun ${SUBSTRATE_ROOT}/scripts/substrate/y.ts\n' > "$T/u/fixed.service"
printf '[Service]\nExecStart=\nExecStart=/root/.bun/bin/bun ${SUBSTRATE_RUN_DIR}/y.ts\n' > "$T/u/fixed.service.d/run-dir.conf"
neg="$(clone_runners "$T/u")"
case "$neg" in *bad.service:*) ok "negative control: a unit naming the clone is flagged" ;; *) bad "negative control: the clone runner was not flagged" ;; esac
case "$neg" in *fixed.service:*) bad "negative control: a drop-in reset was ignored" ;; *) ok "negative control: a drop-in that resets ExecStart clears the clone path" ;; esac

echo; [ "$FAILS" = 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
