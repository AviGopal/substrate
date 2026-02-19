#!/bin/bash
# Test Helm chart with ConfigMap changes

set -e

echo "===================================================================="
echo "Testing OpenCode Server Helm Chart with ConfigMap"
echo "===================================================================="

cd repos/platform/metabob-apps

echo ""
echo "1. Validating Helm chart..."
helm lint charts/opencode-server/charts \
  -f charts/opencode-server/values/production.opencode-server.values.yaml || {
  echo "✗ Helm lint failed"
  exit 1
}
echo "✓ Helm chart syntax valid"

echo ""
echo "2. Rendering templates..."
helm template opencode-server charts/opencode-server/charts \
  -f charts/opencode-server/values/production.opencode-server.values.yaml \
  -f charts/opencode-server/values/production.opencode-server.secrets.yaml \
  > /tmp/rendered-opencode-server.yaml

echo "✓ Templates rendered successfully"

echo ""
echo "3. Checking for ConfigMap..."
if grep -q "kind: ConfigMap" /tmp/rendered-opencode-server.yaml; then
  echo "✓ ConfigMap found in rendered templates"
  echo ""
  echo "ConfigMap content:"
  grep -A 50 "kind: ConfigMap" /tmp/rendered-opencode-server.yaml | head -55
else
  echo "✗ ConfigMap not found in rendered templates"
  exit 1
fi

echo ""
echo "4. Checking for volume mount..."
if grep -q "opencode-config" /tmp/rendered-opencode-server.yaml; then
  echo "✓ opencode-config volume mount found"
else
  echo "✗ opencode-config volume mount not found"
  exit 1
fi

echo ""
echo "5. Validating rendered YAML..."
kubectl apply --dry-run=client -f /tmp/rendered-opencode-server.yaml && {
  echo "✓ Rendered YAML is valid Kubernetes manifest"
} || {
  echo "✗ Rendered YAML has errors"
  exit 1
}

echo ""
echo "===================================================================="
echo "✓ All tests passed!"
echo "===================================================================="
echo ""
echo "Next steps:"
echo "1. Review rendered manifest: cat /tmp/rendered-opencode-server.yaml"
echo "2. Deploy with Helmfile: ./helmfile-deploy-v1.0.1.sh"
