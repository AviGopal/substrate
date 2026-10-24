#!/usr/bin/env bash
# self-recovery treats a manifest vessel as "not installed" (wait for vessel-ctl install, never restart the baked unit)
# only when nothing can run it (scripts/substrate/self-recovery-tick.sh not_installed). Runs the script's own function
# against a fixture root with csh/csys stubbed. No container, no network.
#
# Observed: human-surface-vessel was baked with its source, enabled at build and running
# on every node, but where /etc had no render, self-recovery logged "NOT INSTALLED" every tick and skipped it.
#
#   (a) MUST-FAIL: baked + enabled + source present, no /etc render -> installed (watched)
#   (b) control: baked source present but the unit NOT enabled (metric-collector) -> not installed (still waits)
#   (c) control: enabled but no source under /vessels (the 08-07 crash-loop case) -> not installed (still waits)
#   (d) control: a rendered /etc unit -> installed
#   (e) MUST-FAIL: enabled, source NOT under /vessels/<unit> but at the unit's own WorkingDirectory (the federation
#       transport: /usr/local/share/substrate/super-repo/scripts/substrate/federation-relay) -> installed (watched)
#   (f) control: enabled, its WorkingDirectory missing -> not installed (still waits; the 08-07 chdir loop)
# usage: validation/scripts/self-recovery-not-installed.test.sh [path/to/self-recovery-tick.sh]
set -uo pipefail
SCRIPT="${1:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/substrate/self-recovery-tick.sh}"
R="$(mktemp -d)"; trap 'rm -rf "$R"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
sed -n '/^not_installed() {/,/^}/p' "$SCRIPT" > "$R/fn.sh"
[ -s "$R/fn.sh" ] || { echo "FAIL - could not extract not_installed"; exit 1; }
# shellcheck disable=SC1090
source "$R/fn.sh"
csh()  { sh -c "$(printf '%s' "$1" | sed "s#/etc/#$R/etc/#g; s#/vessels/#$R/vessels/#g; s#/usr/local/share/#$R/usr/local/share/#g")"; }
csys() { case "$1" in
  is-enabled) grep -qx "${*: -1}" "$R/enabled" 2>/dev/null ;;
  show) cat "$R/wd/${*: -1}" 2>/dev/null; return 0 ;;
  *) return 1 ;; esac; }
mkdir -p "$R/etc/systemd/system" "$R/vessels" "$R/wd"; : > "$R/enabled"

mkdir -p "$R/vessels/human-surface-vessel"; echo human-surface-vessel >> "$R/enabled"
not_installed human-surface-vessel && bad "(a) a baked, enabled vessel with its source is reported NOT INSTALLED" || ok "(a) baked + enabled + source: installed (watched)"
mkdir -p "$R/vessels/metric-collector-vessel"
not_installed metric-collector-vessel && ok "(b) baked source, unit not enabled: not installed (waits)" || bad "(b) a disabled baked unit is treated as installed"
echo nosource-vessel >> "$R/enabled"
not_installed nosource-vessel && ok "(c) enabled but no source: not installed (waits)" || bad "(c) a baked unit with no source is treated as installed"
: > "$R/etc/systemd/system/rendered-vessel.service"
not_installed rendered-vessel && bad "(d) a rendered /etc unit is reported NOT INSTALLED" || ok "(d) rendered /etc unit: installed"

FR=/usr/local/share/substrate/super-repo/scripts/substrate/federation-relay
mkdir -p "$R$FR"; echo federation-transport-vessel >> "$R/enabled"; printf '%s\n' "$FR" > "$R/wd/federation-transport-vessel"
not_installed federation-transport-vessel && bad "(e) an enabled unit whose source is its own WorkingDirectory (not /vessels/<unit>) is reported NOT INSTALLED" || ok "(e) enabled, source at its WorkingDirectory: installed (watched)"
echo gone-vessel >> "$R/enabled"; printf '%s\n' /usr/local/share/substrate/super-repo/scripts/substrate/nowhere > "$R/wd/gone-vessel"
not_installed gone-vessel && ok "(f) enabled, WorkingDirectory missing: not installed (waits)" || bad "(f) a unit that cannot chdir is treated as installed"

[ "$FAILS" -eq 0 ] && echo "PASS: all not_installed checks" || { echo "FAILED: $FAILS check(s)"; exit 1; }
