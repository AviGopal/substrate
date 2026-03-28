#!/bin/bash
# Verify Dashboard Data - Shows what the dashboard should display

API_URL="http://localhost:8082"

echo "=========================================="
echo "MiniBob Activity Dashboard Data"
echo "=========================================="
echo ""

echo "1️⃣  TEMPLATES REGISTERED"
echo "-------------------------------------------"
curl -s "$API_URL/v2/activities/templates" | python3 -c "
import sys, json
data = json.load(sys.stdin)
templates = data.get('templates', [])
print(f'Total Templates: {len(templates)}')
print('')
for t in templates:
    print(f\"  📋 {t['variant_name']}\")
    print(f\"     ID: {t['variant_id']}\")
    print(f\"     Category: {t['category']}\")
    print(f\"     Description: {t['description']}\")
    print(f\"     Tasks: {len(t.get('task_steps', []))}\")
    print('')
"

echo ""
echo "2️⃣  PERFORMANCE METRICS"
echo "-------------------------------------------"
curl -s -X POST --user "root:surrealdb-local-dev-123" \
  --header "surreal-ns: activity-system" \
  --header "surreal-db: learning_loop" \
  --data "SELECT variant_id, total_executions, successful_executions, failed_executions, success_rate, avg_duration_ms, avg_cost_usd, thompson_alpha, thompson_beta FROM variant_performance_metrics;" \
  http://localhost:8000/sql 2>&1 | python3 -c "
import sys, json
data = json.load(sys.stdin)
results = data[0].get('result', [])
print(f'Total Variants Tracked: {len(results)}')
print('')
for m in results:
    print(f\"  📊 {m['variant_id']}\")
    print(f\"     Total Executions: {m['total_executions']}\")
    print(f\"     Success Rate: {m['success_rate'] or 'N/A'}\")
    print(f\"     Successful: {m['successful_executions']} | Failed: {m['failed_executions']}\")
    print(f\"     Avg Duration: {m['avg_duration_ms'] or 'N/A'} ms\")
    print(f\"     Avg Cost: \${m['avg_cost_usd'] or 'N/A'}\")
    print(f\"     Thompson Sampling: α={m['thompson_alpha']}, β={m['thompson_beta']}\")
    print('')
"

echo ""
echo "3️⃣  RECENT EXECUTIONS"
echo "-------------------------------------------"
curl -s -X POST --user "root:surrealdb-local-dev-123" \
  --header "surreal-ns: activity-system" \
  --header "surreal-db: learning_loop" \
  --data "SELECT variant_id, success, duration_ms, cost_usd, tokens_input, tokens_output, executed_at FROM activity_executions ORDER BY executed_at DESC LIMIT 5;" \
  http://localhost:8000/sql 2>&1 | python3 -c "
import sys, json
from datetime import datetime
data = json.load(sys.stdin)
results = data[0].get('result', [])
print(f'Recent Executions: {len(results)}')
print('')
for i, e in enumerate(results, 1):
    status = '✅' if e['success'] else '❌'
    timestamp = e['executed_at'].split('T')[1].split('.')[0]  # Extract time
    print(f\"  {i}. {status} {e['variant_id']}\")
    print(f\"     Time: {timestamp}\")
    print(f\"     Duration: {e['duration_ms']} ms\")
    print(f\"     Cost: \${e['cost_usd']:.4f}\")
    print(f\"     Tokens: {e['tokens_input']} in / {e['tokens_output']} out\")
    print('')
"

echo ""
echo "=========================================="
echo "✅ Dashboard Verification Complete"
echo "=========================================="
echo ""
echo "To view in browser:"
echo "  1. Port-forward: kubectl port-forward -n activity-system svc/activity-dashboard 3000:3000"
echo "  2. Open: http://localhost:3000"
echo ""
