#!/bin/bash
# Test the updated analysis script with a sample activity

STORAGE_DIR="$HOME/.local/share/opencode/storage/activity"
ARCHIVE_DIR="$HOME/.local/share/opencode/storage/activity-archive/test-data"

echo "Restoring sample activity for testing..."
cp "$ARCHIVE_DIR/act_mls07dgv_5daebc40e2cb4abb.json" "$STORAGE_DIR/"

echo ""
echo "Running analysis..."
python3 analyze_template_performance.py

echo ""
echo "Cleaning up test data..."
rm "$STORAGE_DIR/act_mls07dgv_5daebc40e2cb4abb.json"
echo "Done!"
