#!/bin/bash

# Resolve Component Flag Script
# Marks a component flag as resolved

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
FLAG_METADATA="$PROJECT_ROOT/.metabob/component-flags.json"
FLAG_LOG="$PROJECT_ROOT/.metabob/component-flags.log"

# Parse arguments
COMPONENT_FILE="$1"
FLAG_TYPE="$2"
RESOLUTION_MESSAGE="$3"

# Show help
if [ "$1" = "--help" ] || [ "$1" = "-h" ] || [ -z "$COMPONENT_FILE" ] || [ -z "$FLAG_TYPE" ]; then
    echo "Component Flag Resolution Tool"
    echo ""
    echo "USAGE:"
    echo "  resolve-flag.sh <component_file> <flag_type> [resolution_message]"
    echo ""
    echo "ARGUMENTS:"
    echo "  component_file      File that was flagged"
    echo "  flag_type          Type of flag to resolve"
    echo "  resolution_message Optional message describing how it was resolved"
    echo ""
    echo "EXAMPLES:"
    echo "  resolve-flag.sh src/auth.js NO_TESTS 'Added comprehensive unit tests'"
    echo "  resolve-flag.sh lib/cache.ts EXPERIMENTAL 'Performance validated in production'"
    echo "  resolve-flag.sh utils/helper.js DEAD_CODE 'Removed unused functions'"
    echo ""
    echo "FLAG TYPES:"
    echo "  EXPERIMENTAL, RISKY, DEAD_CODE, NO_TESTS, MEMORY_LEAK,"
    echo "  SECURITY_RISK, PERFORMANCE, DEPRECATED"
    exit 1
fi

# Check if flag metadata exists
if [ ! -f "$FLAG_METADATA" ]; then
    echo -e "${RED}❌ No component flags found${NC}"
    echo "Use ./bin/flag-components.sh to flag components first"
    exit 1
fi

# Validate file exists
if [ ! -f "$COMPONENT_FILE" ]; then
    echo -e "${YELLOW}⚠️  File not found: $COMPONENT_FILE${NC}"
    echo "Resolving flag anyway (file may have been moved/deleted)"
fi

echo -e "${BLUE}🔧 Resolving flag for: $COMPONENT_FILE${NC}"
echo -e "${YELLOW}   Flag Type: $FLAG_TYPE${NC}"

