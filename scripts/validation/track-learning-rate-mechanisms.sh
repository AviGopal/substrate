#!/usr/bin/env bash
LABEL="${1:-snapshot}"
OUT="$CLAUDE_JOB_DIR/tracking_${LABEL}.json"

sql_count() {
  # SurrealDB count helper — returns single integer
  docker exec substrate-live bash -c "
    source /etc/substrate/env
    curl -s -X POST http://localhost:8000/sql \
      -u \"\$SURREALDB_USERNAME:\$SURREALDB_PASSWORD\" \
      -H 'surreal-ns: activity-system' -H 'surreal-db: learning_loop' -H 'Accept: application/json' \
      -d \"$1\"
  " | python3 -c "
import json,sys
d = json.load(sys.stdin)
r = d[0].get('result', 0)
if isinstance(r, int): print(r)
elif isinstance(r, list):
    if not r: print(0)
    elif isinstance(r[0], dict): print(r[0].get('n', r[0].get('count', 0)))
    else: print(len(r))
else: print(0)
"
}

# Capture current time as ISO for 30-min-ago window
since=$(date -u -d '30 minutes ago' +%Y-%m-%dT%H:%M:%SZ)

# M1: dormant — schema applied?
M1_TABLE_EXISTS=$(docker exec substrate-live bash -c '
source /etc/substrate/env
curl -s -X POST http://localhost:8000/sql \
  -u "$SURREALDB_USERNAME:$SURREALDB_PASSWORD" \
  -H "surreal-ns: activity-system" -H "surreal-db: learning_loop" -H "Accept: application/json" \
  -d "INFO FOR DB;"
' | python3 -c "import json,sys;d=json.load(sys.stdin);t=d[0].get('result',{}).get('tables',{}) if isinstance(d[0].get('result'),dict) else {};print('yes' if 'embedding_prior_weights' in t else 'no')")
M1=$(sql_count "RETURN array::len((SELECT id FROM embedding_prior_weights));")

# M2: variants warm-started by prior-seed (we look at fresh rows created AFTER restart with α+β > 2)
M2_TOTAL=$(sql_count "RETURN array::len((SELECT id FROM variant_performance_metrics));")
M2_WARM=$(sql_count "RETURN array::len((SELECT id FROM variant_performance_metrics WHERE created_at > <datetime>\\\"$since\\\" AND (thompson_alpha + thompson_beta) > 2.001));")
M2_NEW_TOTAL=$(sql_count "RETURN array::len((SELECT id FROM variant_performance_metrics WHERE created_at > <datetime>\\\"$since\\\"));")

# M3: ribosome-vessel runReplayJob / template_created consumption
M3_LINES=$(docker exec substrate-live journalctl -u ribosome-vessel.service --since "30 minutes ago" --no-pager 2>&1 | grep -cE "template_created|runReplayJob|onTemplateCreated|background_replay")

# M4: dispatches stamped tier_uniform OR skipped via posterior skipped_reason
M4_DISPATCHES=$(sql_count "RETURN array::len((SELECT id FROM activity_execution_traces WHERE selection_metadata.sample_source = 'tier_uniform'));")

# M6: chain-credit-eligible traces in window + lifetime
M6_30MIN=$(sql_count "RETURN array::len((SELECT id FROM activity_execution_traces WHERE composition_chain IS NOT NONE AND array::len(composition_chain) >= 1 AND created_at > <datetime>\\\"$since\\\"));")
M6_LIFETIME=$(sql_count "RETURN array::len((SELECT id FROM activity_execution_traces WHERE composition_chain IS NOT NONE AND array::len(composition_chain) >= 1));")

cat > "$OUT" <<EOF
{
  "label": "$LABEL",
  "timestamp": "$(date -u -Iseconds)",
  "since_window": "$since",
  "M1": {
    "embedding_prior_weights_table_exists": "$M1_TABLE_EXISTS",
    "embedding_prior_weights_rows": $M1,
    "status": "dormant_until_training_pipeline + EMBEDDING_PRIOR_ENABLED=true"
  },
  "M2": {
    "total_variants": $M2_TOTAL,
    "new_variants_in_window": $M2_NEW_TOTAL,
    "warm_started_in_window": $M2_WARM,
    "warm_rate": "${M2_WARM}/${M2_NEW_TOTAL}"
  },
  "M3": {
    "ribosome_replay_log_lines_30min": $M3_LINES,
    "ws_connected": "$(docker exec substrate-live systemctl is-active ribosome-vessel.service)"
  },
  "M4": {
    "tier_uniform_dispatches_lifetime": $M4_DISPATCHES
  },
  "M6": {
    "chain_credit_traces_30min": $M6_30MIN,
    "chain_credit_traces_lifetime": $M6_LIFETIME,
    "td_lambda_in_effect": "0.7"
  }
}
EOF
cat "$OUT"
