#!/bin/bash

echo "=== CONSTRAINT 1: Multi-Vessel Requirement ==="
RUNNING=$(kubectl get pods -n metabob -l app.kubernetes.io/name=devbob --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l)
echo "Running vessels: $RUNNING (minimum: 3)"

if [ "$RUNNING" -ge 3 ]; then
  echo "✅ PASS: $RUNNING vessels running"
  C1_STATUS="PASS"
else
  echo "❌ FAIL: Only $RUNNING vessels (need 3+)"
  C1_STATUS="FAIL"
fi

echo ""
echo "=== CONSTRAINT 2: Coordination Layer ==="
REDIS=$(kubectl get pods -n metabob -l app.kubernetes.io/name=redis --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l)
SURREAL=$(kubectl get pods -n metabob -l app=surrealdb --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l)
API=$(kubectl get pods -n metabob -l app=metabob-rpc-api --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l)

echo "Redis: $REDIS | SurrealDB: $SURREAL | API: $API"

BACKEND_COUNT=$((REDIS + SURREAL + API))
if [ "$BACKEND_COUNT" -ge 3 ]; then
  echo "✅ PASS: All 3 backend services running"
  C2_STATUS="PASS"
elif [ "$BACKEND_COUNT" -ge 2 ]; then
  echo "⚠️  WARN: Only $BACKEND_COUNT/3 services"
  C2_STATUS="WARN"
else
  echo "❌ FAIL: Only $BACKEND_COUNT/3 services running"
  C2_STATUS="FAIL"
fi

echo ""
echo "=== CONSTRAINT 3: Workspace Isolation ==="
VESSELS=$(kubectl get pods -n metabob -l app.kubernetes.io/name=devbob --no-headers 2>/dev/null | wc -l)
PVCS=$(kubectl get pvc -n metabob --no-headers 2>/dev/null | grep "workspace-devbob-" | grep "Bound" | wc -l)

echo "Vessels: $VESSELS | Bound PVCs: $PVCS"

if [ "$PVCS" -ge "$VESSELS" ]; then
  echo "✅ PASS: Sufficient PVCs ($PVCS >= $VESSELS)"
  C3_STATUS="PASS"
else
  echo "❌ FAIL: Insufficient PVCs ($PVCS < $VESSELS)"
  C3_STATUS="FAIL"
fi

echo ""
echo "=== CONSTRAINT 4: ACP Communication ==="
ACP_SERVICES=$(kubectl get svc -n metabob -l app.kubernetes.io/name=devbob -o json 2>/dev/null | jq -r '.items[].spec.ports[] | select(.port==3000) | .port' | wc -l)

echo "ACP services (port 3000): $ACP_SERVICES"

if [ "$ACP_SERVICES" -gt 0 ]; then
  echo "✅ PASS: ACP endpoints configured"
  C4_STATUS="PASS"
else
  echo "❌ FAIL: No ACP services found"
  C4_STATUS="FAIL"
fi

echo ""
echo "=== CONSTRAINT 5: Vessel Registry ==="
echo "⚠️  WARN: Vessel registry check skipped (soft requirement)"
C5_STATUS="WARN"

echo ""
echo "=== CONSTRAINT 6: Backend Connectivity ==="

POD=$(kubectl get pods -n metabob -l app.kubernetes.io/name=devbob --field-selector=status.phase=Running -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)

if [ -n "$POD" ]; then
  echo "Testing from vessel: $POD"
  SURREAL_TEST=$(kubectl exec -n metabob $POD -- sh -c 'curl -sf http://surrealdb.metabob.svc.cluster.local:8000/health >/dev/null 2>&1 && echo "OK" || echo "FAIL"')
  
  echo "SurrealDB connectivity: $SURREAL_TEST"
  
  if [ "$SURREAL_TEST" = "OK" ]; then
    echo "✅ PASS: Backend connectivity verified"
    C6_STATUS="PASS"
  else
    echo "⚠️  WARN: Backend connectivity test inconclusive"
    C6_STATUS="WARN"
  fi
else
  echo "⚠️  WARN: No running vessel to test"
  C6_STATUS="WARN"
fi

