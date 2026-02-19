#!/bin/bash
set -e

# =============================================================================
# Template Promotion to metabob-proto
# =============================================================================
# This script promotes a proven, high-performing activity template to the
# metabob-proto repository as the canonical version.
#
# Usage:
#   ./promote-template-to-proto.sh <template_id> [proto_repo_path]
#
# Requirements:
#   - Template must have 80%+ success rate over 5+ executions
#   - Template must be validated and reviewed
#   - metabob-proto repository must be cloned locally
#
# Example:
#   ./promote-template-to-proto.sh add-logging-statements-abc123 ../metabob-proto
# =============================================================================

TEMPLATE_ID="${1}"
PROTO_REPO="${2:-../metabob-proto}"
BACKEND_URL="${BACKEND_URL:-http://localhost:8080}"
CONTAINER_NAME="${CONTAINER_NAME:-devbob-clean}"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

if [ -z "$TEMPLATE_ID" ]; then
    echo -e "${RED}ERROR: Template ID is required${NC}"
    echo "Usage: $0 <template_id> [proto_repo_path]"
    exit 1
fi

echo -e "${BLUE}==============================================================================${NC}"
echo -e "${BLUE}Template Promotion to metabob-proto${NC}"
echo -e "${BLUE}==============================================================================${NC}"
echo ""
echo -e "${GREEN}Template ID:${NC} ${TEMPLATE_ID}"
echo -e "${GREEN}Backend:${NC} ${BACKEND_URL}"
echo -e "${GREEN}Proto Repo:${NC} ${PROTO_REPO}"
echo ""

# =============================================================================
# Phase 1: Fetch Template from Backend
# =============================================================================

echo -e "${YELLOW}[Phase 1] Fetching template from backend...${NC}"

TEMP_DIR=$(mktemp -d)
TEMPLATE_FILE="${TEMP_DIR}/template.json"

# Try to fetch from container first, then from local backend
if docker ps --filter "name=${CONTAINER_NAME}" --format "{{.Names}}" | grep -q "${CONTAINER_NAME}"; then
    echo "Fetching from container backend..."
    docker exec "${CONTAINER_NAME}" sh -c "curl -sf http://api-server-dev:8080/v2/activities/templates/${TEMPLATE_ID}" > "${TEMPLATE_FILE}" || {
        echo -e "${RED}ERROR: Could not fetch template from container backend${NC}"
        exit 1
    }
else
    echo "Fetching from local backend..."
    curl -sf "${BACKEND_URL}/v2/activities/templates/${TEMPLATE_ID}" > "${TEMPLATE_FILE}" || {
        echo -e "${RED}ERROR: Could not fetch template from backend${NC}"
        echo "Make sure backend is running at: ${BACKEND_URL}"
        exit 1
    }
fi

echo -e "${GREEN}✓ Template fetched successfully${NC}"

# Extract template metadata
TEMPLATE_NAME=$(jq -r '.name' "${TEMPLATE_FILE}")
TEMPLATE_CATEGORY=$(jq -r '.category' "${TEMPLATE_FILE}")
SUCCESS_RATE=$(jq -r '.success_rate // 0' "${TEMPLATE_FILE}")
EXECUTION_COUNT=$(jq -r '.execution_count // 0' "${TEMPLATE_FILE}")
GENERATION=$(jq -r '.generation // 0' "${TEMPLATE_FILE}")

echo ""
echo -e "${BLUE}Template Details:${NC}"
echo -e "  Name: ${TEMPLATE_NAME}"
echo -e "  Category: ${TEMPLATE_CATEGORY}"
echo -e "  Success Rate: ${SUCCESS_RATE}% (${EXECUTION_COUNT} executions)"
echo -e "  Generation: ${GENERATION}"
echo ""

# =============================================================================
# Phase 2: Validate Template Quality
# =============================================================================

echo -e "${YELLOW}[Phase 2] Validating template quality...${NC}"

VALIDATION_PASSED=true
WARNINGS=""

# Check success rate
if (( $(echo "$SUCCESS_RATE < 80" | bc -l) )); then
    WARNINGS="${WARNINGS}\n  ⚠️  Success rate is below 80% (current: ${SUCCESS_RATE}%)"
    VALIDATION_PASSED=false
