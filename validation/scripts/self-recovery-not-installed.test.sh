#!/usr/bin/env bash
# self-recovery treats a manifest vessel as "not installed" (wait for vessel-ctl install, never restart the baked unit)
# only when nothing can run it (scripts/substrate/self-recovery-tick.sh not_installed). Runs the script's own function
# against a fixture root with csh/csys stubbed. No container, no network.
#
# Measured 2026-10-16: human-surface-vessel was baked with its source and enabled at build (since 9c39f411) and running
# on all three nodes, but on two of them (no /etc render) self-recovery logged "NOT INSTALLED" every tick and skipped it.
#
#   (a) MUST-FAIL: baked + enabled + source present, no /etc render -> installed (watched)
#   (b) control: baked source present but the unit NOT enabled (metric-collector) -> not installed (still waits)
#   (c) control: enabled but no source under /vessels (the 08-07 crash-loop case) -> not installed (still waits)
#   (d) control: a rendered /etc unit -> installed
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
csh()  { sh -c "$(printf '%s' "$1" | sed "s#/etc/#$R/etc/#g; s#/vessels/#$R/vessels/#g")"; }
csys() { [ "$1" = is-enabled ] && grep -qx "${*: -1}" "$R/enabled" 2>/dev/null; }
mkdir -p "$R/etc/systemd/system" "$R/vessels"; : > "$R/enabled"

mkdir -p "$R/vessels/human-surface-vessel"; echo human-surface-vessel >> "$R/enabled"
not_installed human-surface-vessel && bad "(a) a baked, enabled vessel with its source is reported NOT INSTALLED" || ok "(a) baked + enabled + source: installed (watched)"
mkdir -p "$R/vessels/metric-collector-vessel"
not_installed metric-collector-vessel && ok "(b) baked source, unit not enabled: not installed (waits)" || bad "(b) a disabled baked unit is treated as installed"
echo nosource-vessel >> "$R/enabled"
not_installed nosource-vessel && ok "(c) enabled but no source: not installed (waits)" || bad "(c) a baked unit with no source is treated as installed"
: > "$R/etc/systemd/system/rendered-vessel.service"
not_installed rendered-vessel && bad "(d) a rendered /etc unit is reported NOT INSTALLED" || ok "(d) rendered /etc unit: installed"

[ "$FAILS" -eq 0 ] && echo "PASS: all not_installed checks" || { echo "FAILED: $FAILS check(s)"; exit 1; }
