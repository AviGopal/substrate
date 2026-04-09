#!/bin/bash
set -e

# Terminal Vessel Development with Observation Loop
# This script demonstrates the complete observe/learn/improve cycle

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERMINAL_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$(dirname "$(dirname "$TERMINAL_DIR")")"

echo "🔬 Terminal Vessel Development with Observation"
echo "================================================"
echo ""

# Check if MiniBob is configured
if ! command -v minibob &> /dev/null; then
    echo "❌ MiniBob not found. Install it first:"
    echo "   curl -fsSL https://minibob.dev/install.sh | sh"
    exit 1
fi

# Check if API key is configured
if [ -z "$METABOB_API_KEY" ]; then
    echo "⚠️  METABOB_API_KEY not set"
    echo "   Set it in ~/.metabob/config.json or export METABOB_API_KEY=..."
    exit 1
fi

# ============================================================
# STEP 1: Register Observation Activities
# ============================================================
echo "📋 Step 1: Registering observation activities..."

for activity_file in "$TERMINAL_DIR"/activities/*.json; do
    activity_name=$(basename "$activity_file" .json)
    echo "   Registering: $activity_name"

    curl -s -X POST https://activity.metabob.com/v2/activities/templates \
        -H "Authorization: ApiKey $METABOB_API_KEY" \
        -H "Content-Type: application/json" \
        -d @"$activity_file" > /dev/null
done

echo "✅ Activities registered"
echo ""

# ============================================================
# STEP 2: Run Test Observation
# ============================================================
echo "🧪 Step 2: Observing test execution..."

minibob --single "execute activity: terminal-observe-test-run"

TEST_TRACE_ID=$(minibob get-last-trace-id)
echo "   Trace ID: $TEST_TRACE_ID"

# Query the trace
TEST_TRACE=$(curl -s "https://activity.metabob.com/v2/activities/execution-traces/$TEST_TRACE_ID" \
    -H "Authorization: ApiKey $METABOB_API_KEY")

TEST_STATUS=$(echo "$TEST_TRACE" | jq -r '.status')
TEST_DURATION=$(echo "$TEST_TRACE" | jq -r '.duration_ms')

if [ "$TEST_STATUS" = "completed" ]; then
    echo "✅ Tests passed (${TEST_DURATION}ms)"
else
    echo "❌ Tests failed"
    echo "$TEST_TRACE" | jq '.error'
fi

echo ""

# ============================================================
# STEP 3: Check Thompson Sampling Score
# ============================================================
echo "📊 Step 3: Checking success rate..."

SCORE=$(curl -s "https://activity.metabob.com/v2/activities/thompson-sampling/score?activity_id=terminal-observe-test-run" \
    -H "Authorization: ApiKey $METABOB_API_KEY")

ALPHA=$(echo "$SCORE" | jq -r '.alpha // 1')
BETA=$(echo "$SCORE" | jq -r '.beta // 1')
SUCCESS_RATE=$(echo "scale=3; $ALPHA / ($ALPHA + $BETA)" | bc)

echo "   Thompson Sampling:"
echo "   - α (successes): $ALPHA"
echo "   - β (failures): $BETA"
echo "   - Success rate: $SUCCESS_RATE"

if (( $(echo "$SUCCESS_RATE < 0.7" | bc -l) )); then
    echo "   ⚠️  Success rate below 70% - consider investigating"
else
    echo "   ✅ Success rate healthy"
fi

echo ""

# ============================================================
# STEP 4: Demonstrate Feature Development with Observation
# ============================================================
echo "🚀 Step 4: Observing feature development (example)..."
echo "   Usage: FEATURE='add session timeout' $0"

if [ -n "$FEATURE" ]; then
    echo "   Feature requested: $FEATURE"

    # Create feature description impulse
    FEATURE_IMPULSE=$(cat <<EOF
{
  "id": "feature-request-$(date +%s)",
  "pointer": {
    "type": "memo",
    "content": "$FEATURE"
  },
  "metadata": {
    "shape": "goal"
  }
}
EOF
)

    # Execute feature development observation
    minibob --single "execute activity: terminal-observe-feature-development with impulse: $FEATURE_IMPULSE"

    FEATURE_TRACE_ID=$(minibob get-last-trace-id)
    echo "   Feature trace: $FEATURE_TRACE_ID"

    # Check outcome
    FEATURE_TRACE=$(curl -s "https://activity.metabob.com/v2/activities/execution-traces/$FEATURE_TRACE_ID" \
        -H "Authorization: ApiKey $METABOB_API_KEY")

    FEATURE_STATUS=$(echo "$FEATURE_TRACE" | jq -r '.status')

    if [ "$FEATURE_STATUS" = "completed" ]; then
        echo "   ✅ Feature implemented successfully"

        # Show what changed
        FILES_CHANGED=$(echo "$FEATURE_TRACE" | jq -r '.state_transition.after | keys | length')
        echo "   Files modified: $FILES_CHANGED"
    else
        echo "   ❌ Feature implementation failed"
        echo "   Reason: $(echo "$FEATURE_TRACE" | jq -r '.error')"
    fi
else
    echo "   Skipped (no FEATURE specified)"
fi

echo ""

# ============================================================
# STEP 5: Analyze Recent Traces
# ============================================================
echo "🔍 Step 5: Analyzing recent development traces..."

minibob --single "execute activity: terminal-analyze-development-traces"

ANALYSIS_TRACE_ID=$(minibob get-last-trace-id)

# Get analysis results
ANALYSIS_TRACE=$(curl -s "https://activity.metabob.com/v2/activities/execution-traces/$ANALYSIS_TRACE_ID" \
    -H "Authorization: ApiKey $METABOB_API_KEY")

# Check if suggestions were created
if [ -f /tmp/terminal-suggestions.txt ]; then
    echo "   Suggestions:"
    cat /tmp/terminal-suggestions.txt | sed 's/^/   - /'
else
    echo "   ✅ No issues detected"
fi

echo ""

# ============================================================
# STEP 6: Show Learning Loop Summary
# ============================================================
echo "📈 Step 6: Learning loop summary"
echo "================================"
echo ""

# Get all terminal-related traces
ALL_TRACES=$(curl -s "https://activity.metabob.com/v2/activities/execution-traces?repository=terminal-vessel&limit=50" \
    -H "Authorization: ApiKey $METABOB_API_KEY")

TOTAL_TRACES=$(echo "$ALL_TRACES" | jq '.traces | length')
SUCCESSFUL_TRACES=$(echo "$ALL_TRACES" | jq '[.traces[] | select(.status == "completed")] | length')
OVERALL_SUCCESS_RATE=$(echo "scale=3; $SUCCESSFUL_TRACES / $TOTAL_TRACES" | bc)

echo "Overall statistics:"
echo "- Total executions: $TOTAL_TRACES"
echo "- Successful: $SUCCESSFUL_TRACES"
echo "- Success rate: $OVERALL_SUCCESS_RATE"
echo ""

# Show activity breakdown
echo "Activity breakdown:"
echo "$ALL_TRACES" | jq -r '
  .traces |
  group_by(.activity_id) |
  map({
    activity: .[0].activity_id,
    count: length,
    successes: [.[] | select(.status == "completed")] | length
  }) |
  .[] |
  "- \(.activity): \(.successes)/\(.count) succeeded"
'

echo ""
echo "✅ Observation loop complete!"
echo ""
echo "Next steps:"
echo "1. View traces at: https://activity.metabob.com/traces?repository=terminal-vessel"
echo "2. Check Thompson Sampling scores for variant suggestions"
echo "3. Review any GitHub issues created by analysis"
