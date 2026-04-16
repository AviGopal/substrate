#!/bin/bash
#
# MiniBob React Learning Script
#
# This script executes multiple variations of React activities to train MiniBob.
# Run this periodically (daily/weekly) to improve MiniBob's React development skills.
#
# Usage:
#   ./learn-react.sh                 # Run all learning sessions
#   ./learn-react.sh --components    # Only component creation
#   ./learn-react.sh --integration   # Only integration patterns
#

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Component variations to practice
COMPONENTS=(
    "Button:primary,secondary,danger:small,medium,large"
    "Card:default,outlined,elevated:compact,normal,spacious"
    "Modal:center,fullscreen,drawer:small,medium,large"
    "Input:text,email,password,number:small,medium,large"
    "Dropdown:single,multi,searchable:auto"
    "Tabs:horizontal,vertical:default"
    "Alert:info,success,warning,error:inline,toast"
    "Avatar:circle,square,rounded:xs,sm,md,lg,xl"
    "Badge:dot,text,icon:neutral,primary,success,error"
    "Checkbox:default,indeterminate:small,medium,large"
)

# Feature integrations to practice
FEATURES=(
    "UserProfile:/api/users/:id:api"
    "ProductList:/api/products:api"
    "ShoppingCart:cart:local-storage"
    "SearchResults:/api/search:api"
    "Notifications:notifications:context"
    "UserSettings:settings:local-storage"
    "CommentThread:/api/comments:api"
    "ActivityFeed:/api/activities:api"
)

# Apps to scaffold
APPS=(
    "blog-platform:vite:true:true"
    "task-manager:vite:true:true"
    "notes-app:vite:true:false"
    "portfolio-site:vite:true:false"
    "dashboard-app:vite:true:true"
)

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}MiniBob React Learning Session${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "This script will execute multiple React activities to train MiniBob."
echo "Each execution creates a trace that feeds the learning loop."
echo ""

# Check if minibob is available
if ! command -v minibob &> /dev/null; then
    echo -e "${RED}Error: minibob not found in PATH${NC}"
    echo "Please install minibob first: npm install -g minibob"
    exit 1
fi

# Parse command line arguments
MODE="all"
if [ "$1" == "--components" ]; then
    MODE="components"
elif [ "$1" == "--integration" ]; then
    MODE="integration"
elif [ "$1" == "--apps" ]; then
    MODE="apps"
elif [ "$1" == "--help" ]; then
    echo "Usage:"
    echo "  $0              Run all learning sessions"
    echo "  $0 --components  Only component creation"
    echo "  $0 --integration Only integration patterns"
    echo "  $0 --apps        Only app scaffolding"
    echo ""
    exit 0
fi

EXECUTION_COUNT=0
SUCCESS_COUNT=0
FAILURE_COUNT=0

# Function to execute activity and track results
execute_activity() {
    local description="$1"
    local goal="$2"

    echo -e "${YELLOW}Executing:${NC} $description"
    echo -e "${BLUE}Goal:${NC} $goal"
    echo ""

    ((EXECUTION_COUNT++))

    if minibob --single "$goal"; then
        ((SUCCESS_COUNT++))
        echo -e "${GREEN}✓ Success${NC}"
    else
        ((FAILURE_COUNT++))
        echo -e "${RED}✗ Failed${NC}"
    fi

    echo ""
    echo "---"
    echo ""
}

# Component Creation Learning
if [ "$MODE" == "all" ] || [ "$MODE" == "components" ]; then
    echo -e "${BLUE}=== Component Creation Learning ===${NC}"
    echo ""

    for component_spec in "${COMPONENTS[@]}"; do
        IFS=':' read -r name variants sizes <<< "$component_spec"

        goal="Create a $name component with variants ($variants) and sizes ($sizes). Include TypeScript types, tests, and CSS Modules."

        execute_activity "Component: $name" "$goal"
    done
fi

# UI Integration Learning
if [ "$MODE" == "all" ] || [ "$MODE" == "integration" ]; then
    echo -e "${BLUE}=== UI Integration Learning ===${NC}"
    echo ""

    for feature_spec in "${FEATURES[@]}"; do
        IFS=':' read -r name endpoint datasource <<< "$feature_spec"

        if [ "$datasource" == "api" ]; then
            goal="Integrate the $name feature with the REST API endpoint $endpoint. Create custom hooks, container/view components, and handle all states (loading, error, success)."
        elif [ "$datasource" == "local-storage" ]; then
            goal="Integrate the $name feature with localStorage persistence. Create custom hooks for storage, container/view components, and error handling."
        else
            goal="Integrate the $name feature with React Context. Create context provider, custom hooks, and consumer components."
        fi

        execute_activity "Feature: $name" "$goal"
    done
fi

# App Scaffolding Learning
if [ "$MODE" == "all" ] || [ "$MODE" == "apps" ]; then
    echo -e "${BLUE}=== App Scaffolding Learning ===${NC}"
    echo ""

    for app_spec in "${APPS[@]}"; do
        IFS=':' read -r name framework routing state <<< "$app_spec"

        routing_text="without routing"
        if [ "$routing" == "true" ]; then
            routing_text="with React Router"
        fi

        state_text="without state management"
        if [ "$state" == "true" ]; then
            state_text="with Zustand state management"
        fi

        goal="Create a new React app called '$name' using $framework, $routing_text, and $state_text. Include TypeScript configuration, path aliases, and global styles."

        execute_activity "App: $name" "$goal"
    done
fi

# Styling Practice (random components)
if [ "$MODE" == "all" ]; then
    echo -e "${BLUE}=== Styling Practice ===${NC}"
    echo ""

    STYLE_COMPONENTS=("Button" "Card" "Modal" "Input" "Alert")

    for comp in "${STYLE_COMPONENTS[@]}"; do
        # Alternate between CSS Modules and Tailwind
        if [ $((RANDOM % 2)) -eq 0 ]; then
            approach="CSS Modules"
        else
            approach="Tailwind CSS"
        fi

        goal="Create a $comp component and style it with $approach. Include responsive design, dark mode support, and accessibility features."

        execute_activity "Styling: $comp with $approach" "$goal"
    done
fi

# Summary
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Learning Session Complete${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Total Executions: $EXECUTION_COUNT"
echo -e "${GREEN}Successes: $SUCCESS_COUNT${NC}"
echo -e "${RED}Failures: $FAILURE_COUNT${NC}"

if [ $EXECUTION_COUNT -gt 0 ]; then
    SUCCESS_RATE=$(awk "BEGIN {printf \"%.1f\", ($SUCCESS_COUNT / $EXECUTION_COUNT) * 100}")
    echo "Success Rate: $SUCCESS_RATE%"
fi

echo ""
echo "Next steps:"
echo "1. Review execution traces in the activity dashboard"
echo "2. Check Thompson Sampling metrics"
echo "3. Identify patterns in failures"
echo "4. Refine templates based on learnings"
echo ""
echo "To view dashboard:"
echo "  Open https://internal.metabob.com in your browser"
echo ""
echo "To analyze recent executions:"
echo "  minibob --single 'Show me the last 10 React activity executions and their success rates'"
echo ""
