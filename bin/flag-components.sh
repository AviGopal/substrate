#!/bin/bash

# Component Flagging Script
# Automatically flags problem components using Metabob annotations

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Parse arguments
COMPONENT_FILE="$1"
FLAG_TYPE="$2"
MESSAGE="$3"
SEVERITY="${4:-HIGH}"

# Validate arguments
if [ -z "$COMPONENT_FILE" ] || [ -z "$FLAG_TYPE" ] || [ -z "$MESSAGE" ]; then
    echo -e "${RED}❌ Usage: flag-components.sh <component_file> <flag_type> <message> [severity]${NC}"
    echo ""
    echo "FLAG_TYPES:"
    echo "  EXPERIMENTAL    - New, unproven code"
    echo "  RISKY          - High-risk implementation"
    echo "  DEAD_CODE      - Unused or unreachable code"
    echo "  NO_TESTS       - Missing test coverage"
    echo "  MEMORY_LEAK    - Potential memory issues"
    echo "  SECURITY_RISK  - Security vulnerability"
    echo "  PERFORMANCE    - Performance bottleneck"
    echo "  DEPRECATED     - Should be removed"
    echo ""
    echo "SEVERITY: LOW, MEDIUM, HIGH, CRITICAL"
    echo ""
    echo "Examples:"
    echo "  flag-components.sh src/auth.js NO_TESTS 'Authentication module lacks unit tests'"
    echo "  flag-components.sh lib/cache.ts EXPERIMENTAL 'New caching system, performance not validated'"
    exit 1
fi

# Validate file exists
if [ ! -f "$COMPONENT_FILE" ]; then
    echo -e "${RED}❌ File not found: $COMPONENT_FILE${NC}"
    exit 1
fi

# Validate flag type
case "$FLAG_TYPE" in
    EXPERIMENTAL|RISKY|DEAD_CODE|NO_TESTS|MEMORY_LEAK|SECURITY_RISK|PERFORMANCE|DEPRECATED)
        ;;
    *)
        echo -e "${RED}❌ Invalid flag type: $FLAG_TYPE${NC}"
        echo "Valid types: EXPERIMENTAL, RISKY, DEAD_CODE, NO_TESTS, MEMORY_LEAK, SECURITY_RISK, PERFORMANCE, DEPRECATED"
        exit 1
        ;;
esac

# Validate severity
case "$SEVERITY" in
    LOW|MEDIUM|HIGH|CRITICAL)
        ;;
    *)
        echo -e "${RED}❌ Invalid severity: $SEVERITY${NC}"
        echo "Valid severities: LOW, MEDIUM, HIGH, CRITICAL"
        exit 1
        ;;
esac

echo -e "${BLUE}🏷️  Flagging component: $COMPONENT_FILE${NC}"
echo -e "${YELLOW}   Flag Type: $FLAG_TYPE${NC}"
echo -e "${YELLOW}   Severity: $SEVERITY${NC}"
echo -e "${YELLOW}   Message: $MESSAGE${NC}"

# Get component name from file path
COMPONENT_NAME=$(basename "$COMPONENT_FILE" | sed 's/\.[^.]*$//')

# Use Metabob CLI to add annotation
echo -e "${BLUE}📝 Adding Metabob annotation...${NC}"

if command -v metabob-cli &> /dev/null; then
    # Try to annotate with metabob-cli
    if metabob-cli annotate-component \
        --file="$COMPONENT_FILE" \
        --component-name="$COMPONENT_NAME" \
        --component-type="module" \
        --reason="$MESSAGE [FLAG: $FLAG_TYPE]" 2>/dev/null; then
        echo -e "${GREEN}✅ Metabob annotation added successfully${NC}"
    else
        echo -e "${YELLOW}⚠️  Metabob annotation failed, adding manual annotation${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  metabob-cli not found, adding manual annotation only${NC}"
fi

# Add flag comment to the file for immediate visibility
echo -e "${BLUE}💬 Adding flag comment to file...${NC}"

# Determine comment syntax based on file extension
FILE_EXT="${COMPONENT_FILE##*.}"
case "$FILE_EXT" in
    js|ts|tsx|jsx)
        COMMENT_START="//"
        ;;
    py)
        COMMENT_START="#"
        ;;
    sh|bash)
        COMMENT_START="#"
        ;;
    css|scss)
        COMMENT_START="/*"
        COMMENT_END=" */"
        ;;
    html|xml)
        COMMENT_START="<!--"
        COMMENT_END=" -->"
        ;;
    *)
        COMMENT_START="//"
        ;;
esac

# Create flag comment
TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
if [ -n "$COMMENT_END" ]; then
    FLAG_COMMENT="${COMMENT_START} [FLAG: $FLAG_TYPE] $MESSAGE (Flagged: $TIMESTAMP)${COMMENT_END}"
else
    FLAG_COMMENT="${COMMENT_START} [FLAG: $FLAG_TYPE] $MESSAGE (Flagged: $TIMESTAMP)"
fi

# Check if flag already exists
if grep -q "\[FLAG: $FLAG_TYPE\]" "$COMPONENT_FILE"; then
    echo -e "${YELLOW}⚠️  Flag $FLAG_TYPE already exists in $COMPONENT_FILE${NC}"
else
    # Add flag comment at the top of the file
    temp_file=$(mktemp)
    echo "$FLAG_COMMENT" > "$temp_file"
    cat "$COMPONENT_FILE" >> "$temp_file"
    mv "$temp_file" "$COMPONENT_FILE"
    echo -e "${GREEN}✅ Flag comment added to file${NC}"
fi

# Log the flagging action
FLAG_LOG="$PROJECT_ROOT/.metabob/component-flags.log"
mkdir -p "$(dirname "$FLAG_LOG")"
echo "$(date -u +"%Y-%m-%d %H:%M:%S UTC") | $FLAG_TYPE | $SEVERITY | $COMPONENT_FILE | $MESSAGE" >> "$FLAG_LOG"

# Create/update flag metadata file
FLAG_METADATA="$PROJECT_ROOT/.metabob/component-flags.json"
if [ ! -f "$FLAG_METADATA" ]; then
    echo "[]" > "$FLAG_METADATA"
fi

# Add flag to metadata (using Node.js for JSON manipulation)
node -e "
const fs = require('fs');
const flags = JSON.parse(fs.readFileSync('$FLAG_METADATA', 'utf8'));
const newFlag = {
  file: '$COMPONENT_FILE',
  type: '$FLAG_TYPE',
  severity: '$SEVERITY', 
  message: '$MESSAGE',
  flagged_at: new Date().toISOString(),
  resolved: false
};

// Remove any existing flags for the same file and type
const filtered = flags.filter(f => !(f.file === newFlag.file && f.type === newFlag.type));
filtered.push(newFlag);

fs.writeFileSync('$FLAG_METADATA', JSON.stringify(filtered, null, 2));
"

echo -e "${GREEN}✅ Component flagged successfully!${NC}"
echo ""
echo -e "${BLUE}📊 Flag Summary:${NC}"
echo -e "   File: $COMPONENT_FILE"
echo -e "   Type: $FLAG_TYPE"
echo -e "   Severity: $SEVERITY"
echo -e "   Message: $MESSAGE"
echo ""
echo -e "${BLUE}🔍 To view all flags: ${NC}./bin/list-flags.sh"
echo -e "${BLUE}🔧 To resolve this flag: ${NC}./bin/resolve-flag.sh $COMPONENT_FILE $FLAG_TYPE"