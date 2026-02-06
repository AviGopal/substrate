#!/bin/bash

# Check Flag Limits Script
# Blocks commits if too many components are flagged

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
FLAG_METADATA="$PROJECT_ROOT/.metabob/component-flags.json"

# Default limits (can be overridden)
MAX_TOTAL_FLAGS="${MAX_TOTAL_FLAGS:-10}"
MAX_CRITICAL_FLAGS="${MAX_CRITICAL_FLAGS:-2}"
MAX_HIGH_FLAGS="${MAX_HIGH_FLAGS:-5}"
MAX_SECURITY_FLAGS="${MAX_SECURITY_FLAGS:-1}"
MAX_MEMORY_LEAK_FLAGS="${MAX_MEMORY_LEAK_FLAGS:-3}"

# Parse arguments
STRICT_MODE="${1:-false}"
EXIT_ON_FAILURE="${2:-true}"

# Show help
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Flag Limits Checker"
    echo ""
    echo "USAGE:"
    echo "  check-flag-limits.sh [strict_mode] [exit_on_failure]"
    echo ""
    echo "ARGUMENTS:"
    echo "  strict_mode      true|false (default: false) - Use stricter limits"
    echo "  exit_on_failure  true|false (default: true) - Exit with error code on limit exceeded"
    echo ""
    echo "ENVIRONMENT VARIABLES:"
    echo "  MAX_TOTAL_FLAGS        Maximum total active flags (default: 10)"
    echo "  MAX_CRITICAL_FLAGS     Maximum critical flags (default: 2)" 
    echo "  MAX_HIGH_FLAGS         Maximum high severity flags (default: 5)"
    echo "  MAX_SECURITY_FLAGS     Maximum security flags (default: 1)"
    echo "  MAX_MEMORY_LEAK_FLAGS  Maximum memory leak flags (default: 3)"
    echo ""
    echo "EXAMPLES:"
    echo "  check-flag-limits.sh                    # Check with default limits"
    echo "  check-flag-limits.sh true               # Strict mode (lower limits)"
    echo "  MAX_TOTAL_FLAGS=5 check-flag-limits.sh  # Custom limit"
    echo ""
    echo "EXIT CODES:"
    echo "  0 - All limits OK"
    echo "  1 - Total flag limit exceeded"
    echo "  2 - Critical flag limit exceeded"
    echo "  3 - Security flag limit exceeded"
    echo "  4 - Memory leak flag limit exceeded"
    exit 0
fi

# Apply strict mode limits
if [ "$STRICT_MODE" = "true" ]; then
    MAX_TOTAL_FLAGS=5
    MAX_CRITICAL_FLAGS=1
    MAX_HIGH_FLAGS=3
    MAX_SECURITY_FLAGS=0
    MAX_MEMORY_LEAK_FLAGS=2
    echo -e "${YELLOW}🔒 STRICT MODE: Using stricter flag limits${NC}"
fi

echo -e "${BLUE}🚨 Checking Component Flag Limits${NC}"
echo -e "${BLUE}================================${NC}"

# Check if flag metadata exists
if [ ! -f "$FLAG_METADATA" ]; then
    echo -e "${GREEN}✅ No component flags found - all limits OK${NC}"
    exit 0
fi

