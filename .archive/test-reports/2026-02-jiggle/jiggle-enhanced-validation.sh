#!/bin/bash

# Enhanced Documentation Jiggle with Validation Against Code Reality
# This script performs comprehensive documentation analysis with git validation

set -euo pipefail

REPO_ROOT="/home/avi/documents/work/exp-repo/metabob-devbob"
OUTPUT_DIR="$REPO_ROOT"
ANALYSIS_FILE="$OUTPUT_DIR/doc-jiggle-analysis-enhanced.md"
VALIDATION_FILE="$OUTPUT_DIR/doc-validation-reality-check.md"
PERCOLATION_PLAN="$OUTPUT_DIR/doc-percolation-plan-enhanced.md"

echo "=== Enhanced Documentation Jiggle Analysis ==="
echo "Starting at: $(date)"
echo ""

cd "$REPO_ROOT"

# Step 1: Gather all markdown files with metadata
echo "Step 1: Gathering markdown files..."
find . -name "*.md" -type f \
  ! -path "*/node_modules/*" \
  ! -path "*/.git/*" \
  ! -path "*/dist/*" \
  ! -path "*/build/*" \
  -printf "%T@ %p\n" | sort -rn > /tmp/md_files_sorted.txt

TOTAL_FILES=$(wc -l < /tmp/md_files_sorted.txt)
echo "Found $TOTAL_FILES markdown files"

# Step 2: Categorize by age
NOW=$(date +%s)
THIRTY_DAYS=$((30 * 86400))
NINETY_DAYS=$((90 * 86400))
ONEEIGHTY_DAYS=$((180 * 86400))

echo "Step 2: Categorizing by age..."

> "$ANALYSIS_FILE"
cat >> "$ANALYSIS_FILE" << 'EOF'
# Enhanced Documentation Jiggle Analysis Report

**Generated**: $(date)
**Total Files**: $TOTAL_FILES

## Executive Summary

This report categorizes all markdown documentation by modification date and identifies:
1. Recent documentation (< 30 days)
2. Medium-age documentation (30-90 days)
3. Stale documentation (90-180 days)
4. Obsolete candidates (> 180 days)
5. **VALIDATION**: Documentation claims vs code reality

---

EOF

# Function to extract first heading from file
get_first_heading() {
  local file="$1"
  head -20 "$file" 2>/dev/null | grep -m1 "^#" | sed 's/^#* *//' || echo "(no heading)"
}

# Function to check git history for a file
get_git_context() {
  local file="$1"
  # Get last commit message for this file
  git log -1 --oneline -- "$file" 2>/dev/null || echo "no git history"
}

# Categorize files
declare -a RECENT_FILES=()
declare -a MEDIUM_FILES=()
declare -a STALE_FILES=()
declare -a OBSOLETE_FILES=()

while IFS= read -r line; do
  TIMESTAMP=$(echo "$line" | awk '{print int($1)}')
  FILE=$(echo "$line" | awk '{print $2}')
  AGE=$((NOW - TIMESTAMP))
  
  if [ $AGE -lt $THIRTY_DAYS ]; then
    RECENT_FILES+=("$FILE")
  elif [ $AGE -lt $NINETY_DAYS ]; then
    MEDIUM_FILES+=("$FILE")
  elif [ $AGE -lt $ONEEIGHTY_DAYS ]; then
    STALE_FILES+=("$FILE")
  else
    OBSOLETE_FILES+=("$FILE")
  fi
done < /tmp/md_files_sorted.txt

echo "Recent: ${#RECENT_FILES[@]}, Medium: ${#MEDIUM_FILES[@]}, Stale: ${#STALE_FILES[@]}, Obsolete: ${#OBSOLETE_FILES[@]}"

# Write categorized lists
cat >> "$ANALYSIS_FILE" << EOF

## Recent Files (< 30 days): ${#RECENT_FILES[@]}

EOF

