#!/usr/bin/env bash
# verify-vpet-plans.sh
# ---------------------------------------------------------------------------
# Resource-SAFE verification for the v_paradigm_execution_traces (vpet) hot
# path. Runs ONLY metadata + EXPLAIN (query-plan, non-executing) + scalar
# count() probes — it NEVER materialises view rows, so it is safe to run even
# under memory pressure. Do NOT add a bare SELECT to this script.
#
# What it answers (the three open questions the audit could not close live):
#   1. Is the LIVE view NARROW or still FAT? (grep the INFO for the two blob
#      projections `execution_trace` / `trace.tasks`). A fat view is the
#      root of the ~30GB single-query spikes because SurrealDB 2.3.3 loads the
#      FULL row on every Iterate-Table scan, blob included.
#   2. Do the 5 idx_vpet_* indexes exist on the live view?
#   3. Is idx_vpet_executed_at actually USED (not inert) for the unscoped hot
#      list, and idx_vpet_org_time for the org-scoped read? EXPLAIN must show
#      `Iterate Index` (+ ReverseOrder for the DESC case), NOT `Iterate Table`.
#      If EXPLAIN shows Iterate Table despite the index existing, the index is
#      INERT (same failure class as the walk-discovery (ev,created_at) index).
#
# Usage:  docker exec substrate-live bash < scripts/substrate/db/verify-vpet-plans.sh
#   (or copy in and run inside the container). Reads creds from /etc/substrate/env.
#
# BEFORE RUNNING: check load. If MEM is near the cap or CPU >1000%, EXPLAIN is
# still safe (no row load) but the SQL client must reach a responsive DB —
# if /health is erroring, the DB is mid-incident: wait, do not retry-storm.
set -euo pipefail

set -a; source /etc/substrate/env; set +a
SQL() { surreal sql --endpoint "$SURREALDB_URL" --username "$SURREALDB_USERNAME" \
  --password "$SURREALDB_PASSWORD" --namespace "$SURREALDB_NAMESPACE" \
  --database "$SURREALDB_DATABASE" --pretty --hide-welcome <<<"$1"; }

echo "############ 1. LIVE VIEW SHAPE + INDEXES (fat vs narrow) ############"
echo "# Expect NARROW: no 'execution_trace'/'trace.tasks' in the AS SELECT."
echo "# Expect 5 indexes: idx_vpet_execution_id, _org_time, _variant_exec, _variant_time, _executed_at"
SQL 'INFO FOR TABLE v_paradigm_execution_traces;'

echo
echo "############ 2. ROW COUNT (scalar, ~1s — safe) ############"
SQL 'SELECT count() FROM v_paradigm_execution_traces GROUP ALL;'

echo
echo "############ 3. EXPLAIN unscoped hot list (execution-traces.ts GET) ############"
echo "# WANT: { plan:{ index:'\''idx_vpet_executed_at'\'', operator:'\''ReverseOrder'\'' }, operation:'\''Iterate Index'\'' }"
echo "# BAD (index inert / absent): { operation:'\''Iterate Table'\'' } + MemoryOrderedLimit"
SQL "EXPLAIN SELECT execution_id, executed_at FROM v_paradigm_execution_traces ORDER BY executed_at DESC LIMIT 50 START 0;"

echo
echo "############ 4. EXPLAIN org-scoped list (idx_vpet_org_time) ############"
echo "# WANT: Iterate Index on idx_vpet_org_time. Substitute a real org_id if the placeholder returns Iterate Table."
SQL "EXPLAIN SELECT execution_id, executed_at FROM v_paradigm_execution_traces WHERE org_id = 'org_default' ORDER BY executed_at DESC LIMIT 50;"

echo
echo "############ 5. EXPLAIN ribosome extract-from-session (ribosome.ts:697) ############"
echo "# This one CANNOT be indexed: variant_id CONTAINS is a substring match, not equality."
echo "# Expect Iterate Table full scan — the fix is a gated src change (bound/repoint), see report."
SQL "EXPLAIN SELECT execution_id, executed_at FROM v_paradigm_execution_traces WHERE variant_id CONTAINS 'session-xyz' ORDER BY executed_at ASC LIMIT 500;"

echo
echo "############ 6. EXPLAIN ribosome extract-successful GROUP BY (ribosome.ts:791) ############"
echo "# Unbounded aggregation over the whole view (no WHERE, no LIMIT). Expect full scan."
SQL "EXPLAIN SELECT activity_id, count() FROM v_paradigm_execution_traces GROUP BY activity_id;"

echo
echo "############ DONE ############"
echo "# If (1) shows the fat view: the live view was resurfaced by the runtime"
echo "#   re-creator (FILED gap). Immediate remediation (OPERATOR, gated):"
echo "#   REMOVE TABLE v_paradigm_execution_traces; then apply migration 167 body"
echo "#   (or replay the now-narrow schemas/022) in a maintenance window."
echo "# If (3)/(4) show Iterate Table despite the index existing: the index is"
echo "#   INERT — escalate as a planner gap, do NOT add more duplicate indexes."
