#!/bin/bash
set -e

API_KEY="mb_tJhNPb5ZycOp5SH42MyaJNlbBU6nN5nk4E_S-ZJI2DM"
API_URL="http://api.metabob.local/api/v1/learning-loop/executions"

echo "Posting activities via CLI (API key)..."
echo "Expected user email: demo_cli_1773464065@metabob.com"
echo ""

# Activity 1: Feature implementation (success)
echo "Activity 1: add-feature-complete (SUCCESS)"
curl -s -X POST $API_URL \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "activity_id": "act_add_user_auth_'$(date +%s)'",
    "template_id": "add-feature-complete",
    "duration_ms": 45000,
    "success": true,
    "tokens_input": 5000,
    "tokens_output": 1500,
    "tokens_cache": 2000,
    "cost_usd": 0.245
  }' | jq '.success'

sleep 1

# Activity 2: Bug fix (success)
echo "Activity 2: fix-bug-complete (SUCCESS)"
curl -s -X POST $API_URL \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "activity_id": "act_fix_auth_bug_'$(date +%s)'",
    "template_id": "fix-bug-complete",
    "duration_ms": 28000,
    "success": true,
    "tokens_input": 3500,
    "tokens_output": 1200,
    "tokens_cache": 1500,
    "cost_usd": 0.182
  }' | jq '.success'

sleep 1

# Activity 3: Refactoring (success)
echo "Activity 3: refactor-with-tests (SUCCESS)"
curl -s -X POST $API_URL \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "activity_id": "act_refactor_auth_'$(date +%s)'",
    "template_id": "refactor-with-tests",
    "duration_ms": 62000,
    "success": true,
    "tokens_input": 7000,
    "tokens_output": 2500,
    "tokens_cache": 3000,
    "cost_usd": 0.428
  }' | jq '.success'

sleep 1

# Activity 4: Add logging (success)
echo "Activity 4: add-comprehensive-logging (SUCCESS)"
curl -s -X POST $API_URL \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "activity_id": "act_add_logging_'$(date +%s)'",
    "template_id": "add-comprehensive-logging",
    "duration_ms": 18000,
    "success": true,
    "tokens_input": 2500,
    "tokens_output": 900,
    "tokens_cache": 1200,
    "cost_usd": 0.128
  }' | jq '.success'

sleep 1

# Activity 5: Feature with failure (to show mixed results)
echo "Activity 5: add-feature-complete (FAILED)"
curl -s -X POST $API_URL \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "activity_id": "act_add_payment_'$(date +%s)'",
    "template_id": "add-feature-complete",
    "duration_ms": 15000,
    "success": false,
    "tokens_input": 2000,
    "tokens_output": 500,
    "tokens_cache": 800,
    "cost_usd": 0.092,
    "error_message": "Test suite failed: payment validation errors",
    "error_type": "validation"
  }' | jq '.success'

sleep 1

# Activity 6: Another successful feature
echo "Activity 6: add-feature-complete (SUCCESS)"
curl -s -X POST $API_URL \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "activity_id": "act_add_notifications_'$(date +%s)'",
    "template_id": "add-feature-complete",
    "duration_ms": 38000,
    "success": true,
    "tokens_input": 4200,
    "tokens_output": 1400,
    "tokens_cache": 1800,
    "cost_usd": 0.215
  }' | jq '.success'

echo ""
echo "✓ Posted 6 activities via CLI"
echo "Waiting 3 seconds for background processing..."
sleep 3
