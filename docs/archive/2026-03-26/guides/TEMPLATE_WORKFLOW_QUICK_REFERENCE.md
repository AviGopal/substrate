# Template Workflow Quick Reference

## 🚀 Quick Start Commands

### Check System Status
```bash
# Quick status check (recommended)
./test-activity-simple.sh

# View metrics in browser
open http://localhost:8080/v2/activities/templates
# (requires port forwarding or access from container)

# From inside container
docker exec devbob-clean curl -sf http://api-server-dev:8080/v2/activities/templates | jq '.'
```

### Run Full System Test
```bash
# End-to-end test (creates + executes template)
./test-activity-system-proof.sh "my-template-name"

# Check results
ls -la ./proof-logs/
cat ./proof-logs/latest/PROOF_SUMMARY.md
```

### Promote Template to metabob-proto
```bash
# Check for promotion candidates
./test-activity-simple.sh | grep "Promotion Candidates"

# Promote a template
./promote-template-to-proto.sh {variant_id} ../metabob-proto

# Review and push
cd ../metabob-proto
git show
git push origin main
```

## 📊 Template Metrics

### Success Criteria
- ✅ Success Rate: ≥ 80%
- ✅ Execution Count: ≥ 5
- ✅ Manual Review: Passed
- ✅ Average Cost: < $2.00 (configurable)
- ✅ Average Duration: < 600s (10 minutes)

### Query Metrics
```bash
# All templates with metrics
docker exec devbob-clean curl -sf http://api-server-dev:8080/v2/activities/templates | \
  jq '.[] | {name, success_rate, execution_count, avg_cost}'

# Find promotion candidates
docker exec devbob-clean curl -sf http://api-server-dev:8080/v2/activities/templates | \
  jq '.[] | select(.success_rate >= 80 and .execution_count >= 5)'

# Find templates needing improvement
docker exec devbob-clean curl -sf http://api-server-dev:8080/v2/activities/templates | \
  jq '.[] | select(.success_rate < 50 and .execution_count >= 3)'
```

## 🔧 Development Workflow

### 1. Create New Template

**Option A: Manual (JSON file)**
```bash
# Create template JSON
cat > my-template.json <<'EOF'
{
  "name": "My Template",
  "category": "feature",
  "description": "What it does",
  "tasks": [...],
  "variables": {...}
}
EOF

# Register with backend (if you have metabob-cli)
# This is typically done automatically by OpenCode
```

**Option B: Programmatic (via create-activity-self-contained)**
```bash
# In OpenCode
"Create an activity template called 'my-template' that does X, Y, Z"
# OpenCode will use create-activity-self-contained template
```

### 2. Test Template

```bash
# Execute via OpenCode
docker exec -it devbob-clean opencode run

# In prompt:
"Use the my-template activity to process file.py"
```

### 3. Track Metrics

```bash
# Wait for 5+ executions, then check metrics
./test-activity-simple.sh

# Look for your template in the output
```

### 4. Improve Template (if needed)

```bash
# If success rate < 80%, use evolution template
# In OpenCode:
"Use evolve-activity-self-contained to improve the my-template template"
```

### 5. Promote Template

```bash
# Once metrics meet criteria
./promote-template-to-proto.sh {variant_id} ../metabob-proto
cd ../metabob-proto
git push origin main
```

## 📁 File Locations

### Test Scripts
- `test-activity-system-proof.sh` - Full end-to-end test
- `test-activity-simple.sh` - Quick status check
- `promote-template-to-proto.sh` - Promotion automation

### Documentation
- `TEMPLATE_PROMOTION_WORKFLOW.md` - Complete workflow guide
- `ACTIVITY_SYSTEM_PROOF_COMPLETE.md` - System proof and evidence
- `TEMPLATE_WORKFLOW_QUICK_REFERENCE.md` - This file

### Logs
- `proof-logs/{timestamp}/` - Test execution logs
  - `PROOF_SUMMARY.md` - Human-readable report
  - `all-templates.json` - All templates from backend
  - `promotion-candidates.json` - Ready for promotion
  - `needs-improvement.json` - Requires attention

## 🎯 Common Tasks

