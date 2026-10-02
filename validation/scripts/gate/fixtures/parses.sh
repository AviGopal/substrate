#!/usr/bin/env bash
# kind: known-valid
# The candidate gate body parses, and so do its classifier and shadow evaluator when it
# carries them. Run by shadow-eval.sh with PULLSYNC_BIN / CANDIDATE_DIR (see its header).
set -u
rc=0
bash -n "$PULLSYNC_BIN" || { echo "FAIL - the candidate substrate-pull-sync.sh does not parse"; rc=1; }
for f in candidate.sh shadow-eval.sh; do
  p="$CANDIDATE_DIR/scripts/substrate/gate/$f"
  [ -f "$p" ] || continue
  bash -n "$p" || { echo "FAIL - the candidate gate/$f does not parse"; rc=1; }
done
p="$CANDIDATE_DIR/scripts/substrate/gate/gate-policy.json"
if [ -f "$p" ]; then jq -e '.gate_paths|length>0' "$p" >/dev/null 2>&1 || { echo "FAIL - the candidate gate-policy.json has no gate_paths"; rc=1; }; fi
exit $rc