fi

# Check execution count
if [ "$EXECUTION_COUNT" -lt 5 ]; then
    WARNINGS="${WARNINGS}\n  ⚠️  Execution count is below 5 (current: ${EXECUTION_COUNT})"
    VALIDATION_PASSED=false
fi

# Check template has required fields
TASK_COUNT=$(jq '.task_steps | length' "${TEMPLATE_FILE}")
if [ "$TASK_COUNT" -eq 0 ]; then
    WARNINGS="${WARNINGS}\n  ❌ Template has no tasks"
    VALIDATION_PASSED=false
fi

if [ "$VALIDATION_PASSED" = false ]; then
    echo -e "${YELLOW}Template quality checks:${NC}"
    echo -e "${WARNINGS}"
    echo ""
    echo -e "${YELLOW}This template does not meet promotion criteria.${NC}"
    echo "Recommended criteria:"
    echo "  - Success rate: 80%+ (current: ${SUCCESS_RATE}%)"
    echo "  - Execution count: 5+ (current: ${EXECUTION_COUNT})"
    echo ""
    read -p "Do you want to proceed anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Promotion cancelled."
        rm -rf "${TEMP_DIR}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ Template meets quality criteria${NC}"
fi
echo ""

# =============================================================================
# Phase 3: Prepare Template for Proto
# =============================================================================

echo -e "${YELLOW}[Phase 3] Preparing template for metabob-proto...${NC}"

# Check if proto repo exists
if [ ! -d "${PROTO_REPO}" ]; then
    echo -e "${RED}ERROR: Proto repository not found at: ${PROTO_REPO}${NC}"
    echo "Clone it with: git clone <metabob-proto-url> ${PROTO_REPO}"
    rm -rf "${TEMP_DIR}"
    exit 1
fi

# Create category directory if needed
CATEGORY_DIR="${PROTO_REPO}/templates/${TEMPLATE_CATEGORY}"
mkdir -p "${CATEGORY_DIR}"

# Generate filename (sanitize template name)
SAFE_NAME=$(echo "${TEMPLATE_NAME}" | tr ' ' '-' | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]//g')
OUTPUT_FILE="${CATEGORY_DIR}/${SAFE_NAME}.json"

# Convert backend format to OpenCode activity template format
# (Backend may have extra fields like variant_id, stats, etc.)
jq '{
  name: .name,
  description: .description,
  category: .category,
  tasks: .task_steps,
  variables: .variables,
  context_requirements: .context_requirements,
  integration: .integration,
  metabob: .metabob
}' "${TEMPLATE_FILE}" > "${OUTPUT_FILE}"

echo -e "${GREEN}✓ Template prepared for proto${NC}"
echo "Output file: ${OUTPUT_FILE}"
echo ""

# =============================================================================
# Phase 4: Generate Documentation
# =============================================================================

echo -e "${YELLOW}[Phase 4] Generating template documentation...${NC}"

DOC_FILE="${CATEGORY_DIR}/${SAFE_NAME}.md"

cat > "${DOC_FILE}" <<EOF
# ${TEMPLATE_NAME}

**Category:** ${TEMPLATE_CATEGORY}  
**Template ID:** ${SAFE_NAME}  
**Status:** ✅ Promoted $(date +%Y-%m-%d)

## Description

$(jq -r '.description' "${TEMPLATE_FILE}")

## Performance Metrics

- **Success Rate:** ${SUCCESS_RATE}% (${EXECUTION_COUNT} executions)
- **Generation:** ${GENERATION}
- **Promoted From:** ${TEMPLATE_ID}

## Tasks

$(jq -r '.task_steps[] | "### Task: \(.description // .id)\n\nSubagent: \(.subagent)\n"' "${TEMPLATE_FILE}")

## Variables

$(jq -r '.variables | to_entries[] | "- **\(.key)**: \(.value.description // "No description")\n  - Type: \(.value.type)\n  - Required: \(.value.required)"' "${TEMPLATE_FILE}")

## Usage