for file in "${RECENT_FILES[@]}"; do
  heading=$(get_first_heading "$file")
  git_ctx=$(get_git_context "$file")
  echo "- \`$file\` - $heading" >> "$ANALYSIS_FILE"
  echo "  - Git: $git_ctx" >> "$ANALYSIS_FILE"
done

cat >> "$ANALYSIS_FILE" << EOF

## Medium Age Files (30-90 days): ${#MEDIUM_FILES[@]}

EOF

for file in "${MEDIUM_FILES[@]:0:20}"; do  # Limit to 20 for brevity
  heading=$(get_first_heading "$file")
  echo "- \`$file\` - $heading" >> "$ANALYSIS_FILE"
done
echo "" >> "$ANALYSIS_FILE"
echo "*(Showing first 20, ${#MEDIUM_FILES[@]} total)*" >> "$ANALYSIS_FILE"

cat >> "$ANALYSIS_FILE" << EOF

## Stale Files (90-180 days): ${#STALE_FILES[@]}

EOF

for file in "${STALE_FILES[@]:0:15}"; do  # Limit to 15
  heading=$(get_first_heading "$file")
  echo "- \`$file\` - $heading" >> "$ANALYSIS_FILE"
done
echo "" >> "$ANALYSIS_FILE"
echo "*(Showing first 15, ${#STALE_FILES[@]} total)*" >> "$ANALYSIS_FILE"

cat >> "$ANALYSIS_FILE" << EOF

## Obsolete Candidates (> 180 days): ${#OBSOLETE_FILES[@]}

EOF

for file in "${OBSOLETE_FILES[@]:0:30}"; do  # Show more obsolete for cleanup
  heading=$(get_first_heading "$file")
  echo "- \`$file\` - $heading" >> "$ANALYSIS_FILE"
done
echo "" >> "$ANALYSIS_FILE"
echo "*(Showing first 30, ${#OBSOLETE_FILES[@]} total)*" >> "$ANALYSIS_FILE"

# Step 3: Identify trash files (session logs, temp files, status snapshots)
echo "Step 3: Identifying trash files..."

cat >> "$ANALYSIS_FILE" << 'EOF'

---

## Trash Files to Clean Up

**Criteria**: Session logs, temporary task files, status snapshots, redundant summaries

EOF

# Find trash patterns
find . -name "*.md" -type f \
  ! -path "*/node_modules/*" \
  ! -path "*/.git/*" \
  -path "*session-logs*" -o \
  -path "*task-completion*" -o \
  -name "*-status-*.md" -o \
  -name "*-snapshot-*.md" -o \
  -name "temp-*.md" -o \
  -name "*-temp.md" \
  > /tmp/trash_candidates.txt

TRASH_COUNT=$(wc -l < /tmp/trash_candidates.txt || echo 0)

cat >> "$ANALYSIS_FILE" << EOF
**Found $TRASH_COUNT trash candidates:**

EOF

if [ $TRASH_COUNT -gt 0 ]; then
  while IFS= read -r file; do
    echo "- \`$file\`" >> "$ANALYSIS_FILE"
  done < /tmp/trash_candidates.txt
fi

echo ""
echo "Analysis report written to: $ANALYSIS_FILE"
echo ""

# Step 4: ENHANCED VALIDATION - Check documentation claims vs code reality
echo "Step 4: Validating documentation against code reality..."

> "$VALIDATION_FILE"
cat >> "$VALIDATION_FILE" << 'EOF'
# Documentation Reality Check - Intent vs Implementation

**Purpose**: Validate that documentation claims match actual implemented features

**Generated**: $(date)

## Methodology

For each recent documentation file:
1. Extract claims about features/changes
2. Check git commit messages for evidence
3. Search codebase for implementation evidence
4. Flag mismatches between "what we said we did" and "what we actually did"

---

EOF

# Check specific high-risk patterns
echo "## Validation Findings" >> "$VALIDATION_FILE"
echo "" >> "$VALIDATION_FILE"

