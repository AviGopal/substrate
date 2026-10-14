#!/usr/bin/env bash
# status-jobs-not-servers.test.sh: substrate-status's `served` level judges the units that SERVE. A timer-triggered
# Type=oneshot job runs, exits and serves nothing in between, so a failed last run of one must be reported in the
# evidence but must not fail `served`. Measured 2026-10-13 on a compute node: rhythm-cadence.service (role compute,
# timer-triggered oneshot) failed one run, and `served` failed for a node whose serving units were all up.
#   (a) unit_is_job: oneshot + TriggeredBy → job; oneshot without a trigger → not; a simple service → not
#   (b) MUST-FAIL: eval_served counts a down job like a self-maintenance unit (reported, not failing)
#   (c) control: a down serving unit (role compute, Type=simple) still fails `served`
# The two functions are extracted from substrate-status and run with systemctl and the readiness JSON stubbed.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; F="${1:-$HERE/../../scripts/substrate/substrate-status.sh}"
T="$(mktemp -d "${TMPDIR:-/tmp}/statusjobs.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
sed -n '/^unit_is_job() {/,/^}/p' "$F" > "$T/job.sh"
awk '/^eval_served\(\) \{/{f=1} f{print} f && /^}/{exit}' "$F" > "$T/served.sh"
grep -q 'unit_is_job() {' "$T/job.sh" && grep -q 'unit_is_job' "$T/served.sh" \
  || { echo "FAIL - eval_served does not consult unit_is_job (a failed timer job fails served: red)"; exit 1; }
# Stub systemd: per-unit Type and TriggeredBy from a table; is-active from a table.
cat > "$T/units" <<'EOF'
rhythm-cadence.service oneshot rhythm-cadence.timer
manual-oneshot.service oneshot -
goal-host-vessel.service simple -
EOF
stub() {
  systemctl() {
    case "$1" in
      show) local p="$3" u="$5" row; row="$(grep "^$u " "$T/units")"
        case "$p" in Type) echo "$row" | awk '{print $2}' ;; TriggeredBy) echo "$row" | awk '{print ($3=="-")?"":$3}' ;; esac ;;
      is-active) echo inactive ;;
    esac
  }
}
( stub; . "$T/job.sh"
  unit_is_job rhythm-cadence.service && ok "(a) a timer-triggered oneshot is a job" || bad "(a) timer oneshot not recognised as a job"
  unit_is_job manual-oneshot.service && bad "(a) an untriggered oneshot counted as a job" || ok "(a) an untriggered oneshot is not a job"
  unit_is_job goal-host-vessel.service && bad "(a) a simple service counted as a job" || ok "(a) a simple service is not a job" ) | tee "$T/a.out"
grep -q '^FAIL' "$T/a.out" && FAILS=$((FAILS+1))
printf '{"vessels":[{"unit":"rhythm-cadence.service","role":"compute"},{"unit":"goal-host-vessel.service","role":"compute"}]}\n' > "$T/inv.json"
served() { # $1 = down unit -> "<V>|<E>"
  ( stub; . "$T/job.sh"; . "$T/served.sh"
    INV="$T/inv.json"; READY_JSON="{\"vessels\":[{\"unit\":\"$1\",\"status\":\"down\"}]}"
    published_ports() { :; }; port_unit() { :; }; row_status() { :; }; bind_class() { echo none; }
    BY_MANIFEST=0; V=""; E=""; eval_served; printf '%s|%s' "$V" "$E" )
}
r="$(served rhythm-cadence.service)"
[ "${r%%|*}" = pass ] && ok "(b) a failed timer job does not fail served" || bad "(b) served=${r%%|*}: ${r#*|}"
case "${r#*|}" in *"job(s) failing"*rhythm-cadence.service*) ok "(b) the job's failure is still reported in the evidence" ;; *) bad "(b) the failure is hidden: ${r#*|}" ;; esac
r="$(served goal-host-vessel.service)"
[ "${r%%|*}" = fail ] && ok "(c) control: a down serving unit still fails served" || bad "(c) served=${r%%|*} for a down serving unit"
echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
