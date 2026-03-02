#!/usr/bin/env bash
set -euo pipefail

echo "=========================================="
echo "Applying Schema Fix: Add variant_id Field"
echo "=========================================="

NAMESPACE="metabob"
SURREAL_POD=$(kubectl get pods -n "$NAMESPACE" -l app=surrealdb -o jsonpath='{.items[0].metadata.name}')

if [ -z "$SURREAL_POD" ]; then
    echo "❌ ERROR: No SurrealDB pod found in namespace $NAMESPACE"
    exit 1
fi

echo "✓ Found SurrealDB pod: $SURREAL_POD"

# Create a minimal schema patch with just the new fields
SCHEMA_PATCH=$(cat <<'EOF'
-- Add variant_id and activity_id fields to template_metrics
DEFINE FIELD variant_id ON template_metrics TYPE string
  COMMENT "Template variant identifier (unique, e.g., 'add-feature-complete-a1b2c3d4')";

DEFINE FIELD activity_id ON template_metrics TYPE string
  COMMENT "Base activity identifier without hash (e.g., 'add-feature-complete')";

-- Add unique index for variant_id
DEFINE INDEX idx_template_metrics_variant_id 
  ON template_metrics FIELDS variant_id UNIQUE
  COMMENT "Unique constraint and fast lookup by variant_id";

-- Add index for activity_id
DEFINE INDEX idx_template_metrics_activity_id 
  ON template_metrics FIELDS activity_id
  COMMENT "Query all variants of a base activity";
EOF
)

echo ""
echo "📝 Schema patch to apply:"
echo "$SCHEMA_PATCH"
echo ""

# Apply the schema patch
echo "🔧 Applying schema to SurrealDB..."
echo "$SCHEMA_PATCH" | kubectl exec -i -n "$NAMESPACE" "$SURREAL_POD" -- \
    /surreal sql \
    --endpoint http://localhost:8000 \
    --namespace metabob \
    --database metabob \
    --username root \
    --password root

echo ""
echo "✅ Schema patch applied!"
echo ""

# Verify the schema
echo "🔍 Verifying schema..."
VERIFY_QUERY="INFO FOR TABLE template_metrics;"

echo "$VERIFY_QUERY" | kubectl exec -i -n "$NAMESPACE" "$SURREAL_POD" -- \
    /surreal sql \
    --endpoint http://localhost:8000 \
    --namespace metabob \
    --database metabob \
    --username root \
    --password root

echo ""
echo "=========================================="
echo "✅ Schema fix complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Test metrics creation with: kubectl exec -n metabob deploy/metabob-rpc-api -- curl ..."
echo "2. Verify variant_id persists in SurrealDB"
echo "3. Deploy metabob-cli MCP tool if test passes"
