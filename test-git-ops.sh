#!/bin/bash
set -e

echo "=========================================="
echo "Git Operations Validation - All Pods"
echo "=========================================="
echo

for pod in devbob-0 devbob-1 devbob-2; do
  echo "Testing $pod..."
  echo "  ✓ Git config:"
  kubectl exec $pod -n metabob -- git config user.name
  kubectl exec $pod -n metabob -- git config user.email
  
  echo "  ✓ Git version:"
  kubectl exec $pod -n metabob -- git --version
  
  echo "  ✓ GitHub environment:"
  kubectl exec $pod -n metabob -- bash -c 'echo "GITHUB_TOKEN: ${GITHUB_TOKEN:0:4}..."'
  
  echo
done

echo "=========================================="
echo "✅ All pods have git configured!"
echo "=========================================="
