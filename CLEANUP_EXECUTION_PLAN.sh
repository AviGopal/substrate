#!/bin/bash

# Cleanup Execution Plan - Phase 1: Safe Removals
# Generated: Mon Feb 16 2026
# Based on comprehensive safety analysis

echo "=== CLEANUP EXECUTION PLAN ==="
echo "Phase 1: Removing 15 SAFE files"
echo ""

# Create backup before removal
BACKUP_DIR=".cleanup-backup-$(date +%Y%m%d-%H%M%S)"
echo "Creating backup in $BACKUP_DIR..."
mkdir -p "$BACKUP_DIR"

# Documentation files (4 files)
echo ""
echo "--- Removing Documentation Files ---"
for file in \
    ACP_DELEGATE_TIMEOUT_FIX.md \
    ACTIVITY_EXECUTION_DIAGNOSIS.md \
    ACTIVITY_EXECUTION_MYSTERY.md
do
    if [ -f "$file" ]; then
        cp "$file" "$BACKUP_DIR/"
        echo "Backing up and removing: $file"
        # rm "$file"  # Uncomment to execute
    else
        echo "Skip (not found): $file"
    fi
done

# JSON Template files (4 files)
echo ""
echo "--- Removing JSON Template Files ---"
for file in \
    test-template-v2.json \
    test-template-with-validation.json \
    test-template-final.json \
    add-rest-endpoint-fixed.json
do
    if [ -f "$file" ]; then
        cp "$file" "$BACKUP_DIR/"
        echo "Backing up and removing: $file"
        # rm "$file"  # Uncomment to execute
    else
        echo "Skip (not found): $file"
    fi
done

# Test/Script files (4 files)
echo ""
echo "--- Removing Test/Script Files ---"
for file in \
    test_activity_direct.py \
    test_session_creation_directly.py \
    test-jiggle-simple.sh \
    devbob-demo.sh
do
    if [ -f "$file" ]; then
        cp "$file" "$BACKUP_DIR/"
        echo "Backing up and removing: $file"
        # rm "$file"  # Uncomment to execute
    else
        echo "Skip (not found): $file"
    fi
done

# Config files (2 files)
echo ""
echo "--- Removing Config Files ---"
for file in \
    .api_key_insert_v2.surql \
    .api_key_raw_v2.txt
do
    if [ -f "$file" ]; then
        cp "$file" "$BACKUP_DIR/"
        echo "Backing up and removing: $file"
        # rm "$file"  # Uncomment to execute
    else
        echo "Skip (not found): $file"
    fi
done

echo ""
echo "=== PHASE 1 COMPLETE ==="
echo "Backup location: $BACKUP_DIR"
echo ""
echo "To execute removals, uncomment the 'rm' lines in this script"
echo "Files backed up for safety"
echo ""
echo "Next: Review CLEANUP_SAFETY_ANALYSIS.md for Phase 2 (REVIEW REQUIRED files)"