# Look for "completed", "implemented", "fixed" claims in recent docs
for file in "${RECENT_FILES[@]:0:10}"; do
  if grep -qi "complete\|implement\|fixed\|added.*feature" "$file" 2>/dev/null; then
    echo "### $file" >> "$VALIDATION_FILE"
    echo "" >> "$VALIDATION_FILE"
    
    # Get the claims
    grep -i "complete\|implement\|fixed\|added.*feature" "$file" | head -5 >> "$VALIDATION_FILE" 2>/dev/null || true
    echo "" >> "$VALIDATION_FILE"
    
    # Get git context
    echo "**Git Evidence**:" >> "$VALIDATION_FILE"
    git log --oneline -5 -- "$file" >> "$VALIDATION_FILE" 2>/dev/null || echo "No git history" >> "$VALIDATION_FILE"
    echo "" >> "$VALIDATION_FILE"
    echo "---" >> "$VALIDATION_FILE"
    echo "" >> "$VALIDATION_FILE"
  fi
done

echo ""
echo "Validation report written to: $VALIDATION_FILE"
echo ""

# Step 5: Create percolation plan
echo "Step 5: Creating percolation plan..."

> "$PERCOLATION_PLAN"
cat >> "$PERCOLATION_PLAN" << 'EOF'
# Documentation Percolation Plan (Enhanced)

**Purpose**: Move valuable recent details backward into foundational documents

## Strategy

1. **Identify Foundational Docs**:
   - README.md files
   - *_QUICK_START.md
   - *_REFERENCE.md
   - DOCUMENTATION_INDEX.md

2. **Extract Recent Insights**:
   - From recent docs (< 30 days)
   - Exclude: Metabob MCP config (internal only)
   - Include: Architecture decisions, setup steps, lessons learned

3. **Consolidate Fragmented Docs**:
   - Merge similar session logs into coherent guides
   - Combine scattered analysis into unified architecture docs

---

EOF

# Identify foundational docs
echo "## Foundational Documents" >> "$PERCOLATION_PLAN"
echo "" >> "$PERCOLATION_PLAN"

find . -name "README*.md" -o -name "*QUICK_START*.md" -o -name "*REFERENCE*.md" -o -name "DOCUMENTATION_INDEX.md" | \
  grep -v node_modules | grep -v .git | sort >> "$PERCOLATION_PLAN"

echo "" >> "$PERCOLATION_PLAN"
echo "## Recent Documents with Valuable Content" >> "$PERCOLATION_PLAN"
echo "" >> "$PERCOLATION_PLAN"

for file in "${RECENT_FILES[@]:0:20}"; do
  # Skip Metabob config docs
  if ! grep -q "metabob.*mcp.*config" "$file" 2>/dev/null; then
    heading=$(get_first_heading "$file")
    echo "- \`$file\` - $heading" >> "$PERCOLATION_PLAN"
  fi
done

echo "" >> "$PERCOLATION_PLAN"
echo "## Percolation Actions (To Be Applied)" >> "$PERCOLATION_PLAN"
echo "" >> "$PERCOLATION_PLAN"
echo "1. **Consolidate session logs** → Create unified troubleshooting guide" >> "$PERCOLATION_PLAN"
echo "2. **Merge architecture fragments** → Update CORRECT_ARCHITECTURE_DESIGN.md" >> "$PERCOLATION_PLAN"
echo "3. **Promote quick start insights** → Update main README" >> "$PERCOLATION_PLAN"
echo "4. **Archive obsolete phase docs** → Move to .archive with proper index" >> "$PERCOLATION_PLAN"
echo "" >> "$PERCOLATION_PLAN"

echo ""
echo "Percolation plan written to: $PERCOLATION_PLAN"
echo ""

echo "=== Analysis Complete ==="
echo ""
echo "Generated reports:"
echo "  1. $ANALYSIS_FILE"
echo "  2. $VALIDATION_FILE"
echo "  3. $PERCOLATION_PLAN"
echo ""
echo "Next steps:"
echo "  - Review the validation report for documentation-reality mismatches"
echo "  - Apply the percolation plan manually or with follow-up script"
echo "  - Clean up identified trash files"
