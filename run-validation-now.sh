#!/bin/bash
# Quick validation runner

source /tmp/e2e-test-creds.sh
export API_BASE_URL="http://app.metabob.local"

echo "Testing API connectivity..."
curl -s -o /dev/null -w "%{http_code}" http://app.metabob.local/health || echo "API not accessible"

echo ""
echo "Current deployment check..."
kubectl get deployment metabob-rpc-api -n metabob -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null || echo "Cannot access k8s"

echo ""
echo "Attempting validation (may fail if deployment not updated)..."
cd tests/validation-harnesses
chmod +x run-validation-metabob-cli-to-dashboard.sh
./run-validation-metabob-cli-to-dashboard.sh 2>&1 | tee /tmp/validation-output.txt