# Get flag statistics
STATS=$(node -e "
const fs = require('fs');
const flags = JSON.parse(fs.readFileSync('$FLAG_METADATA', 'utf8'));
const activeFlags = flags.filter(f => !f.resolved);

const stats = {
    total: activeFlags.length,
    critical: activeFlags.filter(f => f.severity === 'CRITICAL').length,
    high: activeFlags.filter(f => f.severity === 'HIGH').length,
    medium: activeFlags.filter(f => f.severity === 'MEDIUM').length,
    low: activeFlags.filter(f => f.severity === 'LOW').length,
    security: activeFlags.filter(f => f.type === 'SECURITY_RISK').length,
    memoryLeak: activeFlags.filter(f => f.type === 'MEMORY_LEAK').length,
    deadCode: activeFlags.filter(f => f.type === 'DEAD_CODE').length,
    noTests: activeFlags.filter(f => f.type === 'NO_TESTS').length,
    experimental: activeFlags.filter(f => f.type === 'EXPERIMENTAL').length,
    risky: activeFlags.filter(f => f.type === 'RISKY').length
};

console.log(JSON.stringify(stats, null, 2));
")

# Parse statistics
TOTAL_FLAGS=$(echo "$STATS" | jq -r '.total')
CRITICAL_FLAGS=$(echo "$STATS" | jq -r '.critical')
HIGH_FLAGS=$(echo "$STATS" | jq -r '.high')
MEDIUM_FLAGS=$(echo "$STATS" | jq -r '.medium')
LOW_FLAGS=$(echo "$STATS" | jq -r '.low')
SECURITY_FLAGS=$(echo "$STATS" | jq -r '.security')
MEMORY_LEAK_FLAGS=$(echo "$STATS" | jq -r '.memoryLeak')
DEAD_CODE_FLAGS=$(echo "$STATS" | jq -r '.deadCode')
NO_TESTS_FLAGS=$(echo "$STATS" | jq -r '.noTests')
EXPERIMENTAL_FLAGS=$(echo "$STATS" | jq -r '.experimental')
RISKY_FLAGS=$(echo "$STATS" | jq -r '.risky')

echo -e "${BLUE}📊 Current Flag Counts:${NC}"
echo "   Total Active Flags: $TOTAL_FLAGS"
echo "   Critical: $CRITICAL_FLAGS | High: $HIGH_FLAGS | Medium: $MEDIUM_FLAGS | Low: $LOW_FLAGS"
echo ""
echo -e "${BLUE}🏷️  By Type:${NC}"
echo "   Security Risk: $SECURITY_FLAGS"
echo "   Memory Leak: $MEMORY_LEAK_FLAGS" 
echo "   Dead Code: $DEAD_CODE_FLAGS"
echo "   No Tests: $NO_TESTS_FLAGS"
echo "   Experimental: $EXPERIMENTAL_FLAGS"
echo "   Risky: $RISKY_FLAGS"

echo ""
echo -e "${BLUE}⚖️  Limits Check:${NC}"

# Track violations
VIOLATIONS=0
EXIT_CODE=0

# Check total flag limit
if [ "$TOTAL_FLAGS" -gt "$MAX_TOTAL_FLAGS" ]; then
    echo -e "${RED}❌ Total flags ($TOTAL_FLAGS) exceeds limit ($MAX_TOTAL_FLAGS)${NC}"
    VIOLATIONS=$((VIOLATIONS + 1))
    if [ "$EXIT_CODE" -eq 0 ]; then EXIT_CODE=1; fi
else
    echo -e "${GREEN}✅ Total flags ($TOTAL_FLAGS) within limit ($MAX_TOTAL_FLAGS)${NC}"
fi

# Check critical flag limit
if [ "$CRITICAL_FLAGS" -gt "$MAX_CRITICAL_FLAGS" ]; then
    echo -e "${RED}❌ Critical flags ($CRITICAL_FLAGS) exceeds limit ($MAX_CRITICAL_FLAGS)${NC}"
    VIOLATIONS=$((VIOLATIONS + 1))
    if [ "$EXIT_CODE" -lt 2 ]; then EXIT_CODE=2; fi
else
    echo -e "${GREEN}✅ Critical flags ($CRITICAL_FLAGS) within limit ($MAX_CRITICAL_FLAGS)${NC}"
fi

# Check high severity limit
if [ "$HIGH_FLAGS" -gt "$MAX_HIGH_FLAGS" ]; then
    echo -e "${YELLOW}⚠️  High severity flags ($HIGH_FLAGS) exceeds limit ($MAX_HIGH_FLAGS)${NC}"
    VIOLATIONS=$((VIOLATIONS + 1))
    # Don't change exit code for high flags unless it's worse than current
else
    echo -e "${GREEN}✅ High severity flags ($HIGH_FLAGS) within limit ($MAX_HIGH_FLAGS)${NC}"
fi

# Check security flag limit
if [ "$SECURITY_FLAGS" -gt "$MAX_SECURITY_FLAGS" ]; then
    echo -e "${RED}🛡️  Security flags ($SECURITY_FLAGS) exceeds limit ($MAX_SECURITY_FLAGS)${NC}"
    VIOLATIONS=$((VIOLATIONS + 1))
    if [ "$EXIT_CODE" -lt 3 ]; then EXIT_CODE=3; fi
else
    echo -e "${GREEN}✅ Security flags ($SECURITY_FLAGS) within limit ($MAX_SECURITY_FLAGS)${NC}"
fi

# Check memory leak flag limit
if [ "$MEMORY_LEAK_FLAGS" -gt "$MAX_MEMORY_LEAK_FLAGS" ]; then
    echo -e "${RED}🔍 Memory leak flags ($MEMORY_LEAK_FLAGS) exceeds limit ($MAX_MEMORY_LEAK_FLAGS)${NC}"
    VIOLATIONS=$((VIOLATIONS + 1))
    if [ "$EXIT_CODE" -lt 4 ]; then EXIT_CODE=4; fi
else
    echo -e "${GREEN}✅ Memory leak flags ($MEMORY_LEAK_FLAGS) within limit ($MAX_MEMORY_LEAK_FLAGS)${NC}"
fi

echo ""

# Summary and recommendations
if [ "$VIOLATIONS" -eq 0 ]; then
    echo -e "${GREEN}🎉 All flag limits are within acceptable ranges!${NC}"
    echo -e "${GREEN}✅ Code quality gates: PASSED${NC}"
else
    echo -e "${RED}⚠️  $VIOLATIONS flag limit violations detected${NC}"
    echo -e "${RED}❌ Code quality gates: FAILED${NC}"
    
    echo ""
    echo -e "${BLUE}🔧 Immediate Actions Required:${NC}"
    
    if [ "$CRITICAL_FLAGS" -gt "$MAX_CRITICAL_FLAGS" ]; then
        echo -e "${RED}1. 🚨 Address $CRITICAL_FLAGS critical issues immediately${NC}"
        echo -e "${RED}   Critical issues can cause system failures or security breaches${NC}"
    fi
    
    if [ "$SECURITY_FLAGS" -gt "$MAX_SECURITY_FLAGS" ]; then
        echo -e "${RED}2. 🛡️  Fix $SECURITY_FLAGS security vulnerabilities${NC}"
        echo -e "${RED}   Security issues must be resolved before deployment${NC}"
    fi
    
    if [ "$MEMORY_LEAK_FLAGS" -gt "$MAX_MEMORY_LEAK_FLAGS" ]; then
        echo -e "${YELLOW}3. 🔍 Address $MEMORY_LEAK_FLAGS memory leak issues${NC}"
        echo -e "${YELLOW}   Memory leaks can cause performance degradation${NC}"
    fi
    
    if [ "$TOTAL_FLAGS" -gt "$MAX_TOTAL_FLAGS" ]; then
        echo -e "${YELLOW}4. 📊 Reduce total flag count from $TOTAL_FLAGS to $MAX_TOTAL_FLAGS${NC}"
        echo -e "${YELLOW}   High flag count indicates code quality issues${NC}"
    fi
    
    echo ""
    echo -e "${BLUE}💡 Recommended Actions:${NC}"
    echo -e "   View all flags: ${MAGENTA}./bin/list-flags.sh${NC}"
    echo -e "   Priority issues: ${MAGENTA}./bin/list-flags.sh false table | grep -E 'CRITICAL|HIGH'${NC}"
    echo -e "   Auto-resolve: ${MAGENTA}./bin/auto-resolve-flags.sh${NC}"
    echo -e "   Manual resolve: ${MAGENTA}./bin/resolve-flag.sh <file> <type>${NC}"
fi

# Show trend information if log exists
FLAG_LOG="$PROJECT_ROOT/.metabob/component-flags.log"
if [ -f "$FLAG_LOG" ] && [ -s "$FLAG_LOG" ]; then
    echo ""
    echo -e "${BLUE}📈 Recent Trend:${NC}"
    
    # Count flags added vs resolved in last 7 days
    SEVEN_DAYS_AGO=$(date -d '7 days ago' '+%Y-%m-%d' 2>/dev/null || date -v-7d '+%Y-%m-%d' 2>/dev/null || echo "1970-01-01")
    
    FLAGS_ADDED=$(grep -v "RESOLVED" "$FLAG_LOG" | awk -F'|' -v since="$SEVEN_DAYS_AGO" '$1 >= since' | wc -l || echo "0")
    FLAGS_RESOLVED=$(grep "RESOLVED" "$FLAG_LOG" | awk -F'|' -v since="$SEVEN_DAYS_AGO" '$1 >= since' | wc -l || echo "0")
    
    echo "   Flags added (7 days): $FLAGS_ADDED"
    echo "   Flags resolved (7 days): $FLAGS_RESOLVED"
    
    if [ "$FLAGS_RESOLVED" -gt "$FLAGS_ADDED" ]; then
        echo -e "${GREEN}   📈 Improving trend (+$(($FLAGS_RESOLVED - $FLAGS_ADDED)))${NC}"
    elif [ "$FLAGS_ADDED" -gt "$FLAGS_RESOLVED" ]; then
        echo -e "${RED}   📉 Declining trend (-$(($FLAGS_ADDED - $FLAGS_RESOLVED)))${NC}"
    else
        echo -e "${YELLOW}   📊 Stable trend (±0)${NC}"
    fi
fi

# Configuration summary
echo ""
echo -e "${BLUE}⚙️  Current Limits Configuration:${NC}"
echo "   Max Total: $MAX_TOTAL_FLAGS"
echo "   Max Critical: $MAX_CRITICAL_FLAGS"
echo "   Max High: $MAX_HIGH_FLAGS"
echo "   Max Security: $MAX_SECURITY_FLAGS"
echo "   Max Memory Leak: $MAX_MEMORY_LEAK_FLAGS"

if [ "$STRICT_MODE" = "true" ]; then
    echo -e "${YELLOW}   Mode: STRICT${NC}"
else
    echo -e "${BLUE}   Mode: NORMAL${NC}"
fi

# Integration with CI/commit hooks
echo ""
echo -e "${BLUE}🔗 Integration Status:${NC}"

if [ -f "$PROJECT_ROOT/.git/hooks/pre-commit" ]; then
    if grep -q "check-flag-limits" "$PROJECT_ROOT/.git/hooks/pre-commit"; then
        echo -e "${GREEN}✅ Pre-commit hook integration: ENABLED${NC}"
    else
        echo -e "${YELLOW}⚠️  Pre-commit hook exists but flag checking not integrated${NC}"
        echo -e "${YELLOW}   Add this line to .git/hooks/pre-commit:${NC}"
        echo -e "${YELLOW}   ./bin/check-flag-limits.sh${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  No pre-commit hook found${NC}"
    echo -e "${YELLOW}   Install: ln -s ../../scripts/pre-commit-activity-validation .git/hooks/pre-commit${NC}"
fi

# Final exit
if [ "$EXIT_ON_FAILURE" = "true" ] && [ "$EXIT_CODE" -gt 0 ]; then
    echo ""
    case "$EXIT_CODE" in
        1) echo -e "${RED}🚫 BLOCKED: Too many total flags - commit blocked${NC}" ;;
        2) echo -e "${RED}🚨 BLOCKED: Too many critical flags - immediate attention required${NC}" ;;
        3) echo -e "${RED}🛡️  BLOCKED: Too many security flags - security review required${NC}" ;;
        4) echo -e "${RED}🔍 BLOCKED: Too many memory leak flags - performance review required${NC}" ;;
    esac
    
    echo -e "${RED}Fix flagged issues before continuing${NC}"
    exit "$EXIT_CODE"
else
    if [ "$VIOLATIONS" -gt 0 ]; then
        echo -e "${YELLOW}⚠️  Violations detected but not blocking (exit_on_failure=false)${NC}"
    fi
    exit 0
fi