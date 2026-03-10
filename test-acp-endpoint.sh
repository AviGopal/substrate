#!/bin/bash
# Test ACP endpoint with minimal ndjson message
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"clientInfo":{"name":"test-client","version":"1.0.0"}}}' | \
  curl -v -X POST \
    -H "Content-Type: application/x-ndjson" \
    --data-binary @- \
    http://devbob.metabob.svc.cluster.local:8080/acp/stream \
    --max-time 10
