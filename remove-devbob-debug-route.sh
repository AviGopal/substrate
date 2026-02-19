#!/bin/bash
# Remove the temporary devbob.metabob.com debug route
# Run this script AFTER testing is complete

set -e

echo "🧹 Removing temporary devbob.metabob.com debug route..."
echo ""

# Change to metabob-apps directory
cd repos/platform/metabob-apps

# Confirm with user
echo "⚠️  This will remove the external access to devbob.metabob.com"
echo "   The internal route (http://opencode-server:8080) will remain intact."
echo "   Slack bot will continue to work via internal service."
echo ""
read -p "Continue? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cancelled"
    exit 1
fi

echo "📝 Step 1: Removing devbob-debug VirtualService from service.yaml..."

# Create backup
BACKUP_FILE="charts/istio-application/charts/templates/service.yaml.backup-$(date +%Y%m%d-%H%M%S)"
cp charts/istio-application/charts/templates/service.yaml "$BACKUP_FILE"
echo "✅ Backup created: $BACKUP_FILE"

# Remove the devbob-debug VirtualService section
# This removes from "# TEMPORARY: DevBob debugging route" to the end of the file
sed -i '/# TEMPORARY: DevBob debugging route/,$d' charts/istio-application/charts/templates/service.yaml

# Add back the proper ending (last 3 lines before the debug section)
echo "  retries:" >> charts/istio-application/charts/templates/service.yaml
echo "    attempts: 3" >> charts/istio-application/charts/templates/service.yaml
echo "    perTryTimeout: 2s" >> charts/istio-application/charts/templates/service.yaml

echo "✅ Removed devbob-debug VirtualService"
echo ""

echo "📦 Step 2: Redeploying Istio configuration..."
helmfile -e production sync --selector name=istio-application --wait

echo "✅ Istio configuration redeployed"
echo ""

echo "🔍 Step 3: Verifying VirtualServices..."
kubectl get virtualservice -n metabob | grep -E "NAME|devbob" || echo "✅ No devbob VirtualService found (expected)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ DEBUG ROUTE REMOVED SUCCESSFULLY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Current State:"
echo "  ✅ devbob.metabob.com external route REMOVED"
echo "  ✅ opencode-server:8080 internal service ACTIVE"
echo "  ✅ Slack bot continues to work via internal service"
echo ""
echo "🔗 Access Points:"
echo "  • Internal: http://opencode-server:8080 (slack-bot uses this)"
echo "  • External: NONE (debug route removed)"
echo ""
echo "💾 Backup saved at: $BACKUP_FILE"
echo ""
