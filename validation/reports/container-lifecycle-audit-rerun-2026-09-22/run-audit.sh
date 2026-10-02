#!/usr/bin/env bash
# Driver for the 2026-09-22 rerun. Phase order reconstructed from the prior
# audit's command receipts. On a phase failure the fleet is LEFT RUNNING for
# diagnosis (cleanup is registry-scoped and run explicitly at the end).
set -uo pipefail
cd "$(dirname "$0")"

PHASES=(bootstrap topology new_network compose inventory manifest human final_checks execution failures persistence)
for p in "${PHASES[@]}"; do
  echo "=== phase_$p $(date -u +%H:%M:%S)" | tee -a driver.log
  if ! python3 "phase_$p.py" >> driver.log 2>&1; then
    echo "=== phase_$p FAILED — fleet left up for diagnosis; run cleanup+score manually" | tee -a driver.log
    exit 1
  fi
done

echo "=== cleanup $(date -u +%H:%M:%S)" | tee -a driver.log
python3 -c "import auditlib; auditlib.cleanup()" >> driver.log 2>&1
echo "=== score $(date -u +%H:%M:%S)" | tee -a driver.log
python3 phase_score.py | tee -a driver.log
