#!/bin/bash

# Script to add A/B testing fields to test template objects

FILES=(
  "repos/metabob-opencode/packages/opencode/test/session/discovery-phase-schema.test.ts"
  "repos/metabob-opencode/packages/opencode/test/session/recommendation-engine-discovery.test.ts"
  "repos/metabob-opencode/packages/opencode/test/session/template-cache.test.ts"
  "repos/metabob-opencode/packages/opencode/test/session/template-executor.test.ts"
  "repos/metabob-opencode/packages/opencode/test/session/template-loader.test.ts"
  "repos/metabob-opencode/packages/opencode/test/session/trailblazing.test.ts"
  "repos/metabob-opencode/packages/opencode/test/tool/activity-registration-flow.test.ts"
  "repos/metabob-opencode/packages/opencode/test/tool/activity.test.ts"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "Processing $file..."
    # Use sed to add A/B fields after category field in template objects
    sed -i '/category:.*,$/a\    status: "stable" as const,\n    stableVariantId: undefined,\n    candidateIds: [],\n    allocationWeight: 1.0,' "$file"
  else
    echo "File not found: $file"
  fi
done

echo "Done!"
