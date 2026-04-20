#!/usr/bin/env bash
#
# Apply critical schema fixes to canary database
# Fixes:
# 1. impulse_resolution_metrics org_id type (record -> string)
# 2. Thompson Sampling fields (migration 059)
#

set -euo pipefail

# Configuration
SURREAL_URL="${SURREAL_URL:-https://surql.metabob.com}"
SURREAL_NAMESPACE="${SURREAL_NAMESPACE:-activity-system}"
SURREAL_DATABASE="${SURREAL_DATABASE:-learning_loop}"
SURREAL_USER="${SURREAL_USER:-root}"
SURREAL_PASS="${SURREAL_PASS:-}"

if [ -z "$SURREAL_PASS" ]; then
  echo "❌ Error: SURREAL_PASS environment variable not set"
  echo "Usage: SURREAL_PASS=<password> $0"
  exit 1
fi

echo "🔧 Applying schema fixes to canary database"
echo "📍 URL: $SURREAL_URL"
echo "📦 Namespace: $SURREAL_NAMESPACE"
echo "🗄️  Database: $SURREAL_DATABASE"
echo ""

# Function to execute SQL
execute_sql() {
  local sql_file="$1"
  echo "📄 Applying: $(basename "$sql_file")"

  surreal sql \
    --endpoint "$SURREAL_URL" \
    --namespace "$SURREAL_NAMESPACE" \
    --database "$SURREAL_DATABASE" \
    --username "$SURREAL_USER" \
    --password "$SURREAL_PASS" \
    --file "$sql_file"

  if [ $? -eq 0 ]; then
    echo "✅ Applied: $(basename "$sql_file")"
  else
    echo "❌ Failed: $(basename "$sql_file")"
    return 1
  fi
}

# Apply migrations in order
REPO_ROOT="/home/avi/documents/work/exp-repo/metabob-devbob"
MIGRATIONS_DIR="$REPO_ROOT/repos/metabob-activity-api/sql/migrations"
SQL_DIR="$REPO_ROOT/repos/metabob-activity-api/sql"

echo "🔄 Step 1: Apply Thompson Sampling fields (migration 059)"
if [ -f "$MIGRATIONS_DIR/059-add-thompson-sampling-fields.surql" ]; then
  execute_sql "$MIGRATIONS_DIR/059-add-thompson-sampling-fields.surql"
else
  echo "⚠️  Migration 059 not found, may already be applied"
fi

echo ""
echo "🔄 Step 2: Fix impulse_resolution_metrics org_id type"
if [ -f "$MIGRATIONS_DIR/070-fix-impulse-metrics-org-id.surql" ]; then
  execute_sql "$MIGRATIONS_DIR/070-fix-impulse-metrics-org-id.surql"
else
  echo "❌ Migration 070 not found"
  exit 1
fi

echo ""
echo "🔄 Step 3: Apply updated impulse metrics schema"
if [ -f "$SQL_DIR/008-impulse-resolution-metrics.surql" ]; then
  # This will re-apply with corrected org_id type
  execute_sql "$SQL_DIR/008-impulse-resolution-metrics.surql"
else
  echo "❌ impulse metrics schema not found"
  exit 1
fi

echo ""
echo "✅ All schema fixes applied successfully!"
echo ""
echo "📊 Verify with:"
echo "  curl -H 'Authorization: ApiKey \$METABOB_API_KEY' https://activity.metabob.com/v2/impulses/resolution-metrics?limit=5"
