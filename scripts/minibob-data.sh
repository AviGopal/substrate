#!/bin/bash
# MiniBob Learning Data Export/Import
# Backup and restore activity templates, execution traces, and learning data

set -e

# Configuration
API_HOST="${MINIBOB_API_HOST:-http://activity.metabob.local}"
TOKEN_FILE="${MINIBOB_TOKEN_FILE:-$HOME/.minibob/token}"
BACKUP_DIR="${MINIBOB_BACKUP_DIR:-$HOME/.minibob/backups}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

usage() {
    echo "MiniBob Learning Data Export/Import"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  export [name]     Export all learning data to a backup file"
    echo "  import <file>     Import learning data from a backup file"
    echo "  list              List available backups"
    echo "  templates         Export only activity templates"
    echo "  traces            Export only execution traces (last 1000)"
    echo "  summary           Show learning data summary"
    echo ""
    echo "Options:"
    echo "  --limit N         Limit number of items (default: 1000)"
    echo "  --output FILE     Output file path"
    echo ""
    echo "Environment Variables:"
    echo "  MINIBOB_API_HOST    API endpoint (default: http://api.minibob.local)"
    echo "  MINIBOB_BACKUP_DIR  Backup directory (default: ~/.minibob/backups)"
    echo ""
    echo "Examples:"
    echo "  $0 export                     # Export all data with timestamp"
    echo "  $0 export my-backup           # Export with custom name"
    echo "  $0 templates --output out.json  # Export templates only"
    echo "  $0 import backup-2026-03-26.json  # Import from file"
    echo "  $0 summary                    # Show what data exists"
}

get_token() {
    if [ ! -f "$TOKEN_FILE" ]; then
        echo -e "${RED}No auth token. Run 'scripts/minibob-auth.sh login' first.${NC}" >&2
        exit 1
    fi
    cat "$TOKEN_FILE"
}

auth_header() {
    echo "Authorization: Bearer $(get_token)"
}

ensure_backup_dir() {
    mkdir -p "$BACKUP_DIR"
}

api_get() {
    local endpoint="$1"
    local limit="${2:-1000}"

    curl -s -X GET "$API_HOST$endpoint?limit=$limit" \
        -H "$(auth_header)" \
        -H "Content-Type: application/json"
}

do_summary() {
    echo -e "${BLUE}Fetching learning data summary...${NC}"
    echo ""

    # Templates count
    TEMPLATES=$(api_get "/v2/activities/templates" 1)
    TEMPLATE_COUNT=$(echo "$TEMPLATES" | jq 'if type == "array" then length else 0 end' 2>/dev/null || echo "0")
    echo -e "Activity Templates: ${GREEN}$TEMPLATE_COUNT${NC}"

    # Execution traces count
    TRACES=$(api_get "/v2/activities/execution-traces" 1)
    TRACE_COUNT=$(echo "$TRACES" | jq 'if type == "array" then length else (.data // []) | length end' 2>/dev/null || echo "0")
    echo -e "Execution Traces:   ${GREEN}$TRACE_COUNT${NC}+"

    # Metrics summary
    METRICS=$(api_get "/v2/activities/metrics/summary")
    if echo "$METRICS" | jq -e '.total_executions' > /dev/null 2>&1; then
        TOTAL_EXEC=$(echo "$METRICS" | jq -r '.total_executions // 0')
        SUCCESS_RATE=$(echo "$METRICS" | jq -r '.success_rate // 0')
        echo -e "Total Executions:   ${GREEN}$TOTAL_EXEC${NC}"
        echo -e "Success Rate:       ${GREEN}${SUCCESS_RATE}%${NC}"
    fi

    # Composition graph
    COMPOSITION=$(api_get "/v2/activities/composition/graph" 10)
    COMP_COUNT=$(echo "$COMPOSITION" | jq 'if type == "array" then length else 0 end' 2>/dev/null || echo "0")
    echo -e "Composition Links:  ${GREEN}$COMP_COUNT${NC}+"

    echo ""
    echo -e "${YELLOW}Run '$0 export' to backup all data${NC}"
}

