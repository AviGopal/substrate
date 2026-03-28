#!/bin/bash
set -e

# Port forward RPC API
kubectl port-forward -n metabob svc/metabob-rpc-api 8080:8080 &
PF_PID=$!
sleep 3

# Test login
echo "Testing login endpoint..."
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@metabob.com",
    "password": "testpassword123"
  }' | jq .

# Cleanup
kill $PF_PID 2>/dev/null || true
