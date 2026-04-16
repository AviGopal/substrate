#!/usr/bin/env bash
#
# Migrate Activity Templates from snake_case to camelCase
#
# This script updates all templates in repos/metabob-proto/activities
# to use the camelCase naming convention expected by MiniBob's schema validator.
#

set -e

WORKSPACE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ACTIVITIES_DIR="$WORKSPACE_ROOT/repos/metabob-proto/activities"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "=========================================="
echo "  Template Migration: snake_case → camelCase"
echo "=========================================="
echo ""
echo "Target directory: $ACTIVITIES_DIR"
echo ""

migrated_count=0
skipped_count=0

find "$ACTIVITIES_DIR" -name "*.json" -type f | while read file; do
  # Check if file needs migration
  if grep -q '"variant_id"\|"required_files"\|"required_patterns"\|"forbidden_patterns"\|"max_attempts"\|"max_tokens"\|"compression_strategy"\|"input_schema"\|"output_schema"\|"context_rules"' "$file" 2>/dev/null; then
    echo -e "${BLUE}Migrating:${NC} ${file#$WORKSPACE_ROOT/}"

    # Create backup
    cp "$file" "$file.backup"

    # Apply all transformations
    sed -i \
      -e 's/"variant_id"/"id"/g' \
      -e 's/"required_files"/"requiredFiles"/g' \
      -e 's/"required_patterns"/"requiredPatterns"/g' \
      -e 's/"forbidden_patterns"/"forbiddenPatterns"/g' \
      -e 's/"max_attempts"/"maxAttempts"/g' \
      -e 's/"max_tokens"/"maxTokens"/g' \
      -e 's/"compression_strategy"/"compressionStrategy"/g' \
      -e 's/"input_schema"/"inputSchema"/g' \
      -e 's/"output_schema"/"outputSchema"/g' \
      -e 's/"context_rules"/"contextRules"/g' \
      "$file"

    ((migrated_count++)) || true
  else
    ((skipped_count++)) || true
  fi
done

echo ""
echo "=========================================="
echo "  Migration Complete"
echo "=========================================="
echo ""
echo -e "${GREEN}✓${NC} Migrated: $migrated_count files"
echo -e "${BLUE}○${NC} Skipped: $skipped_count files (already using camelCase)"
echo ""
echo "Backup files created with .backup extension"
echo ""
echo "Next steps:"
echo "  1. Verify: minibob doctor check repos/metabob-proto/activities"
echo "  2. Register: minibob doctor tutor repos/metabob-proto/activities"
echo ""