# Check if flag exists
FLAG_EXISTS=$(node -e "
const fs = require('fs');
const flags = JSON.parse(fs.readFileSync('$FLAG_METADATA', 'utf8'));
const flag = flags.find(f => f.file === '$COMPONENT_FILE' && f.type === '$FLAG_TYPE' && !f.resolved);
console.log(flag ? 'true' : 'false');
")

if [ "$FLAG_EXISTS" = "false" ]; then
    echo -e "${RED}❌ No active flag of type $FLAG_TYPE found for $COMPONENT_FILE${NC}"
    echo ""
    echo "Active flags for this file:"
    node -e "
    const fs = require('fs');
    const flags = JSON.parse(fs.readFileSync('$FLAG_METADATA', 'utf8'));
    const fileFlags = flags.filter(f => f.file === '$COMPONENT_FILE' && !f.resolved);
    if (fileFlags.length === 0) {
        console.log('  None');
    } else {
        fileFlags.forEach(f => console.log(\`  - \${f.type} (\${f.severity}): \${f.message}\`));
    }
    "
    exit 1
fi

# Set default resolution message
if [ -z "$RESOLUTION_MESSAGE" ]; then
    case "$FLAG_TYPE" in
        NO_TESTS)
            RESOLUTION_MESSAGE="Tests added and coverage verified"
            ;;
        EXPERIMENTAL)
            RESOLUTION_MESSAGE="Code validated and moved to stable"
            ;;
        DEAD_CODE)
            RESOLUTION_MESSAGE="Dead code removed or usage verified"
            ;;
        RISKY)
            RESOLUTION_MESSAGE="Risk mitigation implemented and tested"
            ;;
        MEMORY_LEAK)
            RESOLUTION_MESSAGE="Memory leak fixed and validated"
            ;;
        SECURITY_RISK)
            RESOLUTION_MESSAGE="Security issue resolved and verified"
            ;;
        PERFORMANCE)
            RESOLUTION_MESSAGE="Performance optimized and benchmarked"
            ;;
        DEPRECATED)
            RESOLUTION_MESSAGE="Code removed or replacement implemented"
            ;;
        *)
            RESOLUTION_MESSAGE="Issue resolved"
            ;;
    esac
fi

echo -e "${YELLOW}   Resolution: $RESOLUTION_MESSAGE${NC}"

# Update flag metadata
echo -e "${BLUE}📝 Updating flag metadata...${NC}"

node -e "
const fs = require('fs');
const flags = JSON.parse(fs.readFileSync('$FLAG_METADATA', 'utf8'));

const flagIndex = flags.findIndex(f => f.file === '$COMPONENT_FILE' && f.type === '$FLAG_TYPE' && !f.resolved);

if (flagIndex !== -1) {
    flags[flagIndex].resolved = true;
    flags[flagIndex].resolved_at = new Date().toISOString();
    flags[flagIndex].resolution_message = '$RESOLUTION_MESSAGE';
    
    fs.writeFileSync('$FLAG_METADATA', JSON.stringify(flags, null, 2));
    console.log('Flag metadata updated successfully');
} else {
    console.error('Flag not found for update');
    process.exit(1);
}
"

# Remove flag comment from file if it exists
if [ -f "$COMPONENT_FILE" ]; then
    echo -e "${BLUE}🧹 Removing flag comment from file...${NC}"
    
    # Create temporary file without flag comments
    TEMP_FILE=$(mktemp)
    grep -v "\[FLAG: $FLAG_TYPE\]" "$COMPONENT_FILE" > "$TEMP_FILE" || true
    
    # Check if any changes were made
    if ! diff -q "$COMPONENT_FILE" "$TEMP_FILE" > /dev/null 2>&1; then
        mv "$TEMP_FILE" "$COMPONENT_FILE"
        echo -e "${GREEN}✅ Flag comment removed from file${NC}"
    else
        rm "$TEMP_FILE"
        echo -e "${YELLOW}⚠️  No flag comment found in file${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  File not found, skipping comment removal${NC}"
fi

# Log the resolution
echo "$(date -u +"%Y-%m-%d %H:%M:%S UTC") | RESOLVED | $FLAG_TYPE | $COMPONENT_FILE | $RESOLUTION_MESSAGE" >> "$FLAG_LOG"

echo -e "${GREEN}✅ Flag resolved successfully!${NC}"
echo ""
echo -e "${BLUE}📊 Resolution Summary:${NC}"
echo -e "   File: $COMPONENT_FILE"
echo -e "   Flag Type: $FLAG_TYPE"
echo -e "   Resolution: $RESOLUTION_MESSAGE"
echo -e "   Resolved At: $(date)"

# Show remaining flags for this file
echo ""
echo -e "${BLUE}📋 Remaining flags for this file:${NC}"

REMAINING_FLAGS=$(node -e "
const fs = require('fs');
const flags = JSON.parse(fs.readFileSync('$FLAG_METADATA', 'utf8'));
const remainingFlags = flags.filter(f => f.file === '$COMPONENT_FILE' && !f.resolved);
if (remainingFlags.length === 0) {
    console.log('None - file is fully resolved! 🎉');
} else {
    remainingFlags.forEach(f => console.log(\`  - \${f.type} (\${f.severity}): \${f.message}\`));
}
")

echo "$REMAINING_FLAGS"

# Show overall flag statistics
echo ""
echo -e "${BLUE}🏆 Overall Flag Statistics:${NC}"

node -e "
const fs = require('fs');
const flags = JSON.parse(fs.readFileSync('$FLAG_METADATA', 'utf8'));
const active = flags.filter(f => !f.resolved).length;
const resolved = flags.filter(f => f.resolved).length;
const total = flags.length;

console.log(\`   Total Flags: \${total}\`);
console.log(\`   Active: \${active}\`);
console.log(\`   Resolved: \${resolved}\`);

if (active === 0 && total > 0) {
    console.log('\\n🎉 All flags resolved! Excellent work!');
} else if (active <= 3) {
    console.log(\`\\n✅ Low flag count (\${active}) - good code quality\`);
} else if (active <= 5) {
    console.log(\`\\n⚠️  Moderate flag count (\${active}) - consider addressing\`);
} else {
    console.log(\`\\n❌ High flag count (\${active}) - needs attention\`);
}
"

echo ""
echo -e "${BLUE}💡 Next Steps:${NC}"
echo -e "   View all flags: ${YELLOW}./bin/list-flags.sh${NC}"
echo -e "   Auto-scan:      ${YELLOW}./bin/auto-flag-scan.sh${NC}"

if [ "$REMAINING_FLAGS" != "None - file is fully resolved! 🎉" ]; then
    echo -e "   Resolve others: ${YELLOW}./bin/resolve-flag.sh $COMPONENT_FILE <flag_type>${NC}"
fi