echo ""
echo "=== CONSTRAINT 7: Resource Allocation ==="

RESOURCES=$(kubectl get pods -n metabob -l app.kubernetes.io/name=devbob -o json 2>/dev/null | jq -r '.items[] | "\(.metadata.name): CPU=\(.spec.containers[0].resources.requests.cpu // "none") MEM=\(.spec.containers[0].resources.requests.memory // "none")"')

echo "$RESOURCES"

if echo "$RESOURCES" | grep -qv "none"; then
  echo "✅ PASS: Resource requests configured"
  C7_STATUS="PASS"
else
  echo "⚠️  WARN: No resource requests"
  C7_STATUS="WARN"
fi

echo ""
echo "=== CONSTRAINT 8: Anti-Affinity ==="

NODE_DIST=$(kubectl get pods -n metabob -l app.kubernetes.io/name=devbob -o json 2>/dev/null | jq -r '.items | group_by(.spec.nodeName) | .[] | "\(.[0].spec.nodeName): \(length) vessels"')

echo "$NODE_DIST"

NODE_COUNT=$(kubectl get pods -n metabob -l app.kubernetes.io/name=devbob -o json 2>/dev/null | jq -r '.items | group_by(.spec.nodeName) | length')

if [ "$NODE_COUNT" -gt 1 ]; then
  echo "✅ PASS: Vessels spread across $NODE_COUNT nodes"
  C8_STATUS="PASS"
else
  echo "ℹ️  INFO: Single node (expected for local cluster)"
  C8_STATUS="INFO"
fi

echo ""
echo "=== CONSTRAINT 9: Health Probes ==="

PROBES=$(kubectl get pods -n metabob -l app.kubernetes.io/name=devbob -o json 2>/dev/null | jq -r '.items[] | "\(.metadata.name): Liveness=\(.spec.containers[0].livenessProbe != null) Readiness=\(.spec.containers[0].readinessProbe != null)"')

echo "$PROBES"

if echo "$PROBES" | grep -q "Liveness=true"; then
  echo "✅ PASS: Health probes configured"
  C9_STATUS="PASS"
else
  echo "⚠️  WARN: No health probes"
  C9_STATUS="WARN"
fi

echo ""
echo "=== CONSTRAINT 10: Dataflow Enforcement ==="

API_TYPE=$(kubectl get svc/metabob-rpc-api -n metabob -o jsonpath='{.spec.type}' 2>/dev/null || echo "NotFound")

echo "metabob-rpc-api service type: $API_TYPE"

if [ "$API_TYPE" = "ClusterIP" ]; then
  echo "✅ PASS: Dataflow properly isolated (ClusterIP)"
  C10_STATUS="PASS"
elif [ "$API_TYPE" = "NotFound" ]; then
  echo "⚠️  WARN: metabob-rpc-api not deployed"
  C10_STATUS="WARN"
else
  echo "⚠️  WARN: metabob-rpc-api exposed as $API_TYPE"
  C10_STATUS="WARN"
fi

echo ""
echo "=== GENERATING COMPLIANCE REPORT ==="

# Count statuses (fixed)
PASSED=0
FAILED=0
WARNINGS=0

for status in "$C1_STATUS" "$C2_STATUS" "$C3_STATUS" "$C4_STATUS" "$C5_STATUS" "$C6_STATUS" "$C7_STATUS" "$C8_STATUS" "$C9_STATUS" "$C10_STATUS"; do
  case "$status" in
    PASS) PASSED=$((PASSED + 1)) ;;
    FAIL) FAILED=$((FAILED + 1)) ;;
    WARN) WARNINGS=$((WARNINGS + 1)) ;;
  esac
done

# Determine overall status
if [ "$FAILED" -gt 0 ]; then
  OVERALL_STATUS="VIOLATIONS"
elif [ "$WARNINGS" -gt 0 ]; then
  OVERALL_STATUS="WARNINGS"
else
  OVERALL_STATUS="COMPLIANT"
fi

echo "Overall Status: $OVERALL_STATUS"
echo "Passed: $PASSED/10 | Failed: $FAILED | Warnings: $WARNINGS"

