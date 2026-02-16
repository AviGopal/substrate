#!/bin/bash
# Commit the SurrealDB helmfile fix

set -e

cd repos/platform/metabob-apps

echo "=== Committing SurrealDB Helmfile Fix ==="
echo ""

echo "1. Showing diff one more time..."
git diff helmfile.yaml.gotmpl

echo ""
echo "2. Staging changes..."
git add helmfile.yaml.gotmpl
echo "   ✅ Staged helmfile.yaml.gotmpl"

echo ""
echo "3. Creating commit..."
git commit -m "fix: remove inline surrealdb values preventing environment-specific config load

The inline values block was preventing the *envSpec anchor from loading
production.surrealdb.values.yaml which contains persistence configuration
(enabled: true, size: 50Gi, storageClass: standard-rwo).

Credentials are already available from environments/production/secrets.yaml
via .Values.surrealdb.username and .Values.surrealdb.password, so the
inline values block was redundant and conflicting.

This fix ensures StatefulSet with persistent storage is correctly rendered
instead of a Deployment, preventing potential data loss.

Verification:
- helmfile write-values now includes persistence config ✓
- helmfile template renders StatefulSet (not Deployment) ✓
- volumeClaimTemplates present in rendered manifest ✓

Related: Session analysis from Feb 16 2026 deployment state review"

echo ""
echo "✅ Commit created successfully"
echo ""

echo "4. Showing commit..."
git log -1 --stat

echo ""
echo "=== COMMIT COMPLETE ==="
echo ""
echo "To push to remote:"
echo "  cd repos/platform/metabob-apps"
echo "  git push origin main  # or your branch name"
