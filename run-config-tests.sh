#!/bin/bash
set -e

REPO_ROOT="$(pwd)"
METABOB_APPS_DIR="$REPO_ROOT/repos/platform/metabob-apps"

# Test 1: initSchema enabled
cd "$METABOB_APPS_DIR"
enabled=$(grep -A 1 "^initSchema:" charts/surrealdb/values/default.surrealdb.values.yaml | grep "enabled:" | awk '{print $2}')
if [ "$enabled" == "true" ]; then
  echo "TEST1:PASS:initSchema.enabled is true"
else
  echo "TEST1:FAIL:initSchema.enabled is $enabled"
fi

# Test 2: Deployment args
cd "$METABOB_APPS_DIR"
has_ns=$(grep -A 20 "args:" charts/surrealdb/charts/templates/deployment.yaml | grep -c -- "--ns" || true)
has_db=$(grep -A 20 "args:" charts/surrealdb/charts/templates/deployment.yaml | grep -c -- "--db" || true)
if [ "$has_ns" -ge 1 ] && [ "$has_db" -ge 1 ]; then
  echo "TEST2:PASS:Deployment has --ns and --db args"
else
  echo "TEST2:FAIL:Deployment missing args (ns=$has_ns, db=$has_db)"
fi

# Test 3: StatefulSet args
cd "$METABOB_APPS_DIR"
has_ns=$(grep -A 20 "args:" charts/surrealdb/charts/templates/statefulset.yaml | grep -c -- "--ns" || true)
has_db=$(grep -A 20 "args:" charts/surrealdb/charts/templates/statefulset.yaml | grep -c -- "--db" || true)
if [ "$has_ns" -ge 1 ] && [ "$has_db" -ge 1 ]; then
  echo "TEST3:PASS:StatefulSet has --ns and --db args"
else
  echo "TEST3:FAIL:StatefulSet missing args (ns=$has_ns, db=$has_db)"
fi
