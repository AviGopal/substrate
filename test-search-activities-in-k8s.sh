#!/bin/bash
echo "Testing activity template search in DevBob K8s pod..."
kubectl exec devbob-0 -n metabob -c devbob -- bash -c '
cd /tmp/test-workspace
echo "Using search_activities tool to list templates" > query.txt
opencode --non-interactive "search_activities(category: \"feature\", verbose: true)" 2>&1
' | tail -100
