#!/bin/bash

# List Component Flags Script
# Shows all flagged components and their status

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FLAG_METADATA="$PROJECT_ROOT/.metabob/component-flags.json"
FLAG_LOG="$PROJECT_ROOT/.metabob/component-flags.log"

# Parse arguments
SHOW_RESOLVED="${1:-false}"
FORMAT="${2:-table}"

# Show help
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Component Flag Listing Tool"
    echo ""
    echo "USAGE:"
    echo "  list-flags.sh [show_resolved] [format]"
    echo ""
    echo "ARGUMENTS:"
    echo "  show_resolved   true|false (default: false) - Show resolved flags"
    echo "  format          table|json|summary (default: table) - Output format"
    echo ""
    echo "EXAMPLES:"
    echo "  list-flags.sh                    # Show active flags in table format"
    echo "  list-flags.sh true               # Show all flags including resolved"
    echo "  list-flags.sh false json         # Show active flags in JSON format"
    echo "  list-flags.sh false summary      # Show flag summary statistics"
    echo ""
    echo "FLAG TYPES:"
    echo "  🧪 EXPERIMENTAL - New, unproven code"
    echo "  ⚠️  RISKY - High-risk implementation"
    echo "  💀 DEAD_CODE - Unused or unreachable code"
    echo "  🚫 NO_TESTS - Missing test coverage"
    echo "  🔍 MEMORY_LEAK - Potential memory issues"
    echo "  🛡️  SECURITY_RISK - Security vulnerability"
    echo "  🐌 PERFORMANCE - Performance bottleneck"
    echo "  📰 DEPRECATED - Should be removed"
    exit 0
fi

# Check if flag metadata exists
if [ ! -f "$FLAG_METADATA" ]; then
    echo -e "${YELLOW}⚠️  No component flags found${NC}"
    echo "Use ./bin/flag-components.sh to flag components"
    exit 0
fi

# Get flag icon
get_flag_icon() {
    case "$1" in
        EXPERIMENTAL) echo "🧪" ;;
        RISKY) echo "⚠️" ;;
        DEAD_CODE) echo "💀" ;;
        NO_TESTS) echo "🚫" ;;
        MEMORY_LEAK) echo "🔍" ;;
        SECURITY_RISK) echo "🛡️" ;;
        PERFORMANCE) echo "🐌" ;;
        DEPRECATED) echo "📰" ;;
        *) echo "🏷️" ;;
    esac
}

# Get severity color
get_severity_color() {
    case "$1" in
        CRITICAL) echo "$RED" ;;
        HIGH) echo "$YELLOW" ;;
        MEDIUM) echo "$BLUE" ;;
        LOW) echo "$GREEN" ;;
        *) echo "$NC" ;;
    esac
}

# Format relative time
format_relative_time() {
    local timestamp="$1"
    local now=$(date +%s)
    local flag_time=$(date -d "$timestamp" +%s 2>/dev/null || echo "$now")
    local diff=$((now - flag_time))
    
    if [ $diff -lt 3600 ]; then
        echo "$((diff / 60))m ago"
    elif [ $diff -lt 86400 ]; then
        echo "$((diff / 3600))h ago"
    else
        echo "$((diff / 86400))d ago"
    fi
}

# Read and parse flags
echo -e "${BLUE}📋 Component Flags Report${NC}"
echo -e "${BLUE}========================${NC}"