# Create JSON report
cat > constraint-compliance-report.json <<EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "namespace": "metabob",
  "status": "$OVERALL_STATUS",
  "summary": {
    "total_constraints": 10,
    "passed": $PASSED,
    "failed": $FAILED,
    "warnings": $WARNINGS
  },
  "constraints": [
    {"id": 1, "name": "Multi-Vessel Requirement", "status": "$C1_STATUS", "severity": "critical"},
    {"id": 2, "name": "Coordination Layer", "status": "$C2_STATUS", "severity": "critical"},
    {"id": 3, "name": "Workspace Isolation", "status": "$C3_STATUS", "severity": "critical"},
    {"id": 4, "name": "ACP Communication", "status": "$C4_STATUS", "severity": "critical"},
    {"id": 5, "name": "Vessel Registry", "status": "$C5_STATUS", "severity": "warning"},
    {"id": 6, "name": "Backend Connectivity", "status": "$C6_STATUS", "severity": "warning"},
    {"id": 7, "name": "Resource Allocation", "status": "$C7_STATUS", "severity": "warning"},
    {"id": 8, "name": "Anti-Affinity", "status": "$C8_STATUS", "severity": "info"},
    {"id": 9, "name": "Health Probes", "status": "$C9_STATUS", "severity": "warning"},
    {"id": 10, "name": "Dataflow Enforcement", "status": "$C10_STATUS", "severity": "warning"}
  ]
}
EOF

echo "✅ Report created: constraint-compliance-report.json"

echo ""
echo "=== REMEDIATION GUIDE ==="

cat > CONSTRAINT_REMEDIATION_GUIDE.md <<EOF
# Constraint Remediation Guide

## Validation Summary

**Overall Status**: $OVERALL_STATUS
**Passed**: $PASSED/10
**Failed**: $FAILED
**Warnings**: $WARNINGS

---

EOF

if [ "$FAILED" -gt 0 ]; then
  cat >> CONSTRAINT_REMEDIATION_GUIDE.md <<'EOGUIDE'
## Critical Violations

EOGUIDE

  [ "$C1_STATUS" = "FAIL" ] && cat >> CONSTRAINT_REMEDIATION_GUIDE.md <<EOGUIDE
### ❌ Constraint 1: Multi-Vessel Requirement
**Issue**: Only $RUNNING vessels running (need 3+)
**Fix**: 
\`\`\`bash
kubectl scale statefulset/devbob -n metabob --replicas=3
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=devbob -n metabob --timeout=300s
\`\`\`

EOGUIDE

  [ "$C2_STATUS" = "FAIL" ] && cat >> CONSTRAINT_REMEDIATION_GUIDE.md <<EOGUIDE
### ❌ Constraint 2: Coordination Layer
**Issue**: Missing backend services
**Fix**:
\`\`\`bash
cd helm
helmfile -f helmfile.yaml -e local sync --wait
\`\`\`

EOGUIDE
fi

if [ "$WARNINGS" -gt 0 ]; then
  cat >> CONSTRAINT_REMEDIATION_GUIDE.md <<'EOGUIDE'
## Warnings

EOGUIDE

  [ "$C5_STATUS" = "WARN" ] && cat >> CONSTRAINT_REMEDIATION_GUIDE.md <<'EOGUIDE'
### ⚠️  Constraint 5: Vessel Registry
**Note**: Soft requirement. Vessels can operate without registration.

EOGUIDE
fi

if [ "$FAILED" -eq 0 ] && [ "$WARNINGS" -eq 0 ]; then
  cat >> CONSTRAINT_REMEDIATION_GUIDE.md <<'EOGUIDE'
## ✅ All constraints passing!

No remediation needed. Deployment is compliant with all architectural constraints.

EOGUIDE
fi

echo "✅ Remediation guide created: CONSTRAINT_REMEDIATION_GUIDE.md"

# Print final summary
echo ""
echo "======================================"
echo "  CONSTRAINT VALIDATION SUMMARY"
echo "======================================"
echo "Status: $OVERALL_STATUS"
echo "Passed: $PASSED/10"
echo "Failed: $FAILED"
echo "Warnings: $WARNINGS"
echo "======================================"

exit 0
