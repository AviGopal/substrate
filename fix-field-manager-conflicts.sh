#!/bin/bash

# Fix Field Manager Conflicts Script
# Usage: ./fix-field-manager-conflicts.sh [namespace] [deployment-name] [output-dir] [force-fix]

set -euo pipefail

# Configuration
NAMESPACE="${1:-default}"
DEPLOYMENT_NAME="${2:-metabob-activity-api}"
OUTPUT_DIR="${3:-./field-manager-fix-output}"
FORCE_FIELD_MANAGER_FIX="${4:-true}"

echo "🔧 Field Manager Conflict Resolution"
echo "=================================="
echo "Namespace: $NAMESPACE"
echo "Deployment: $DEPLOYMENT_NAME"
echo "Output Directory: $OUTPUT_DIR"
echo "Force Fix: $FORCE_FIELD_MANAGER_FIX"
echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Check if fix is needed
if [[ "$FORCE_FIELD_MANAGER_FIX" != "true" ]]; then
    echo "❌ forceFieldManagerFix is false - skipping field manager fix"
    echo '{"fixed": false, "skipped": true, "reason": "forceFieldManagerFix=false"}' > "$OUTPUT_DIR/field-manager-fix.json"
    exit 0
fi

echo "🔍 Checking for existing deployment..."

# Check if deployment exists
if ! kubectl get deployment "$DEPLOYMENT_NAME" -n "$NAMESPACE" &>/dev/null; then
    echo "❌ Deployment does not exist yet - no conflict possible"
    echo '{"fixed": false, "skipped": true, "reason": "deployment does not exist"}' > "$OUTPUT_DIR/field-manager-fix.json"
    exit 0
fi

echo "✅ Deployment exists: $DEPLOYMENT_NAME"

# Check field managers
echo ""
echo "📊 Current field managers:"
kubectl get deployment "$DEPLOYMENT_NAME" -n "$NAMESPACE" -o json | \
    jq -r '.metadata.managedFields[].manager' | sort -u | while read manager; do
    echo "  - $manager"
done

echo ""
echo "📋 Detailed field manager information:"
kubectl get deployment "$DEPLOYMENT_NAME" -n "$NAMESPACE" -o json | \
    jq '.metadata.managedFields[] | {manager: .manager, operation: .operation, fieldsType: .fieldsType}'

# Get current deployment spec
echo ""
echo "💾 Backing up current deployment specification..."
kubectl get deployment "$DEPLOYMENT_NAME" -n "$NAMESPACE" -o yaml > "$OUTPUT_DIR/current-deployment.yaml"

# Apply server-side apply patch to resolve conflicts
echo ""
echo "🔨 Applying server-side apply with force-conflicts to claim ownership..."

# Apply with force to claim ownership
if kubectl apply -f "$OUTPUT_DIR/current-deployment.yaml" \
    --server-side \
    --force-conflicts \
    --field-manager=helm \
    --dry-run=client &> "$OUTPUT_DIR/dry-run.log"; then
    
    echo "✅ Dry-run successful, proceeding with actual apply..."
    
    if kubectl apply -f "$OUTPUT_DIR/current-deployment.yaml" \
        --server-side \
        --force-conflicts \
        --field-manager=helm 2>&1 | tee "$OUTPUT_DIR/field-manager-fix.log"; then
        
        echo "✅ Field manager conflicts resolved successfully"
        FIX_STATUS="success"
    else
        echo "⚠️  Warning: Field manager fix may have failed, but continuing anyway"
        FIX_STATUS="warning"
    fi
else
    echo "❌ Dry-run failed, check the logs for issues"
    cat "$OUTPUT_DIR/dry-run.log"
    FIX_STATUS="failed"
fi

# Verify the fix
echo ""
echo "🔍 Verifying field manager changes..."
kubectl get deployment "$DEPLOYMENT_NAME" -n "$NAMESPACE" -o json | \
    jq -r '.metadata.managedFields[].manager' | sort -u | while read manager; do
    echo "  - $manager"
done

# Create result JSON
cat > "$OUTPUT_DIR/field-manager-fix.json" << EOF
{
  "fixed": true,
  "status": "$FIX_STATUS",
  "deployment": "$DEPLOYMENT_NAME",
  "namespace": "$NAMESPACE",
  "method": "server-side apply with force-conflicts",
  "fieldManager": "helm",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "backupFile": "$OUTPUT_DIR/current-deployment.yaml",
  "logFile": "$OUTPUT_DIR/field-manager-fix.log"
}
EOF

echo ""
echo "📄 Results written to: $OUTPUT_DIR/field-manager-fix.json"

# Show summary
echo ""
echo "📋 Summary:"
echo "==========="
if [[ "$FIX_STATUS" == "success" ]]; then
    echo "✅ Field manager conflicts have been resolved"
    echo "✅ Helm should now be able to manage the deployment"
    echo "✅ You can proceed with 'helmfile sync'"
elif [[ "$FIX_STATUS" == "warning" ]]; then
    echo "⚠️  Field manager fix completed with warnings"
    echo "⚠️  Check the logs and verify before proceeding"
else
    echo "❌ Field manager fix failed"
    echo "❌ Manual intervention may be required"
fi

echo ""
echo "🚀 Next steps:"
echo "  1. Review the output in $OUTPUT_DIR/"
echo "  2. Run 'helmfile sync' to deploy your changes"
echo "  3. Monitor the deployment for any issues"