# Use Node.js to parse and filter JSON
FLAGS_OUTPUT=$(node -e "
const fs = require('fs');
const flags = JSON.parse(fs.readFileSync('$FLAG_METADATA', 'utf8'));
const showResolved = '$SHOW_RESOLVED' === 'true';
const format = '$FORMAT';

let filtered = showResolved ? flags : flags.filter(f => !f.resolved);

if (format === 'json') {
    console.log(JSON.stringify(filtered, null, 2));
} else if (format === 'summary') {
    const summary = {
        total: flags.length,
        active: flags.filter(f => !f.resolved).length,
        resolved: flags.filter(f => f.resolved).length,
        by_type: {},
        by_severity: {},
        by_file: {}
    };
    
    flags.forEach(f => {
        summary.by_type[f.type] = (summary.by_type[f.type] || 0) + 1;
        summary.by_severity[f.severity] = (summary.by_severity[f.severity] || 0) + 1;
        summary.by_file[f.file] = (summary.by_file[f.file] || 0) + 1;
    });
    
    console.log(JSON.stringify(summary, null, 2));
} else {
    // Table format
    filtered.forEach(f => {
        const status = f.resolved ? 'RESOLVED' : 'ACTIVE';
        console.log(\`\${f.file}|\${f.type}|\${f.severity}|\${status}|\${f.message}|\${f.flagged_at}|\${f.resolved_at || ''}\`);
    });
}
")

if [ "$FORMAT" = "json" ]; then
    echo "$FLAGS_OUTPUT"
    exit 0
elif [ "$FORMAT" = "summary" ]; then
    echo -e "${CYAN}📊 Flag Summary${NC}"
    echo "$FLAGS_OUTPUT" | jq -r '
        "Total Flags: " + (.total | tostring) + "\n" +
        "Active: " + (.active | tostring) + "\n" + 
        "Resolved: " + (.resolved | tostring) + "\n" +
        "\nBy Type:" + (
            .by_type | to_entries | map("  " + .key + ": " + (.value | tostring)) | join("\n")
        ) + "\n" +
        "\nBy Severity:" + (
            .by_severity | to_entries | map("  " + .key + ": " + (.value | tostring)) | join("\n") 
        )
    '
    exit 0
fi

# Table format
if [ -z "$FLAGS_OUTPUT" ]; then
    if [ "$SHOW_RESOLVED" = "true" ]; then
        echo -e "${GREEN}✅ No component flags found${NC}"
    else
        echo -e "${GREEN}✅ No active component flags${NC}"
    fi
    exit 0
fi

# Count flags
FLAG_COUNT=$(echo "$FLAGS_OUTPUT" | wc -l)
if [ "$SHOW_RESOLVED" = "true" ]; then
    echo -e "${CYAN}Found $FLAG_COUNT total flags${NC}"
else
    echo -e "${CYAN}Found $FLAG_COUNT active flags${NC}"
fi
echo ""

# Table header
printf "%-50s %-15s %-10s %-10s %-10s %s\n" "FILE" "TYPE" "SEVERITY" "STATUS" "AGE" "MESSAGE"
echo "$(printf '%.0s-' {1..120})"

# Process each flag
echo "$FLAGS_OUTPUT" | while IFS='|' read -r file type severity status message flagged_at resolved_at; do
    # Get colors and icons
    ICON=$(get_flag_icon "$type")
    SEVERITY_COLOR=$(get_severity_color "$severity")
    
    # Format status
    if [ "$status" = "RESOLVED" ]; then
        STATUS_DISPLAY="${GREEN}✅ RESOLVED${NC}"
        AGE=$(format_relative_time "$resolved_at")
    else
        STATUS_DISPLAY="${RED}🔴 ACTIVE${NC}"
        AGE=$(format_relative_time "$flagged_at")
    fi
    
    # Truncate long messages
    SHORT_MESSAGE="${message:0:50}"
    if [ ${#message} -gt 50 ]; then
        SHORT_MESSAGE="${SHORT_MESSAGE}..."
    fi
    
    # Print row
    printf "%-50s ${ICON} %-13s ${SEVERITY_COLOR}%-10s${NC} %-20s %-10s %s\n" \
        "${file:0:47}..." \
        "$type" \
        "$severity" \
        "$STATUS_DISPLAY" \
        "$AGE" \
        "$SHORT_MESSAGE"
done

echo ""

# Show statistics
ACTIVE_COUNT=$(echo "$FLAGS_OUTPUT" | grep -c "ACTIVE" || echo "0")
RESOLVED_COUNT=$(echo "$FLAGS_OUTPUT" | grep -c "RESOLVED" || echo "0")

if [ "$ACTIVE_COUNT" -gt 0 ]; then
    echo -e "${RED}⚠️  $ACTIVE_COUNT active flags need attention${NC}"
    
    # Show most severe active flags
    CRITICAL_COUNT=$(echo "$FLAGS_OUTPUT" | grep "ACTIVE" | grep -c "CRITICAL" || echo "0")
    HIGH_COUNT=$(echo "$FLAGS_OUTPUT" | grep "ACTIVE" | grep -c "HIGH" || echo "0")
    
    if [ "$CRITICAL_COUNT" -gt 0 ]; then
        echo -e "${RED}🚨 $CRITICAL_COUNT CRITICAL severity flags - immediate action required${NC}"
    fi
    
    if [ "$HIGH_COUNT" -gt 0 ]; then
        echo -e "${YELLOW}⚠️  $HIGH_COUNT HIGH severity flags - should be addressed soon${NC}"
    fi
    
    # Check if too many flags (for commit blocking)
    if [ "$ACTIVE_COUNT" -gt 5 ]; then
        echo -e "${RED}❌ Too many active flags ($ACTIVE_COUNT > 5) - commits may be blocked${NC}"
    fi
else
    echo -e "${GREEN}✅ No active flags - all components are properly managed${NC}"
fi

if [ "$RESOLVED_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ $RESOLVED_COUNT flags have been resolved${NC}"
fi

echo ""
echo -e "${BLUE}💡 Actions:${NC}"
echo -e "   Flag component: ${YELLOW}./bin/flag-components.sh <file> <type> <message>${NC}"
echo -e "   Resolve flag:   ${YELLOW}./bin/resolve-flag.sh <file> <type>${NC}"
echo -e "   Auto-scan:      ${YELLOW}./bin/auto-flag-scan.sh${NC}"
echo -e "   Check commits:  ${YELLOW}./bin/check-flag-limits.sh${NC}"

# Show recent activity from log
if [ -f "$FLAG_LOG" ] && [ -s "$FLAG_LOG" ]; then
    echo ""
    echo -e "${BLUE}📝 Recent Flag Activity (last 5):${NC}"
    tail -n 5 "$FLAG_LOG" | while IFS='|' read -r timestamp type severity file message; do
        ICON=$(get_flag_icon "$type")
        AGE=$(format_relative_time "${timestamp% *}")
        echo -e "   ${ICON} $type ($severity) - $(basename "$file") - $AGE"
    done
fi