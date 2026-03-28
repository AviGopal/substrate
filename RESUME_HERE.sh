#!/bin/bash
# Quick resume script for next session
# Run this to continue from where we left off

set -e

echo "=== Learning System Fix - Resume Script ==="
echo ""
echo "Current Status: 85% complete, K8s deployment issues"
echo "Read: output/honest-assessment/COMPLETE_SESSION_SUMMARY.md"
echo ""

echo "Option 1: Clean Deploy (Recommended)"
echo "  kubectl delete namespace metabob"
echo "  kubectl create namespace metabob"
echo "  cd helm && helmfile -e local sync"
echo ""

echo "Option 2: Check Current Status"
echo "  kubectl get pods -n metabob"
echo "  kubectl logs -n metabob <pod-name>"
echo ""

echo "Documentation:"
echo "  - output/honest-assessment/COMPLETE_SESSION_SUMMARY.md (Full overview)"
echo "  - output/honest-assessment/SESSION_END_STATUS.md (K8s migration)"
echo "  - output/honest-assessment/SESSION_RESUME_SUMMARY.md (Previous work)"
echo ""

echo "Modified Files:"
echo "  - helm/charts/metabob-rpc-api.values.yaml"
echo "  - helm/charts/metabob-rpc-api/templates/deployment-api.yaml"
echo "  - repos/metabob-rpc-api/server/routes/activity.py"
echo "  - repos/metabob-rpc-api/server/db/operations/template_metrics.py"
echo ""

echo "Image Built: metabobapp/metabob-rpc-api:0.16.12"
echo ""
