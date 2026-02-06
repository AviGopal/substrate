#!/bin/bash
# Validation Script for Activity Templates
# Validates activity template JSON against ActivityTemplate.Schema requirements
# Usage: validate-activity-template.sh <template.json>

TEMPLATE_FILE="$1"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track validation errors
ERRORS=0

# Helper function to print error
error() {
  echo -e "${RED}✗ $1${NC}"
  ERRORS=$((ERRORS + 1))
}

# Helper function to print success
success() {
  echo -e "${GREEN}✓ $1${NC}"
}

# Helper function to print warning
warning() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

# Validation functions
validate_json_syntax() {
  # Check if file exists
  if [ ! -f "$TEMPLATE_FILE" ]; then
    error "File does not exist: $TEMPLATE_FILE"
    return 1
  fi

  # Validate JSON syntax with jq
  if ! jq empty "$TEMPLATE_FILE" 2>/dev/null; then
    error "Invalid JSON syntax"
    return 1
  fi

  success "JSON syntax valid"
  return 0
}

validate_required_fields() {
  local missing_fields=()

  # Check for required top-level fields
  for field in id name version category tasks; do
    if ! jq -e ".$field" "$TEMPLATE_FILE" >/dev/null 2>&1; then
      missing_fields+=("$field")
    fi
  done

  if [ ${#missing_fields[@]} -gt 0 ]; then
    for field in "${missing_fields[@]}"; do
      error "Missing required field: $field"
    done
    return 1
  fi

  success "Required fields present: id, name, version, category, tasks"
  return 0
}

validate_tasks() {
  # Count tasks
  local task_count
  task_count=$(jq '.tasks | length' "$TEMPLATE_FILE")

  if [ "$task_count" -eq 0 ]; then
    error "No tasks defined (tasks array is empty)"
    return 1
  fi

  if [ "$task_count" -lt 1 ]; then
    warning "Task count: $task_count (recommended: 1-10)"
  elif [ "$task_count" -gt 10 ]; then
    warning "Task count: $task_count (recommended: 1-10, consider splitting into smaller templates)"
  else
    success "Task count: $task_count (within recommended range 1-10)"
  fi

  # Check each task for required fields
  local task_errors=0
  local required_task_fields=("id" "subagent" "description" "dependencies" "prompt" "validation" "retry")

  for i in $(seq 0 $((task_count - 1))); do
    local task_id
    task_id=$(jq -r ".tasks[$i].id // \"task-$i\"" "$TEMPLATE_FILE")

    for field in "${required_task_fields[@]}"; do
      if ! jq -e ".tasks[$i].$field" "$TEMPLATE_FILE" >/dev/null 2>&1; then
        error "Task '$task_id': missing required field '$field'"
        task_errors=$((task_errors + 1))
      fi
    done

    # Validate validation object structure
    if jq -e ".tasks[$i].validation" "$TEMPLATE_FILE" >/dev/null 2>&1; then
      if ! jq -e ".tasks[$i].validation.check" "$TEMPLATE_FILE" >/dev/null 2>&1; then
        error "Task '$task_id': validation object missing 'check' field"
        task_errors=$((task_errors + 1))
      fi
      if ! jq -e ".tasks[$i].validation.error" "$TEMPLATE_FILE" >/dev/null 2>&1; then
        error "Task '$task_id': validation object missing 'error' field"
        task_errors=$((task_errors + 1))
      fi
    fi

    # Validate retry configuration structure
    if jq -e ".tasks[$i].retry" "$TEMPLATE_FILE" >/dev/null 2>&1; then
      if ! jq -e ".tasks[$i].retry.max_attempts" "$TEMPLATE_FILE" >/dev/null 2>&1; then
        error "Task '$task_id': retry object missing 'max_attempts' field"
        task_errors=$((task_errors + 1))
      fi
      if ! jq -e ".tasks[$i].retry.strategy" "$TEMPLATE_FILE" >/dev/null 2>&1; then
        error "Task '$task_id': retry object missing 'strategy' field"
        task_errors=$((task_errors + 1))
      fi
    fi
  done

  if [ $task_errors -eq 0 ]; then
    success "All tasks have required fields and valid structure"
    return 0
  fi

  return 1
}

validate_metadata() {
  # Check for recommended metadata fields
  local has_warnings=0

  if ! jq -e ".description" "$TEMPLATE_FILE" >/dev/null 2>&1; then
    warning "Missing recommended field: description"
    has_warnings=1
  fi

  if ! jq -e ".variables" "$TEMPLATE_FILE" >/dev/null 2>&1; then
    warning "Missing recommended field: variables (if template accepts inputs)"
    has_warnings=1
  fi

  if [ $has_warnings -eq 0 ]; then
    success "Metadata fields present"
  fi

  return 0
}

# Main execution
if [ -z "$TEMPLATE_FILE" ]; then
  echo "Usage: $0 <template.json>"
  echo ""
  echo "Validates activity template JSON against ActivityTemplate.Schema requirements"
  exit 1
fi

echo "Validating activity template: $TEMPLATE_FILE"
echo ""

# Run all validations (exit early if file doesn't exist or JSON is invalid)
if ! validate_json_syntax; then
  echo ""
  echo -e "${RED}✗ Cannot continue validation - fix file and JSON syntax errors first${NC}"
  exit 1
fi

validate_required_fields
validate_tasks
validate_metadata

echo ""

# Final result
if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}✓ Template validation passed${NC}"
  exit 0
else
  echo -e "${RED}✗ Template validation failed with $ERRORS error(s)${NC}"
  echo ""
  echo "Fix the errors above and try again"
  exit 1
fi