do_export_templates() {
    local output="${1:-}"
    local limit="${2:-1000}"

    echo -e "${YELLOW}Exporting activity templates...${NC}"

    TEMPLATES=$(api_get "/v2/activities/templates" "$limit")

    if [ -n "$output" ]; then
        echo "$TEMPLATES" | jq '.' > "$output"
        echo -e "${GREEN}Exported to: $output${NC}"
    else
        echo "$TEMPLATES" | jq '.'
    fi
}

do_export_traces() {
    local output="${1:-}"
    local limit="${2:-1000}"

    echo -e "${YELLOW}Exporting execution traces (last $limit)...${NC}"

    TRACES=$(api_get "/v2/activities/execution-traces" "$limit")

    if [ -n "$output" ]; then
        echo "$TRACES" | jq '.' > "$output"
        echo -e "${GREEN}Exported to: $output${NC}"
    else
        echo "$TRACES" | jq '.'
    fi
}

do_export_all() {
    local name="${1:-backup-$(date +%Y-%m-%d-%H%M%S)}"
    local limit="${2:-1000}"

    ensure_backup_dir
    local output="$BACKUP_DIR/$name.json"

    echo -e "${BLUE}Exporting all learning data...${NC}"
    echo ""

    # Collect all data
    echo -e "${YELLOW}  Fetching templates...${NC}"
    TEMPLATES=$(api_get "/v2/activities/templates" "$limit")

    echo -e "${YELLOW}  Fetching execution traces...${NC}"
    TRACES=$(api_get "/v2/activities/execution-traces" "$limit")

    echo -e "${YELLOW}  Fetching composition graph...${NC}"
    COMPOSITION=$(api_get "/v2/activities/composition/graph" "$limit")

    echo -e "${YELLOW}  Fetching goal paths...${NC}"
    GOAL_PATHS=$(api_get "/v2/activities/goal-paths" "$limit")

    echo -e "${YELLOW}  Fetching impulse relevance...${NC}"
    IMPULSE_RELEVANCE=$(api_get "/v2/activities/impulse-relevance" "$limit")

    echo -e "${YELLOW}  Fetching tool usage...${NC}"
    TOOL_USAGE=$(api_get "/v2/activities/tool-usage" "$limit")

    echo -e "${YELLOW}  Fetching execution sequences...${NC}"
    SEQUENCES=$(api_get "/v2/activities/execution-sequences" "$limit")

    echo -e "${YELLOW}  Fetching impulses...${NC}"
    IMPULSES=$(api_get "/v2/impulses" "$limit")

    # Combine into single export
    jq -n \
        --arg timestamp "$(date -Iseconds)" \
        --arg api_host "$API_HOST" \
        --argjson templates "$TEMPLATES" \
        --argjson traces "$TRACES" \
        --argjson composition "$COMPOSITION" \
        --argjson goal_paths "$GOAL_PATHS" \
        --argjson impulse_relevance "$IMPULSE_RELEVANCE" \
        --argjson tool_usage "$TOOL_USAGE" \
        --argjson sequences "$SEQUENCES" \
        --argjson impulses "$IMPULSES" \
        '{
            export_metadata: {
                timestamp: $timestamp,
                api_host: $api_host,
                schema_version: "1.0"
            },
            data: {
                activity_templates: $templates,
                execution_traces: $traces,
                composition_graph: $composition,
                goal_execution_paths: $goal_paths,
                impulse_relevance: $impulse_relevance,
                tool_usage: $tool_usage,
                execution_sequences: $sequences,
                impulses: $impulses
            }
        }' > "$output"

    echo ""
    echo -e "${GREEN}Export complete!${NC}"
    echo "  File: $output"
    echo "  Size: $(du -h "$output" | cut -f1)"

    # Show counts
    echo ""
    echo "  Contents:"
    echo "    Templates:          $(echo "$TEMPLATES" | jq 'length')"
    echo "    Execution Traces:   $(echo "$TRACES" | jq 'if type == "array" then length else (.data // []) | length end')"
    echo "    Composition Links:  $(echo "$COMPOSITION" | jq 'length')"
    echo "    Goal Paths:         $(echo "$GOAL_PATHS" | jq 'length')"
    echo "    Impulse Relevance:  $(echo "$IMPULSE_RELEVANCE" | jq 'length')"
    echo "    Tool Usage:         $(echo "$TOOL_USAGE" | jq 'length')"
    echo "    Sequences:          $(echo "$SEQUENCES" | jq 'length')"
    echo "    Impulses:           $(echo "$IMPULSES" | jq 'length')"
}

