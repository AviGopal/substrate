# Field Manager Conflict Fix

This directory contains scripts to resolve Kubernetes field manager conflicts before running `helmfile sync`.

## Problem

Field manager conflicts occur when:
- A field was previously set by a different manager (e.g., kubectl apply vs helm)
- Helm cannot update fields it doesn't "own"

Common conflicting fields:
- `deployment.spec.selector.matchLabels`
- `deployment.spec.template.metadata.labels`
- `service.spec.selector`

## Solution

The fix uses `kubectl apply --server-side --force-conflicts` to transfer field ownership to Helm.

## Scripts

### 1. `field-manager-conflict-fix.sh` (Recommended)

This script follows the exact pattern from your provided template:

```bash
# Make executable
chmod +x field-manager-conflict-fix.sh

# Run with defaults
./field-manager-conflict-fix.sh

# Or customize with environment variables
NAMESPACE=production \
DEPLOYMENT_NAME=my-app \
OUTPUT_DIR=./fix-results \
./field-manager-conflict-fix.sh
```

### 2. `fix-field-manager-conflicts.sh` (Enhanced)

Enhanced version with more features and validation:

```bash
# Make executable
chmod +x fix-field-manager-conflicts.sh

# Run with parameters
./fix-field-manager-conflicts.sh [namespace] [deployment-name] [output-dir] [force-fix]

# Example
./fix-field-manager-conflicts.sh default metabob-activity-api ./output true
```

## Configuration

Both scripts support these parameters:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `NAMESPACE` | `default` | Kubernetes namespace |
| `DEPLOYMENT_NAME` | `metabob-activity-api` | Target deployment name |
| `OUTPUT_DIR` | `./field-manager-fix-output` | Output directory for logs and backups |
| `FORCE_FIELD_MANAGER_FIX` | `true` | Whether to proceed with the fix |

## Output Files

After running, you'll find:

- `field-manager-fix.json` - Results summary
- `field-manager-fix.log` - Apply command output
- `current-deployment.yaml` - Backup of original deployment

## Workflow

1. **Run the script** to fix field manager conflicts
2. **Review the output** in the generated files
3. **Proceed with helmfile sync** once conflicts are resolved

```bash
# 1. Fix conflicts
./field-manager-conflict-fix.sh

# 2. Check results
cat ./field-manager-fix-output/field-manager-fix.json

# 3. Proceed with deployment
helmfile sync
```

## Troubleshooting

### Script fails with permission errors
```bash
chmod +x *.sh
```

### kubectl not found
Ensure kubectl is installed and configured:
```bash
kubectl version --client
kubectl config current-context
```

### Deployment doesn't exist
The script will skip the fix if no deployment exists yet. This is normal for first-time deployments.

### Force-conflicts warning
The `--force-conflicts` flag is intentional and safe in this context - it transfers field ownership to Helm.

## Next Steps

After running the script successfully:

1. ✅ Field ownership transferred to Helm
2. ✅ Backup created for rollback if needed
3. ✅ Ready to run `helmfile sync`

The field manager conflicts should be resolved, allowing Helm to manage all deployment fields properly.