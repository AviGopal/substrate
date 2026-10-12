#!/usr/bin/env bash
# status-boot-stall-window.test.sh: substrate-status's `live` level must judge a stuck boot over a short window, not
# from one instant. Right after a boot, timer-started one-shots run back to back; read once, the gap between two of
# them ("starting", 1 job queued, 0 running) failed `live` on a fleet that had just reached `seeded` (upgrade
# acceptance, 2026-10-12). A real stall (no job ever runs) must still fail.
#   (a) MUST-FAIL: queued-but-idle at the first sample, a job running at the next -> not failed (boot note instead)
#   (b) MUST-FAIL: queued-but-idle, then the boot finishes (running) -> not failed
#   (c) control: queued-but-idle at every sample -> fails, naming the job counts
#   (d) control: initializing still fails at once (no window)
#   (e) a job running at the first sample -> boot note, no waiting
# The boot-state block is extracted from eval_live and run with systemctl and sleep stubbed; nothing touches systemd.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; F="${1:-$HERE/../../scripts/substrate/substrate-status.sh}"
T="$(mktemp -d "${TMPDIR:-/tmp}/bootstall.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
sed -n '/^boot_jobs_sample() {/,/^}/p' "$F" > "$T/sample.sh"
awk '/^eval_live\(\) \{/{f=1} f && /local sys_state; sys_state=/{on=1} on{print} on && /boot_note=" \(boot still finishing/{getline; print; exit}' "$F" > "$T/blk.sh"
grep -q 'boot_jobs_sample' "$T/blk.sh" 2>/dev/null && grep -q 'boot_jobs_sample() {' "$T/sample.sh" && tail -1 "$T/blk.sh" | grep -q 'esac' \
  || { echo "FAIL - could not extract the boot-state block (a single-sample status has no window: red)"; exit 1; }
# Scripted systemd: line N of $T/script is "<state> <queued> <running>" for the Nth reading.
run() { # $@ readings -> "<V>|<E>|<boot_note>|<sleeps>"
  printf '%s\n' "$@" > "$T/script"; echo 1 > "$T/n"; : > "$T/sleeps"
  ( cur() { sed -n "$(cat "$T/n")p" "$T/script"; }
    systemctl() {
      local r; r="$(cur)"; [ -n "$r" ] || r="$(tail -1 "$T/script")"
      set -- "$@"
      case "$1" in
        is-system-running) echo "${r%% *}" ;;
        list-jobs) local q rr i; q="$(echo "$r" | awk '{print $2}')"; rr="$(echo "$r" | awk '{print $3}')"
          for i in $(seq 1 "$rr"); do echo "$i x.service start running"; done
          for i in $(seq 1 $((q - rr))); do echo "$((100+i)) y.service start waiting"; done
          echo $(( $(cat "$T/n") + 1 )) > "$T/n" ;;
      esac
    }
    sleep() { echo s >> "$T/sleeps"; }
    . "$T/sample.sh"
    sed -i 's/local boot_note="" jobs_q jobs_r/boot_note=""; jobs_q=""; jobs_r=""/' "$T/blk.sh"
    g() { eval "$(cat "$T/blk.sh")"; }
    V=""; E=""; boot_note=""; g
    printf '%s|%s|%s|%s' "${V:-}" "${E:-}" "${boot_note:-}" "$(grep -c . "$T/sleeps")" )
}
r="$(run 'starting 1 0' 'starting 2 1')"; IFS='|' read -r V E N S <<<"$r"
[ "$V" != fail ] && ok "(a) a gap between two jobs is not a stuck boot" || bad "(a) failed: $E"
case "$N" in *"boot still finishing"*) ok "(a) reported as a boot still finishing" ;; *) bad "(a) no boot note ('$N')" ;; esac
r="$(run 'starting 1 0' 'running 0 0')"; IFS='|' read -r V E N S <<<"$r"
[ "$V" != fail ] && ok "(b) a boot that finishes inside the window is not failed" || bad "(b) failed: $E"
r="$(run 'starting 1 0')"; IFS='|' read -r V E N S <<<"$r"
[ "$V" = fail ] && ok "(c) idle with a queued job at every sample: fails" || bad "(c) a persistent stall did not fail"
case "$E" in *"1 job(s) queued, 0 running"*) ok "(c) names the job counts" ;; *) bad "(c) evidence '$E'" ;; esac
[ "$S" = 5 ] && ok "(c) judged over the whole window (5 samples)" || bad "(c) $S re-samples, expected 5"
r="$(run 'initializing 3 0')"; IFS='|' read -r V E N S <<<"$r"
[ "$V" = fail ] && [ "$S" = 0 ] && ok "(d) initializing still fails at once" || bad "(d) V=$V sleeps=$S"
r="$(run 'starting 2 1')"; IFS='|' read -r V E N S <<<"$r"
[ "$V" != fail ] && [ "$S" = 0 ] && ok "(e) a running job at the first sample: no waiting" || bad "(e) V=$V sleeps=$S"
echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
