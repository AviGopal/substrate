#!/bin/bash
echo "Checking validation prerequisites..."

# Check if cluster is accessible
if ! kubectl cluster-info &>/dev/null; then
  echo "❌ Kubernetes cluster not accessible"
  exit 1
fi

# Check namespace
if ! kubectl get namespace metabob &>/dev/null; then
  echo "❌ Namespace 'metabob' not found"
  exit 1
fi

echo "✅ Prerequisites look good"