### Find Best Performing Template
```bash
docker exec devbob-clean curl -sf http://api-server-dev:8080/v2/activities/templates | \
  jq 'sort_by(-.success_rate) | .[0:5] | .[] | {name, success_rate, execution_count}'
```

### Find Templates Needing Work
```bash
docker exec devbob-clean curl -sf http://api-server-dev:8080/v2/activities/templates | \
  jq '.[] | select(.success_rate < 50 and .execution_count >= 3) | {name, success_rate, execution_count}'
```

### Get Template Details
```bash
docker exec devbob-clean curl -sf http://api-server-dev:8080/v2/activities/templates/{variant_id} | jq .
```

### Check Bootstrap Template Health
```bash
./test-activity-simple.sh | grep -A 10 "Bootstrap Template"
```

## 🐛 Troubleshooting

### Backend Not Accessible
```bash
# Check backend is running
docker ps | grep api-server-dev

# Check from container (correct way)
docker exec devbob-clean curl -sf http://api-server-dev:8080/v2/activities/templates

# ❌ Don't test from host (backend is on internal network)
curl http://localhost:8080/v2/activities/templates  # Won't work
```

### Template Not Showing Up
```bash
# Wait a few seconds for backend to persist
sleep 2

# Check if template exists
docker exec devbob-clean curl -sf http://api-server-dev:8080/v2/activities/templates | \
  jq '.[] | select(.name | contains("my-template"))'
```

### Low Success Rate
```bash
# Get execution history
docker exec devbob-clean curl -sf http://api-server-dev:8080/v2/activities/templates/{variant_id}/stats

# Use evolution template to improve
# In OpenCode: "Use evolve-activity-self-contained to improve {template-name}"
```

## 📚 Key Concepts

### Content-Addressable IDs
- Format: `template-name-{content-hash}`
- Same content = same ID (idempotent)
- Different content = new variant (auto-created)

### Thompson Sampling
- Automatically selects best-performing variant
- Beta distribution: Beta(successes + 1, failures + 1)
- Balances exploration vs exploitation

### Template Generations
- Generation 0: Original template
- Generation 1+: Evolved variants
- Parent hash links variants together

### Promotion Criteria
Templates must meet these thresholds:
- Success rate ≥ 80%
- Execution count ≥ 5
- Manual review passed
- No security concerns

## 🔄 Weekly Workflow

### Monday: Review Metrics
```bash
./test-activity-simple.sh
# Identify: candidates for promotion, templates needing work
```

### Tuesday-Thursday: Improve Templates
```bash
# For each template needing improvement:
# 1. Review failing executions
# 2. Use evolve-activity-self-contained
# 3. Test new variant
```

### Friday: Promote & Release
```bash
# For each promotion candidate:
./promote-template-to-proto.sh {variant_id} ../metabob-proto
cd ../metabob-proto
git push origin main
git tag -a v1.0.{N} -m "Release {Template Name}"
git push origin v1.0.{N}
```

## 💡 Tips

### Best Practices
- ✅ Test templates thoroughly before promotion (5+ executions)
- ✅ Use descriptive template names (kebab-case)
- ✅ Document variables clearly
- ✅ Add validation rules to catch errors early
- ✅ Keep tasks focused and single-purpose
- ✅ Review metrics weekly

### Common Mistakes
- ❌ Promoting too early (< 5 executions)
- ❌ Ignoring low success rates
- ❌ Not documenting template changes
- ❌ Hardcoding paths or assumptions
- ❌ Making tasks too complex
- ❌ Forgetting to test from container

## 📞 Help

### Need More Detail?
- Full workflow: `TEMPLATE_PROMOTION_WORKFLOW.md`
- System proof: `ACTIVITY_SYSTEM_PROOF_COMPLETE.md`
- Backend API: `repos/metabob-rpc-api/README.md`

### Issues?
- Check backend logs: `docker logs api-server-dev`
- Check devbob logs: `docker logs devbob-clean`
- Review session logs: `ls -la /root/.local/share/opencode/sessions/`

---

**Quick Reference Version**: 1.0  
**Last Updated**: 2026-02-19  
**For**: Activity System Template Workflow
