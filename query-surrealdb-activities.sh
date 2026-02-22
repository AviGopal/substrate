#!/bin/bash

echo "======================================================================"
echo "SurrealDB Activity Data Query"
echo "======================================================================"
echo ""

# Query activity_execution table
echo "1. Activity Execution Records:"
echo "----------------------------------------------------------------------"
curl -s -X POST "http://localhost:8000/sql" \
  -u "root:root" \
  -H "NS: metabob" \
  -H "DB: metabob" \
  -H "Accept: application/json" \
  -d "INFO FOR TABLE activity_execution;" | jq '.'
echo ""

# Query template_metrics table
echo "2. Template Metrics Table Schema:"
echo "----------------------------------------------------------------------"
curl -s -X POST "http://localhost:8000/sql" \
  -u "root:root" \
  -H "NS: metabob" \
  -H "DB: metabob" \
  -H "Accept: application/json" \
  -d "INFO FOR TABLE template_metrics;" | jq '.'
echo ""

# List all tables
echo "3. Available Tables in metabob Database:"
echo "----------------------------------------------------------------------"
curl -s -X POST "http://localhost:8000/sql" \
  -u "root:root" \
  -H "NS: metabob" \
  -H "DB: metabob" \
  -H "Accept: application/json" \
  -d "INFO FOR DB;" | jq '.[] | .result.tb' 2>/dev/null
echo ""

echo "======================================================================"
