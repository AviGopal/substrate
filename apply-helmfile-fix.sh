#!/bin/bash
# Apply the SurrealDB helmfile values fix
# This script removes the inline values block that's preventing environment-specific values from loading

set -e

echo "=== SurrealDB Helmfile Fix Application ==="
echo ""

PLATFORM_DIR="repos/platform/metabob-apps"
HELMFILE="$PLATFORM_DIR/helmfile.yaml.gotmpl"

# Safety check
if [ ! -f "$HELMFILE" ]; then
    echo "❌ Helmfile not found at $HELMFILE"
    exit 1
fi

echo "1. Creating backup..."
BACKUP_FILE="${HELMFILE}.backup.$(date +%Y%m%d-%H%M%S)"
cp "$HELMFILE" "$BACKUP_FILE"
echo "   ✅ Backup created: $BACKUP_FILE"

echo ""
echo "2. Showing current surrealdb configuration..."
grep -B3 -A10 "name: surrealdb" "$HELMFILE" | head -15

echo ""
echo "3. Applying fix..."
echo "   Removing inline values block from surrealdb release..."

# Use sed to remove the inline values block
# Strategy: Remove lines between "<<: [*localChart, *envSpec]" and the next release
# The inline values block is:
#   values:
#     - auth:
#         username: {{ .Values | get "surrealdb.username" "metabob-admin" | quote }}
#         password: {{ .Values | get "surrealdb.password" "changeme" | quote }}

# Create a temporary file with the fix
cat "$HELMFILE" | awk '
BEGIN { in_surrealdb=0; in_values_block=0; }
/name: surrealdb/ { in_surrealdb=1; print; next; }
in_surrealdb && /<<: \[.*envSpec.*\]/ { print; in_values_block=1; next; }
in_values_block && /^  values:/ { next; }
in_values_block && /^    - auth:/ { next; }
in_values_block && /^        username:/ { next; }
in_values_block && /^        password:/ { next; }
in_values_block && /^## SERVICES/ { in_surrealdb=0; in_values_block=0; print; next; }
in_values_block && /^$/ { next; }
in_values_block && /^- name:/ { in_surrealdb=0; in_values_block=0; print; next; }
{ print }
' > "${HELMFILE}.tmp"

# Verify the fix didn't break the file
if ! grep -q "name: surrealdb" "${HELMFILE}.tmp"; then
    echo "❌ Fix failed - surrealdb release was removed!"
    rm "${HELMFILE}.tmp"
    exit 1
fi

if ! grep -q "<<: \[.*envSpec.*\]" "${HELMFILE}.tmp"; then
    echo "❌ Fix failed - envSpec anchor was removed!"
    rm "${HELMFILE}.tmp"
    exit 1
fi

# Apply the fix
mv "${HELMFILE}.tmp" "$HELMFILE"
echo "   ✅ Fix applied"

echo ""
echo "4. Showing updated surrealdb configuration..."
grep -B3 -A5 "name: surrealdb" "$HELMFILE" | head -10

echo ""
echo "5. Testing values resolution..."
cd "$PLATFORM_DIR"
helmfile -e production write-values --output-file-template "/tmp/fixed-{{.Release.Name}}.yaml" 2>&1 | grep -v "^Wrote" || true

echo ""
echo "   Checking for persistence config in resolved values..."
if grep -q "persistence:" /tmp/fixed-surrealdb.yaml 2>/dev/null; then
    PERSISTENCE_ENABLED=$(grep "enabled:" /tmp/fixed-surrealdb.yaml | grep -v "^#" | head -1 | awk '{print $2}')
    if [ "$PERSISTENCE_ENABLED" == "true" ]; then
        echo "   ✅ SUCCESS: persistence.enabled: true"
        echo ""
        echo "   Full persistence config:"
        grep -A5 "persistence:" /tmp/fixed-surrealdb.yaml | sed 's/^/      /'
    else
        echo "   ⚠️  Found persistence section but enabled: $PERSISTENCE_ENABLED"
    fi
else
    echo "   ❌ FAILED: Persistence section still missing"
    echo "   Reverting changes..."
    cp "$BACKUP_FILE" "$HELMFILE"
    echo "   ✅ Reverted to backup"
    exit 1
fi

echo ""
echo "6. Testing template rendering..."
helmfile -e production template --selector name=surrealdb > /tmp/fixed-template.yaml 2>&1

RESOURCE_TYPE=$(grep -A30 "name: surrealdb" /tmp/fixed-template.yaml 2>/dev/null | grep "kind:" | head -1 | awk '{print $2}')
echo "   Template renders: $RESOURCE_TYPE"

if [ "$RESOURCE_TYPE" == "StatefulSet" ]; then
    echo "   ✅ Correctly renders StatefulSet"
else
    echo "   ❌ FAILED: Still renders $RESOURCE_TYPE"
    echo "   Reverting changes..."
    cp "$BACKUP_FILE" "$HELMFILE"
    echo "   ✅ Reverted to backup"
    exit 1
fi

echo ""
echo "=== FIX APPLIED SUCCESSFULLY ==="
echo ""
echo "✅ Inline values block removed"
echo "✅ Environment-specific values now loading correctly"
echo "✅ Persistence config present in resolved values"
echo "✅ Template renders StatefulSet"
echo ""
echo "Backup saved at: $BACKUP_FILE"
echo ""
echo "Next steps:"
echo "  1. Review the diff: git diff $HELMFILE"
echo "  2. Run full verification: ./verify-surrealdb-config.sh"
echo "  3. If verification passes, commit: git add $HELMFILE && git commit -m 'fix: surrealdb helmfile values resolution'"
echo "  4. Safe to apply: helmfile -e production apply --selector name=surrealdb"
echo ""
