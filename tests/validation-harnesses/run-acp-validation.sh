#!/bin/bash
# Wrapper to run validation harness with direct TypeScript imports

cd /home/avi/documents/work/exp-repo/metabob-devbob

echo "🧪 Running ACP Network Transport Validation Harness"
echo "===================================================="

# Run the validation harness
bun run tests/validation-harnesses/acp-network-transport-implementation-harness.ts

exit $?
