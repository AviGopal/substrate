#!/bin/bash
# Interactive Activity Template Creator
# Guides you through creating a valid activity template JSON

set -e

echo "=========================================="
echo "Activity Template Creator"
echo "=========================================="
echo ""

# Helper function to get user input
get_input() {
    local prompt="$1"
    local default="$2"
    local var_name="$3"
    
    if [ -n "$default" ]; then
        read -p "$prompt [$default]: " value
        value="${value:-$default}"
    else
        read -p "$prompt: " value
        while [ -z "$value" ]; do
            echo "This field is required."
            read -p "$prompt: " value
        done
    fi
    
    eval "$var_name='$value'"
}

# Basic Information
echo "=== Basic Information ==="
echo ""

get_input "Template Name (e.g., 'Add REST Endpoint')" "" TEMPLATE_NAME
get_input "Description (what does this template do?)" "" TEMPLATE_DESC

echo ""
echo "Select Category:"
echo "  1) feature"
echo "  2) bugfix"
echo "  3) refactor"
echo "  4) tool"
echo "  5) infrastructure"
read -p "Enter number (1-5): " category_choice

case $category_choice in
    1) CATEGORY="feature" ;;
    2) CATEGORY="bugfix" ;;
    3) CATEGORY="refactor" ;;
    4) CATEGORY="tool" ;;
    5) CATEGORY="infrastructure" ;;
    *) echo "Invalid choice"; exit 1 ;;
esac

# Tasks
echo ""
echo "=== Tasks ==="
echo "How many tasks? (3-5 recommended, 7 maximum)"
read -p "Number of tasks: " NUM_TASKS

if [ "$NUM_TASKS" -lt 1 ] || [ "$NUM_TASKS" -gt 7 ]; then
    echo "Error: Must have 1-7 tasks"
    exit 1
fi

# Generate task definitions
TASKS_JSON="["

for ((i=1; i<=NUM_TASKS; i++)); do
    echo ""
    echo "--- Task $i ---"
    
    get_input "Task ID (kebab-case, e.g., 'analyze-code')" "" TASK_ID
    get_input "Task Description" "" TASK_DESC
    
    # Dependencies
    if [ $i -eq 1 ]; then
        TASK_DEPS="[]"
    else
        echo "Dependencies (comma-separated task IDs, or press Enter for none):"
        read -p "> " deps_input
        if [ -z "$deps_input" ]; then
            TASK_DEPS="[]"
        else
            # Convert comma-separated to JSON array
            TASK_DEPS="[$(echo "$deps_input" | sed 's/,/","/g' | sed 's/^/"/' | sed 's/$/"/')]"
        fi
    fi
    
    get_input "Prompt template (instructions for agent)" "Complete the task: {{description}}" TASK_PROMPT
    get_input "Max tokens" "10000" MAX_TOKENS
    get_input "Compression strategy (none/filter/summarize/adaptive)" "filter" COMPRESSION
    get_input "Retry max attempts" "3" MAX_ATTEMPTS
    get_input "Retry strategy (simple/progressive-context/trailblazing)" "simple" RETRY_STRATEGY
    
    # Build task JSON
    TASK_JSON=$(cat <<EOF
    {
      "id": "$TASK_ID",
      "subagent": "general",
      "description": "$TASK_DESC",
      "dependencies": $TASK_DEPS,
      "prompt": {
        "template": "$TASK_PROMPT",
        "maxTokens": $MAX_TOKENS,
        "compressionStrategy": "$COMPRESSION",
        "variables": []
      },
      "validation": {
        "requiredFiles": [],
        "requiredPatterns": [],
        "forbiddenPatterns": [],
        "commands": []
      },
      "retry": {
        "max_attempts": $MAX_ATTEMPTS,
        "strategy": "$RETRY_STRATEGY"
      }
    }
EOF
)
    
    TASKS_JSON="$TASKS_JSON$TASK_JSON"
    
    if [ $i -lt $NUM_TASKS ]; then
        TASKS_JSON="$TASKS_JSON,"
    fi
done

TASKS_JSON="$TASKS_JSON]"

# Optional Features
echo ""
echo "=== Optional Features ==="
get_input "Enable Metabob integration? (y/n)" "n" ENABLE_METABOB

if [ "$ENABLE_METABOB" = "y" ]; then
    METABOB_ENABLED="true"
else
    METABOB_ENABLED="false"
fi

# Generate final template
TEMPLATE_ID=$(echo "$TEMPLATE_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/-\+/-/g' | sed 's/^-\|-$//g')
OUTPUT_FILE="${TEMPLATE_ID}.json"

cat > "$OUTPUT_FILE" <<EOF
{
  "name": "$TEMPLATE_NAME",
  "description": "$TEMPLATE_DESC",
  "category": "$CATEGORY",
  "tasks": $TASKS_JSON,
  "integration": {
    "preChecks": [],
    "postChecks": [],
    "qualityGates": []
  },
  "metabob": {
    "enabled": $METABOB_ENABLED,
    "learningMode": true,
    "targetContextTokens": 5000,
    "annotationStrategy": "key-components"
  }
}
EOF

echo ""
echo "=========================================="
echo "Template created: $OUTPUT_FILE"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Review and edit: $OUTPUT_FILE"
echo "  2. Validate: bash scripts/validate-activity-template.sh $OUTPUT_FILE"
echo "  3. Register: Use register_activity_template tool"
echo ""
echo "Tip: See ACTIVITY_TEMPLATE_CREATION_GUIDE.md for detailed documentation"
