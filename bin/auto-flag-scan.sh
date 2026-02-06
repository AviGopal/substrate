#!/bin/bash

# Auto Flag Scan Script
# Automatically scans codebase and flags problematic components

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Parse arguments
DRY_RUN="${1:-false}"
VERBOSE="${2:-false}"

# Show help
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Auto Flag Scan Tool"
    echo ""
    echo "USAGE:"
    echo "  auto-flag-scan.sh [dry_run] [verbose]"
    echo ""
    echo "ARGUMENTS:"
    echo "  dry_run    true|false (default: false) - Show what would be flagged without flagging"
    echo "  verbose    true|false (default: false) - Show detailed scanning output"
    echo ""
    echo "EXAMPLES:"
    echo "  auto-flag-scan.sh                    # Scan and flag automatically"
    echo "  auto-flag-scan.sh true               # Dry run - show what would be flagged"
    echo "  auto-flag-scan.sh false true         # Scan with verbose output"
    echo ""
    echo "DETECTION RULES:"
    echo "  NO_TESTS       - Files without corresponding test files"
    echo "  DEAD_CODE      - Files with unused exports or functions"
    echo "  EXPERIMENTAL   - Files with TODO/FIXME/HACK comments"
    echo "  MEMORY_LEAK    - Files with potential memory issues"
    echo "  SECURITY_RISK  - Files with security vulnerabilities"
    echo "  PERFORMANCE    - Files with performance issues"
    echo ""
    exit 0
fi

echo -e "${BLUE}🔍 Auto Flag Scan${NC}"
echo -e "${BLUE}================${NC}"

if [ "$DRY_RUN" = "true" ]; then
    echo -e "${YELLOW}🧪 DRY RUN MODE - No flags will be created${NC}"
fi

echo ""

# Track what we find
FOUND_ISSUES=0
FLAGGED_COUNT=0