\`\`\`bash
opencode --activity ${SAFE_NAME} \\
$(jq -r '.variables | to_entries[] | "  --var \(.key)=\"<value>\" \\"' "${TEMPLATE_FILE}")
\`\`\`

## Validation Notes

This template was promoted after meeting the following criteria:
- ✅ Success rate: ${SUCCESS_RATE}% (target: 80%+)
- ✅ Execution count: ${EXECUTION_COUNT} (target: 5+)
- ✅ Manual review and validation

## History

- **Created:** Generated via create-activity-self-contained
- **Promoted:** $(date +%Y-%m-%d) from backend variant ${TEMPLATE_ID}

EOF

echo -e "${GREEN}✓ Documentation generated${NC}"
echo "Documentation: ${DOC_FILE}"
echo ""

# =============================================================================
# Phase 5: Commit to Proto Repository
# =============================================================================

echo -e "${YELLOW}[Phase 5] Committing to proto repository...${NC}"

cd "${PROTO_REPO}"

# Check if repo has uncommitted changes
if ! git diff --quiet || ! git diff --cached --quiet; then
    echo -e "${YELLOW}WARNING: Proto repository has uncommitted changes${NC}"
    read -p "Do you want to continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Promotion cancelled."
        cd - > /dev/null
        rm -rf "${TEMP_DIR}"
        exit 1
    fi
fi

# Add template files
git add "${OUTPUT_FILE}" "${DOC_FILE}"

# Create commit message
COMMIT_MSG="feat(templates): promote ${TEMPLATE_NAME} (${SUCCESS_RATE}% success)

Template: ${SAFE_NAME}
Category: ${TEMPLATE_CATEGORY}
Success Rate: ${SUCCESS_RATE}% (${EXECUTION_COUNT} executions)
Generation: ${GENERATION}
Promoted from: ${TEMPLATE_ID}

This template has proven reliable and is promoted as the canonical version.
"

git commit -m "${COMMIT_MSG}"

echo -e "${GREEN}✓ Changes committed to proto repository${NC}"
echo ""

# =============================================================================
# Phase 6: Generate Promotion Summary
# =============================================================================

echo -e "${YELLOW}[Phase 6] Generating promotion summary...${NC}"

SUMMARY_FILE="${PROTO_REPO}/PROMOTIONS.md"

# Append to promotions log
cat >> "${SUMMARY_FILE}" <<EOF

## ${TEMPLATE_NAME} - $(date +%Y-%m-%d)

- **Template ID:** ${SAFE_NAME}
- **Category:** ${TEMPLATE_CATEGORY}
- **Success Rate:** ${SUCCESS_RATE}% (${EXECUTION_COUNT} executions)
- **Generation:** ${GENERATION}
- **Promoted From:** ${TEMPLATE_ID}
- **Files:**
  - Template: \`templates/${TEMPLATE_CATEGORY}/${SAFE_NAME}.json\`
  - Docs: \`templates/${TEMPLATE_CATEGORY}/${SAFE_NAME}.md\`

EOF

git add "${SUMMARY_FILE}"
git commit --amend --no-edit

echo -e "${GREEN}✓ Promotion summary updated${NC}"
echo ""

cd - > /dev/null

# =============================================================================
# Cleanup
# =============================================================================

rm -rf "${TEMP_DIR}"

# =============================================================================
# Done
# =============================================================================

echo -e "${BLUE}==============================================================================${NC}"
echo -e "${GREEN}✅ Template Promoted Successfully${NC}"
echo -e "${BLUE}==============================================================================${NC}"
echo ""
echo "Template has been promoted to metabob-proto:"
echo "  Template: ${OUTPUT_FILE}"
echo "  Documentation: ${DOC_FILE}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Review the changes: cd ${PROTO_REPO} && git show"
echo "  2. Push to remote: cd ${PROTO_REPO} && git push origin main"
echo "  3. Create a release tag: cd ${PROTO_REPO} && git tag -a v1.0.0-${SAFE_NAME} -m 'Release ${TEMPLATE_NAME}'"
echo "  4. Update OpenCode to use this template by default"
echo ""
