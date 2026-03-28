#!/bin/bash
set -e

echo "=== SurrealDB Configuration Verification ==="
echo ""

echo "1. Checking helmfile values resolution..."
cd repos/platform/metabob-apps
helmfile -e production write-values --output-file-template "/tmp/helmfile-{{.Release.Name}}.yaml" 2>&1 | grep -v "^Wrote" || true
PERSISTENCE_ENABLED=$(grep -A1 "persistence:" /tmp/helmfile-surrealdb.yaml 2>/dev/null | grep "enabled:" | awk '{print $2}')
echo "   Persistence enabled: $PERSISTENCE_ENABLED"

if [ "$PERSISTENCE_ENABLED" != "true" ]; then
    echo "   ⚠️  WARNING: Persistence is not enabled in resolved values!"
    echo "   This will cause data loss if applied."
    exit 1
fi

echo "   ✅ Persistence is enabled"
echo ""

echo "2. Checking template rendering..."
helmfile -e production template --include-crds > /tmp/rendered-production.yaml 2>&1
RESOURCE_TYPE=$(grep -A30 "name: surrealdb" /tmp/rendered-production.yaml | grep "kind:" | head -1 | awk '{print $2}')
echo "   Rendered resource type: $RESOURCE_TYPE"

if [ "$RESOURCE_TYPE" != "StatefulSet" ]; then
    echo "   ⚠️  WARNING: Template renders Deployment, not StatefulSet!"
    echo "   This will destroy persistent storage."
    exit 1
fi

echo "   ✅ Template renders StatefulSet"
echo ""

echo "3. Checking cluster state..."
CLUSTER_RESOURCE=$(kubectl get statefulset,deployment -n metabob 2>/dev/null | grep surrealdb | awk '{print $1}')
echo "   Current resource: $CLUSTER_RESOURCE"

if [[ ! "$CLUSTER_RESOURCE" =~ "statefulset" ]]; then
    echo "   ⚠️  WARNING: Cluster is not running StatefulSet!"
    exit 1
fi

echo "   ✅ Cluster running StatefulSet"
echo ""

echo "4. Checking PVC..."
PVC_STATUS=$(kubectl get pvc data-surrealdb-0 -n metabob -o jsonpath='{.status.phase}' 2>/dev/null)
PVC_SIZE=$(kubectl get pvc data-surrealdb-0 -n metabob -o jsonpath='{.spec.resources.requests.storage}' 2>/dev/null)
echo "   PVC status: $PVC_STATUS"
echo "   PVC size: $PVC_SIZE"

if [ "$PVC_STATUS" != "Bound" ]; then
    echo "   ⚠️  WARNING: PVC is not bound!"
    exit 1
fi

echo "   ✅ PVC is bound and in use"
echo ""

echo "5. Checking pod logs for storage backend..."
STORAGE_BACKEND=$(kubectl logs surrealdb-0 -n metabob --tail=50 2>/dev/null | grep "Started kvs store" | grep -oP "(rocksdb|memory)")
echo "   Storage backend: $STORAGE_BACKEND"

if [ "$STORAGE_BACKEND" != "rocksdb" ]; then
    echo "   ⚠️  WARNING: Not using rocksdb backend!"
    exit 1
fi

echo "   ✅ Using rocksdb persistent storage"
echo ""

echo "=== VERIFICATION COMPLETE ==="
echo ""
echo "✅ Configuration is correct and safe"
echo "✅ StatefulSet with persistence is configured and running"
echo "✅ Safe to proceed with helmfile sync if needed"
echo ""
echo "Next steps:"
echo "  helmfile -e production apply --selector name=surrealdb"
echo ""
