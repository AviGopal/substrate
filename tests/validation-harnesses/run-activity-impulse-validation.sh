#!/bin/bash
# Quick runner script for the validation harness

cd "$(dirname "$0")"

echo "Running activity-impulse-learning-loop-execution-validation harness..."
echo "This will execute real activities via devbob and monitor the learning loop."
echo ""

# Run with tsx (simpler than ts-node)
if command -v tsx &> /dev/null; then
    tsx activity-impulse-learning-loop-execution-validation-harness.ts
elif command -v ts-node &> /dev/null; then
    ts-node -O '{"module":"commonjs"}' activity-impulse-learning-loop-execution-validation-harness.ts
else
    echo "Error: tsx or ts-node not found. Please install: npm install -g tsx"
    exit 1
fi
