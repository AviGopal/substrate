#!/bin/bash
# Collect template execution metrics for ratchet cycle

TEMPLATE_DIR=~/.local/share/opencode/storage/activity-template
OUTPUT_FILE=tmp/template-evolution/metrics-snapshot.json

echo "Collecting template metrics..."

# Initialize JSON structure
cat > "$OUTPUT_FILE" << 'EOF'
{
  "timestamp": "$(date -Iseconds)",
  "domain": "activity-system",
  "metrics": {
    "total_templates": 0,
    "templates_with_executions": 0,
    "total_executions": 0,
    "avg_success_rate": 0,
    "avg_duration_ms": 0,
    "avg_cost_usd": 0
  },
  "bottleneck_candidates": [],
  "top_failing_templates": []
}
EOF

# Count templates
TOTAL=$(ls -1 "$TEMPLATE_DIR"/*.json 2>/dev/null | wc -l)

# Analyze each template
echo "Analyzing $TOTAL templates..."

# Create temporary file for processing
TMP_DATA=$(mktemp)

cd "$TEMPLATE_DIR" || exit 1

for template_file in *.json; do
  [ ! -f "$template_file" ] && continue
  
  template_id=$(basename "$template_file" .json)
  executions=$(jq -r '.executions // 0' "$template_file" 2>/dev/null)
  success_rate=$(jq -r '.successRate // 0' "$template_file" 2>/dev/null)
  avg_duration=$(jq -r '.avgDuration // 0' "$template_file" 2>/dev/null)
  avg_cost=$(jq -r '.avgCost // 0' "$template_file" 2>/dev/null)
  
  # Only include templates with executions
  if [ "$executions" -gt 0 ]; then
    failure_rate=$(echo "100 - $success_rate" | bc)
    
    # Calculate priority score: (1 - success_rate) * executions * avg_impact
    # Higher score = more impactful bottleneck
    priority=$(echo "scale=2; ($failure_rate / 100) * $executions * 10" | bc)
    
    echo "$template_id|$executions|$success_rate|$avg_duration|$avg_cost|$failure_rate|$priority" >> "$TMP_DATA"
  fi
done

# Sort by priority score (highest first)
sort -t'|' -k7 -rn "$TMP_DATA" | head -10 > "${TMP_DATA}.top"

# Build JSON output
cd - > /dev/null

python3 << 'PYTHON_SCRIPT'
import json
from datetime import datetime
import sys

# Read the sorted data
top_templates = []
with open("${TMP_DATA}.top", "r") as f:
    for line in f:
        parts = line.strip().split("|")
        if len(parts) >= 7:
            template_id, executions, success_rate, avg_duration, avg_cost, failure_rate, priority = parts
            top_templates.append({
                "id": template_id,
                "description": f"Template with {failure_rate}% failure rate across {executions} executions",
                "severity": min(10, int(float(failure_rate) / 10)),
                "frequency": min(1.0, float(executions) / 100),  # Normalize to 0-1
                "estimated_impact": "high" if float(priority) > 50 else ("medium" if float(priority) > 20 else "low"),
                "metrics": {
                    "executions": int(executions),
                    "success_rate": float(success_rate),
                    "failure_rate": float(failure_rate),
                    "avg_duration_ms": int(float(avg_duration)),
                    "avg_cost_usd": float(avg_cost)
                },
                "priority_score": float(priority)
            })

# Calculate aggregate metrics
total_executions = sum(t["metrics"]["executions"] for t in top_templates)
avg_success_rate = sum(t["metrics"]["success_rate"] * t["metrics"]["executions"] for t in top_templates) / total_executions if total_executions > 0 else 0
avg_duration = sum(t["metrics"]["avg_duration_ms"] * t["metrics"]["executions"] for t in top_templates) / total_executions if total_executions > 0 else 0
avg_cost = sum(t["metrics"]["avg_cost_usd"] * t["metrics"]["executions"] for t in top_templates) / total_executions if total_executions > 0 else 0

# Build final JSON
output = {
    "timestamp": datetime.now().isoformat(),
    "domain": "activity-system",
    "metrics": {
        "total_templates": len(top_templates),
        "templates_analyzed": len(top_templates),
        "total_executions": total_executions,
        "avg_success_rate": round(avg_success_rate, 2),
        "avg_duration_ms": round(avg_duration, 0),
        "avg_cost_usd": round(avg_cost, 4),
        "error_rate": round(100 - avg_success_rate, 2)
    },
    "bottleneck_candidates": top_templates[:5],  # Top 5 bottlenecks
    "trends": {
        "success_rate_trend": "unknown",
        "cost_trend": "unknown"
    }
}

# Write output
with open("tmp/template-evolution/metrics-snapshot.json", "w") as f:
    json.dump(output, f, indent=2)

print(f"✅ Metrics collected: {len(top_templates)} templates analyzed")
print(f"   Total executions: {total_executions}")
print(f"   Avg success rate: {avg_success_rate:.1f}%")
print(f"   Top bottleneck: {top_templates[0]['id'] if top_templates else 'None'}")

PYTHON_SCRIPT

# Cleanup
rm -f "$TMP_DATA" "${TMP_DATA}.top"

echo "✅ Metrics saved to $OUTPUT_FILE"
