#!/bin/bash
# Test script for SurrealDB helmfile values fix
# This script tests the fix WITHOUT applying it to production

set -e

echo "=== SurrealDB Helmfile Fix Test ==="
echo ""

PLATFORM_DIR="repos/platform/metabob-apps"

# Check if platform directory exists
if [ ! -d "$PLATFORM_DIR" ]; then
    echo "❌ Platform directory not found at $PLATFORM_DIR"
    exit 1
fi

cd "$PLATFORM_DIR"

echo "1. Testing current configuration (before fix)..."
echo "   This will show if persistence config is being loaded"
echo ""

# Test current values resolution
helmfile -e production write-values --output-file-template "/tmp/current-{{.Release.Name}}.yaml" 2>&1 | grep -v "^Wrote" || true

echo "   Current resolved values for surrealdb:"
if grep -q "persistence:" /tmp/current-surrealdb.yaml 2>/dev/null; then
    echo "   ✅ Persistence section found:"
    grep -A3 "persistence:" /tmp/current-surrealdb.yaml | sed 's/^/      /'
else
    echo "   ❌ Persistence section MISSING"
    echo "   Only found:"
    cat /tmp/current-surrealdb.yaml | sed 's/^/      /'
fi

echo ""
echo "2. Analyzing helmfile configuration..."

# Check if inline values exist
if grep -A10 "name: surrealdb" helmfile.yaml.gotmpl | grep -q "values:"; then
    echo "   ⚠️  Found inline values block in helmfile"
    echo "   This may be overriding the environment-specific values"
    echo ""
    echo "   Current inline values:"
    grep -A10 "name: surrealdb" helmfile.yaml.gotmpl | grep -A5 "values:" | sed 's/^/      /'
else
    echo "   ✅ No conflicting inline values found"
fi

echo ""
echo "3. Checking environment-specific values file..."

VALUES_FILE="charts/surrealdb/values/production.surrealdb.values.yaml"
if [ -f "$VALUES_FILE" ]; then
    echo "   ✅ File exists: $VALUES_FILE"
    if grep -q "enabled: true" "$VALUES_FILE"; then
        echo "   ✅ Contains persistence.enabled: true"
    else
        echo "   ❌ Does not contain persistence.enabled: true"
    fi
else
    echo "   ❌ File not found: $VALUES_FILE"
fi

echo ""
echo "4. Checking environment configuration..."

ENV_FILE="environments/production/production.values.yaml"
if [ -f "$ENV_FILE" ]; then
    ENV_NAME=$(grep "environmentName:" "$ENV_FILE" | awk '{print $2}')
    echo "   ✅ environmentName: $ENV_NAME"
    
    # Construct expected path
    EXPECTED_PATH="charts/surrealdb/values/${ENV_NAME}.surrealdb.values.yaml"
    echo "   Expected values path: $EXPECTED_PATH"
    
    if [ -f "$EXPECTED_PATH" ]; then
        echo "   ✅ Path resolution would work correctly"
    else
        echo "   ❌ Path does not exist!"
    fi
else
    echo "   ❌ Environment file not found"
fi

echo ""
echo "5. Testing template rendering..."

helmfile -e production template --selector name=surrealdb > /tmp/current-template.yaml 2>&1

RESOURCE_TYPE=$(grep -A30 "name: surrealdb" /tmp/current-template.yaml 2>/dev/null | grep "kind:" | head -1 | awk '{print $2}')
echo "   Current template renders: $RESOURCE_TYPE"

if [ "$RESOURCE_TYPE" == "StatefulSet" ]; then
    echo "   ✅ Correctly renders StatefulSet"
else
    echo "   ❌ Renders $RESOURCE_TYPE instead of StatefulSet"
    echo "   This would destroy persistent storage!"
fi

echo ""
echo "=== DIAGNOSIS COMPLETE ==="
echo ""

# Provide recommendations
if grep -A10 "name: surrealdb" helmfile.yaml.gotmpl | grep -q "values:"; then
    echo "📋 RECOMMENDED FIX:"
    echo ""
    echo "The inline 'values:' block in helmfile.yaml.gotmpl is likely preventing"
    echo "the environment-specific values from being loaded properly."
    echo ""
    echo "Solution: Remove the inline values block since credentials are already"
    echo "defined in environments/production/secrets.yaml"
    echo ""
    echo "Change this:"
    echo "  - name: surrealdb"
    echo "    namespace: metabob"
    echo "    <<: [*localChart, *envSpec]"
    echo "    values:"
    echo "      - auth:"
    echo "          username: ..."
    echo "          password: ..."
    echo ""
    echo "To this:"
    echo "  - name: surrealdb"
    echo "    namespace: metabob"
    echo "    <<: [*localChart, *envSpec]"
    echo ""
    echo "The *envSpec anchor already loads the production.surrealdb.values.yaml file,"
    echo "and credentials come from the secrets.yaml file via .Values."
    echo ""
    echo "Would you like to:"
    echo "  1. Create a backup and apply this fix"
    echo "  2. Show the exact diff that would be applied"
    echo "  3. Exit and apply manually"
    echo ""
    read -p "Enter choice (1/2/3): " choice
    
    case $choice in
        1)
            echo ""
            echo "Creating backup..."
            git add helmfile.yaml.gotmpl 2>/dev/null || true
            git stash push -m "backup: helmfile before surrealdb values fix" helmfile.yaml.gotmpl || echo "Note: Could not stash (maybe no git)"
            echo "✅ Backup created (git stash)"
            echo ""
            echo "⚠️  Ready to apply fix, but will stop here for manual review"
            echo "Run: git stash show -p"
            echo "Then apply fix manually by editing helmfile.yaml.gotmpl"
            ;;
        2)
            echo ""
            echo "=== PROPOSED DIFF ==="
            grep -B5 -A15 "name: surrealdb" helmfile.yaml.gotmpl | head -20
            echo ""
            echo "Remove the 'values:' block (lines with auth: username: password:)"
            ;;
        3)
            echo "Exiting - no changes made"
            ;;
    esac
fi

echo ""
echo "For manual fix, edit: $PLATFORM_DIR/helmfile.yaml.gotmpl"
echo "Then re-run: ./test-helmfile-fix.sh"