# Function to flag component if not already flagged
flag_if_needed() {
    local file="$1"
    local flag_type="$2"
    local message="$3"
    local severity="${4:-HIGH}"
    
    # Check if already flagged
    local already_flagged="false"
    if [ -f "$PROJECT_ROOT/.metabob/component-flags.json" ]; then
        already_flagged=$(node -e "
        try {
            const fs = require('fs');
            const flags = JSON.parse(fs.readFileSync('$PROJECT_ROOT/.metabob/component-flags.json', 'utf8'));
            const exists = flags.some(f => f.file === '$file' && f.type === '$flag_type' && !f.resolved);
            console.log(exists ? 'true' : 'false');
        } catch (e) {
            console.log('false');
        }
        ")
    fi
    
    if [ "$already_flagged" = "true" ]; then
        if [ "$VERBOSE" = "true" ]; then
            echo -e "${YELLOW}   ⚠️  Already flagged: $file ($flag_type)${NC}"
        fi
        return
    fi
    
    FOUND_ISSUES=$((FOUND_ISSUES + 1))
    
    if [ "$DRY_RUN" = "true" ]; then
        echo -e "${CYAN}   🏷️  Would flag: $file${NC}"
        echo -e "${CYAN}      Type: $flag_type${NC}"
        echo -e "${CYAN}      Severity: $severity${NC}"
        echo -e "${CYAN}      Message: $message${NC}"
    else
        echo -e "${YELLOW}   🏷️  Flagging: $file ($flag_type)${NC}"
        if "$SCRIPT_DIR/flag-components.sh" "$file" "$flag_type" "$message" "$severity" > /dev/null 2>&1; then
            FLAGGED_COUNT=$((FLAGGED_COUNT + 1))
            echo -e "${GREEN}      ✅ Flagged successfully${NC}"
        else
            echo -e "${RED}      ❌ Failed to flag${NC}"
        fi
    fi
}

# 1. Scan for files without tests
echo -e "${BLUE}🚫 Scanning for files without tests...${NC}"

find "$PROJECT_ROOT/src" -name "*.ts" -o -name "*.js" -o -name "*.tsx" -o -name "*.jsx" 2>/dev/null | while read -r file; do
    # Skip if in excluded directories
    if [[ "$file" =~ /(test|tests|__tests__|spec|__spec__)/ ]]; then
        continue
    fi
    
    # Get base name without extension
    base_name=$(basename "$file" | sed 's/\.[^.]*$//')
    dir_name=$(dirname "$file")
    
    # Look for test files in various patterns
    test_patterns=(
        "$dir_name/$base_name.test.ts"
        "$dir_name/$base_name.test.js"
        "$dir_name/$base_name.spec.ts"
        "$dir_name/$base_name.spec.js"
        "$dir_name/tests/$base_name.test.ts"
        "$dir_name/tests/$base_name.test.js"
        "$dir_name/__tests__/$base_name.test.ts"
        "$dir_name/__tests__/$base_name.test.js"
        "$PROJECT_ROOT/tests/$base_name.test.ts"
        "$PROJECT_ROOT/tests/$base_name.test.js"
    )
    
    has_tests=false
    for pattern in "${test_patterns[@]}"; do
        if [ -f "$pattern" ]; then
            has_tests=true
            break
        fi
    done
    
    if [ "$has_tests" = false ]; then
        # Check if file is substantial enough to need tests (more than just types/interfaces)
        if [ $(wc -l < "$file") -gt 10 ] && grep -q -E "(function|class|export)" "$file"; then
            flag_if_needed "$file" "NO_TESTS" "No test file found for this component" "HIGH"
        fi
    fi
done

# 2. Scan for experimental/unstable code
echo -e "${BLUE}🧪 Scanning for experimental code...${NC}"

find "$PROJECT_ROOT/src" -name "*.ts" -o -name "*.js" -o -name "*.tsx" -o -name "*.jsx" 2>/dev/null | while read -r file; do
    # Look for experimental markers
    if grep -q -i -E "(TODO|FIXME|HACK|XXX|EXPERIMENTAL|UNSTABLE)" "$file"; then
        marker_count=$(grep -c -i -E "(TODO|FIXME|HACK|XXX|EXPERIMENTAL|UNSTABLE)" "$file")
        
        if [ "$marker_count" -gt 3 ]; then
            flag_if_needed "$file" "EXPERIMENTAL" "Contains $marker_count experimental markers (TODO/FIXME/HACK)" "MEDIUM"
        fi
    fi
    
    # Look for console.log statements (potential debugging code)
    if grep -q "console\.log\|console\.debug\|console\.warn" "$file"; then
        console_count=$(grep -c "console\.log\|console\.debug\|console\.warn" "$file")
        if [ "$console_count" -gt 2 ]; then
            flag_if_needed "$file" "EXPERIMENTAL" "Contains $console_count console statements - may be debug code" "LOW"
        fi
    fi
done

# 3. Use Metabob to scan for issues if available
if command -v metabob-cli &> /dev/null; then
    echo -e "${BLUE}🛡️  Scanning with Metabob for code issues...${NC}"
    
    # Get critical issues
    if metabob-cli get-priority-issues --severity CRITICAL --format json > /tmp/critical_issues.json 2>/dev/null; then
        node -e "
        try {
            const fs = require('fs');
            const issues = JSON.parse(fs.readFileSync('/tmp/critical_issues.json', 'utf8'));
            
            issues.forEach(issue => {
                if (issue.file && issue.type) {
                    let flagType = 'RISKY';
                    let severity = 'HIGH';
                    
                    if (issue.category?.includes('security')) {
                        flagType = 'SECURITY_RISK';
                        severity = 'CRITICAL';
                    } else if (issue.category?.includes('memory')) {
                        flagType = 'MEMORY_LEAK';
                        severity = 'HIGH';
                    } else if (issue.category?.includes('performance')) {
                        flagType = 'PERFORMANCE';
                        severity = 'MEDIUM';
                    }
                    
                    console.log(\`\${issue.file}|\${flagType}|\${issue.message || issue.description || 'Critical issue detected by Metabob'}|\${severity}\`);
                }
            });
        } catch (e) {
            // Ignore errors
        }
        " | while IFS='|' read -r file flag_type message severity; do
            if [ -n "$file" ] && [ -f "$file" ]; then
                flag_if_needed "$file" "$flag_type" "$message" "$severity"
            fi
        done
        
        rm -f /tmp/critical_issues.json
    fi
    
    # Scan for dead code
    echo -e "${BLUE}💀 Scanning for dead code...${NC}"
    
    if metabob-cli search-issues --pattern "dead.*code|unused.*function|unreachable.*code" --format json > /tmp/dead_code.json 2>/dev/null; then
        node -e "
        try {
            const fs = require('fs');
            const issues = JSON.parse(fs.readFileSync('/tmp/dead_code.json', 'utf8'));
            
            issues.forEach(issue => {
                if (issue.file) {
                    console.log(\`\${issue.file}|DEAD_CODE|\${issue.message || 'Dead code or unused functions detected'}|MEDIUM\`);
                }
            });
        } catch (e) {
            // Ignore errors  
        }
        " | while IFS='|' read -r file flag_type message severity; do
            if [ -n "$file" ] && [ -f "$file" ]; then
                flag_if_needed "$file" "$flag_type" "$message" "$severity"
            fi
        done
        
        rm -f /tmp/dead_code.json
    fi
else
    echo -e "${YELLOW}⚠️  metabob-cli not available - skipping advanced code analysis${NC}"
fi

# 4. Scan for potential memory leaks (basic patterns)
echo -e "${BLUE}🔍 Scanning for potential memory issues...${NC}"

find "$PROJECT_ROOT/src" -name "*.ts" -o -name "*.js" -o -name "*.tsx" -o -name "*.jsx" 2>/dev/null | while read -r file; do
    # Look for event listeners without cleanup
    if grep -q "addEventListener\|on(" "$file" && ! grep -q "removeEventListener\|off(" "$file"; then
        flag_if_needed "$file" "MEMORY_LEAK" "Event listeners added without cleanup - potential memory leak" "MEDIUM"
    fi
    
    # Look for intervals/timeouts without cleanup
    if grep -q "setInterval\|setTimeout" "$file" && ! grep -q "clearInterval\|clearTimeout" "$file"; then
        if [ $(grep -c "setInterval\|setTimeout" "$file") -gt 1 ]; then
            flag_if_needed "$file" "MEMORY_LEAK" "Multiple timers without cleanup - potential memory leak" "MEDIUM"
        fi
    fi
    
    # Look for large arrays or objects that might not be cleaned up
    if grep -q -E "(new Array\([0-9]{4,}\)|Array\([0-9]{4,}\))" "$file"; then
        flag_if_needed "$file" "MEMORY_LEAK" "Large arrays created - check memory usage" "LOW"
    fi
done

# 5. Scan for files that might be deprecated
echo -e "${BLUE}📰 Scanning for deprecated code...${NC}"

find "$PROJECT_ROOT/src" -name "*.ts" -o -name "*.js" -o -name "*.tsx" -o -name "*.jsx" 2>/dev/null | while read -r file; do
    # Look for @deprecated comments or deprecated markers
    if grep -q -i -E "(@deprecated|deprecated|obsolete|legacy)" "$file"; then
        deprecated_count=$(grep -c -i -E "(@deprecated|deprecated|obsolete|legacy)" "$file")
        flag_if_needed "$file" "DEPRECATED" "Contains $deprecated_count deprecated markers - consider removal" "LOW"
    fi
    
    # Look for old import patterns that might indicate legacy code
    if grep -q -E "(require\(|module\.exports)" "$file" && [[ "$file" =~ \.(ts|tsx)$ ]]; then
        flag_if_needed "$file" "DEPRECATED" "Using CommonJS imports in TypeScript - should use ES modules" "LOW"
    fi
done

# Summary
echo ""
echo -e "${BLUE}📊 Scan Results${NC}"
echo -e "${BLUE}=============${NC}"

if [ "$DRY_RUN" = "true" ]; then
    echo -e "${CYAN}Found $FOUND_ISSUES components that would be flagged${NC}"
    
    if [ "$FOUND_ISSUES" -gt 0 ]; then
        echo ""
        echo -e "${YELLOW}To actually flag these components, run:${NC}"
        echo -e "${YELLOW}  ./bin/auto-flag-scan.sh false${NC}"
    else
        echo -e "${GREEN}🎉 No issues found - codebase is clean!${NC}"
    fi
else
    echo -e "${GREEN}Successfully flagged $FLAGGED_COUNT out of $FOUND_ISSUES components${NC}"
    
    if [ "$FLAGGED_COUNT" -gt 0 ]; then
        echo ""
        echo -e "${BLUE}🔍 View all flags: ${NC}./bin/list-flags.sh"
        echo -e "${BLUE}📋 Check limits:  ${NC}./bin/check-flag-limits.sh"
    fi
    
    if [ "$FOUND_ISSUES" -eq 0 ]; then
        echo -e "${GREEN}🎉 No issues found - codebase is clean!${NC}"
    fi
fi

# Recommendations
if [ "$FOUND_ISSUES" -gt 0 ]; then
    echo ""
    echo -e "${BLUE}💡 Recommendations:${NC}"
    
    if [ "$FOUND_ISSUES" -gt 10 ]; then
        echo -e "   ${RED}High number of issues ($FOUND_ISSUES) - consider a code cleanup sprint${NC}"
    elif [ "$FOUND_ISSUES" -gt 5 ]; then
        echo -e "   ${YELLOW}Moderate issues ($FOUND_ISSUES) - address high priority flags first${NC}"
    else
        echo -e "   ${GREEN}Low issue count ($FOUND_ISSUES) - good code quality overall${NC}"
    fi
    
    echo -e "   ${BLUE}1. Address CRITICAL and HIGH severity flags first${NC}"
    echo -e "   ${BLUE}2. Add tests for flagged components${NC}"
    echo -e "   ${BLUE}3. Remove or refactor experimental code${NC}"
    echo -e "   ${BLUE}4. Clean up dead code and deprecated functions${NC}"
fi