do_import() {
    local file="$1"

    if [ ! -f "$file" ]; then
        echo -e "${RED}File not found: $file${NC}"
        exit 1
    fi

    echo -e "${BLUE}Importing from: $file${NC}"
    echo ""

    # Validate structure
    if ! jq -e '.data.activity_templates' "$file" > /dev/null 2>&1; then
        echo -e "${RED}Invalid backup file format${NC}"
        exit 1
    fi

    # Show metadata
    TIMESTAMP=$(jq -r '.export_metadata.timestamp' "$file")
    echo "  Export timestamp: $TIMESTAMP"
    echo ""

    # Import templates
    TEMPLATES=$(jq '.data.activity_templates' "$file")
    TEMPLATE_COUNT=$(echo "$TEMPLATES" | jq 'length')

    echo -e "${YELLOW}Importing $TEMPLATE_COUNT templates...${NC}"

    # Import each template
    echo "$TEMPLATES" | jq -c '.[]' | while read -r template; do
        VARIANT_ID=$(echo "$template" | jq -r '.variant_id // .id')

        # POST to register endpoint
        RESPONSE=$(curl -s -X POST "$API_HOST/v2/activities/templates" \
            -H "$(auth_header)" \
            -H "Content-Type: application/json" \
            -d "$template")

        if echo "$RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
            echo -e "  ${RED}Failed: $VARIANT_ID${NC}"
        else
            echo -e "  ${GREEN}Imported: $VARIANT_ID${NC}"
        fi
    done

    echo ""
    echo -e "${GREEN}Import complete!${NC}"
    echo ""
    echo -e "${YELLOW}Note: Execution traces and learning data are imported for reference${NC}"
    echo -e "${YELLOW}but Thompson Sampling parameters will rebuild through new executions.${NC}"
}

do_list() {
    ensure_backup_dir

    echo -e "${BLUE}Available backups in $BACKUP_DIR:${NC}"
    echo ""

    if [ -z "$(ls -A "$BACKUP_DIR" 2>/dev/null)" ]; then
        echo "  No backups found"
        echo ""
        echo -e "  Run '${YELLOW}$0 export${NC}' to create a backup"
    else
        ls -lh "$BACKUP_DIR"/*.json 2>/dev/null | while read -r line; do
            FILE=$(echo "$line" | awk '{print $NF}')
            SIZE=$(echo "$line" | awk '{print $5}')
            DATE=$(echo "$line" | awk '{print $6, $7, $8}')
            BASENAME=$(basename "$FILE")

            # Get timestamp from file
            TIMESTAMP=$(jq -r '.export_metadata.timestamp // "unknown"' "$FILE" 2>/dev/null)
            TEMPLATE_COUNT=$(jq '.data.activity_templates | length' "$FILE" 2>/dev/null || echo "?")

            echo -e "  ${GREEN}$BASENAME${NC}"
            echo "    Size: $SIZE"
            echo "    Templates: $TEMPLATE_COUNT"
            echo "    Created: $TIMESTAMP"
            echo ""
        done
    fi
}

# Parse options
LIMIT=1000
OUTPUT=""
while [[ $# -gt 0 ]]; do
    case $1 in
        --limit)
            LIMIT="$2"
            shift 2
            ;;
        --output)
            OUTPUT="$2"
            shift 2
            ;;
        *)
            break
            ;;
    esac
done

# Main
case "${1:-}" in
    export)
        do_export_all "${2:-}" "$LIMIT"
        ;;
    import)
        if [ -z "${2:-}" ]; then
            echo -e "${RED}Usage: $0 import <file>${NC}"
            exit 1
        fi
        do_import "$2"
        ;;
    list)
        do_list
        ;;
    templates)
        do_export_templates "$OUTPUT" "$LIMIT"
        ;;
    traces)
        do_export_traces "$OUTPUT" "$LIMIT"
        ;;
    summary)
        do_summary
        ;;
    -h|--help|help)
        usage
        ;;
    *)
        usage
        exit 1
        ;;
esac
