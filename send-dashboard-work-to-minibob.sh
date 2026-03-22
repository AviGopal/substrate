#!/bin/bash
#
# Send Activity Dashboard enhancement work to MiniBob
#

set -e

MINIBOB_URL="http://localhost:8890"
TEMPLATE_FILE="/tmp/dashboard-enhancement-activity.json"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== MiniBob Dashboard Enhancement Task ===${NC}"

# 1. Start port-forward to MiniBob
echo -e "${YELLOW}[1/4] Starting port-forward to MiniBob...${NC}"
kubectl port-forward -n activity-system svc/minibob-minibob-cluster 8890:8080 > /tmp/minibob-pf.log 2>&1 &
PF_PID=$!
sleep 3

# 2. Create activity template
echo -e "${YELLOW}[2/4] Creating activity template...${NC}"
cat > "$TEMPLATE_FILE" << 'EOF'
{
  "id": "enhance-dashboard-phase1",
  "name": "Enhance Activity Dashboard - Phase 1",
  "description": "Apply minimal, data-rich styling and add key enhancements to repos/activity-dashboard",
  "category": "feature",
  "variables": [],
  "tasks": [
    {
      "id": "task-1-setup",
      "subagent": "general",
      "description": "Clone activity-dashboard repo and review design documents",
      "dependencies": [],
      "prompt": {
        "template": "You are working on enhancing the Activity Dashboard for MiniBob observability.\n\n## Your Task\n\n1. Clone the repository:\n```bash\ngit clone https://github.com/metabob-labs/activity-dashboard.git /workspace/activity-dashboard\ncd /workspace/activity-dashboard\n```\n\n2. Read the design plan available at the host machine:\n   - ACTIVITY_DASHBOARD_DESIGN_PLAN.md (comprehensive design)\n   - MINIBOB_DASHBOARD_TASK.md (specific Phase 1 tasks)\n\nNote: Since you're in a clean MiniBob environment, you'll need to understand:\n- Tech Stack: Bun + React 19 + TypeScript + shadcn/ui\n- Components to enhance: SystemOverview, ActivityLibrary, LearningSystem\n- Design principle: Minimal colors (status only), data-rich, 4px spacing\n\n3. Install dependencies:\n```bash\nbun install\n```\n\n4. Review the current components:\n```bash\nls -la src/components/\ncat src/components/SystemOverview.tsx | head -50\ncat src/components/ActivityLibrary.tsx | head -50\n```\n\n5. Output a summary of:\n   - Repository successfully cloned (yes/no)\n   - Dependencies installed (yes/no)\n   - Current components reviewed (list them)\n   - Ready for Phase 1 enhancements (yes/no)\n\nOutput format: JSON object with these fields.",
        "maxTokens": 4000,
        "compressionStrategy": "filter"
      },
      "outputImpulses": ["setup-status"],
      "validation": {
        "requiredFiles": [],
        "requiredPatterns": [],
        "forbiddenPatterns": []
      },
      "retry": {
        "maxAttempts": 2,
        "strategy": "simple"
      }
    },
    {
      "id": "task-2-styling-consistency",
      "subagent": "general",
      "description": "Apply minimal, data-rich styling pattern consistently",
      "dependencies": ["task-1-setup"],
      "prompt": {
        "template": "Now apply the minimal styling pattern to all components.\n\n## Setup Status\n{{impulse:setup-status}}\n\n## Styling Requirements\n\nApply these changes to SystemOverview.tsx, ActivityLibrary.tsx, and LearningSystem.tsx:\n\n### 1. Card Padding (Data Density)\n- CardHeader: className=\"pb-3\" (reduce from pb-6)\n- CardContent: className=\"pt-0\" (reduce from pt-6)\n\n### 2. Table Density\n- TableCell: className=\"py-2 text-sm\"\n- TableHeader: className=\"text-xs uppercase text-muted-foreground\"\n- TableRow: className=\"hover:bg-muted/50 cursor-pointer\"\n\n### 3. Color Usage (Minimal)\n- Remove decorative colors\n- Use color ONLY for status:\n  - Green: success\n  - Red: failure  \n  - Yellow: warning\n  - Blue: info\n- All other text: text-foreground or text-muted-foreground\n\n### 4. Spacing Consistency\n- Use gap-2 (8px) or gap-4 (16px) for element spacing\n- No custom padding values\n\n## Implementation\n\n1. Edit src/components/SystemOverview.tsx\n2. Edit src/components/ActivityLibrary.tsx  \n3. Edit src/components/LearningSystem.tsx\n\n4. Test the changes:\n```bash\nbun dev\n# Verify it starts without errors (Ctrl+C after checking)\n```\n\n5. Output:\n   - Files modified (list)\n   - Styling pattern applied (yes/no)\n   - Dev server starts (yes/no)\n   - Ready for next task (yes/no)",
        "maxTokens": 8000,
        "compressionStrategy": "filter"
      },
      "outputImpulses": ["styling-status"],
      "validation": {
        "requiredFiles": [],
        "requiredPatterns": [],
        "forbiddenPatterns": []
      },
      "retry": {
        "maxAttempts": 2,
        "strategy": "simple"
      }
    },
    {
      "id": "task-3-enhancements",
      "subagent": "general",
      "description": "Add key enhancements: error rate card, timestamps, detail dialog, tooltips, CSV export",
      "dependencies": ["task-2-styling-consistency"],
      "prompt": {
        "template": "Now add the Phase 1 enhancements.\n\n## Styling Status\n{{impulse:styling-status}}\n\n## Enhancements to Implement\n\n### 1. SystemOverview - Error Rate Card\nAdd a new metric card after the Success Rate card:\n\n```tsx\n<Card>\n  <CardHeader className=\"flex flex-row items-center justify-between space-y-0 pb-2\">\n    <CardTitle className=\"text-sm font-medium\">Error Rate</CardTitle>\n    <AlertCircle className=\"h-4 w-4 text-muted-foreground\" />\n  </CardHeader>\n  <CardContent>\n    <div className=\"text-2xl font-bold\">{errorRate.toFixed(1)}%</div>\n    <p className=\"text-xs text-muted-foreground\">\n      {failedCount} failed / {totalCount} total\n    </p>\n  </CardContent>\n</Card>\n```\n\nCalculate from templates: `(templates.filter(t => t.success_rate < 50).length / templates.length) * 100`\n\n### 2. SystemOverview - Last Updated Timestamps\nAdd to each metric card's CardDescription:\n\n```tsx\n<CardDescription>Updated {timeAgo} ago</CardDescription>\n```\n\nUse date-fns or simple logic: `Math.floor((Date.now() - lastUpdated) / 1000)}s ago`\n\n### 3. ActivityLibrary - Template Detail Dialog\nCreate new file: src/components/TemplateDetailDialog.tsx\n\n```tsx\nimport { Dialog, DialogContent, DialogHeader, DialogTitle } from \"@/components/ui/dialog\"\n\nexport function TemplateDetailDialog({ template, open, onOpenChange }) {\n  return (\n    <Dialog open={open} onOpenChange={onOpenChange}>\n      <DialogContent className=\"max-w-3xl\">\n        <DialogHeader>\n          <DialogTitle>{template.variant_name}</DialogTitle>\n        </DialogHeader>\n        <div className=\"space-y-4\">\n          <pre className=\"text-xs overflow-auto\">\n            {JSON.stringify(template, null, 2)}\n          </pre>\n        </div>\n      </DialogContent>\n    </Dialog>\n  )\n}\n```\n\nAdd to ActivityLibrary: click row → open dialog with template details\n\n### 4. ActivityLibrary - Thompson Sampling Tooltip\nWrap alpha/beta values with Tooltip:\n\n```tsx\nimport { Tooltip, TooltipContent, TooltipTrigger } from \"@/components/ui/tooltip\"\n\n<Tooltip>\n  <TooltipTrigger>{alpha}/{beta}</TooltipTrigger>\n  <TooltipContent>\n    <p>Thompson Sampling: α = successes + 1, β = failures + 1</p>\n    <p>Higher α/β ratio = higher selection probability</p>\n  </TooltipContent>\n</Tooltip>\n```\n\n### 5. ActivityLibrary - CSV Export\nAdd export button to CardHeader:\n\n```tsx\nimport { Download } from \"lucide-react\"\nimport { Button } from \"@/components/ui/button\"\n\nfunction exportToCSV(templates) {\n  const csv = [\n    'ID,Name,Category,Success Rate,Alpha,Beta',\n    ...templates.map(t => `${t.variant_id},${t.variant_name},${t.category},${t.success_rate},${t.thompson_alpha},${t.thompson_beta}`)\n  ].join('\\n')\n  \n  const blob = new Blob([csv], { type: 'text/csv' })\n  const url = URL.createObjectURL(blob)\n  const a = document.createElement('a')\n  a.href = url\n  a.download = `templates-${Date.now()}.csv`\n  a.click()\n}\n\n<Button onClick={() => exportToCSV(filteredTemplates)} variant=\"outline\" size=\"sm\">\n  <Download className=\"h-4 w-4 mr-2\" />\n  Export CSV\n</Button>\n```\n\n## Implementation Steps\n\n1. Modify src/components/SystemOverview.tsx (error rate + timestamps)\n2. Modify src/components/ActivityLibrary.tsx (tooltips + export)\n3. Create src/components/TemplateDetailDialog.tsx\n4. Test all features work\n5. Commit changes\n\n## Output\n\nProvide summary:\n- Error rate card added (yes/no)\n- Timestamps added (yes/no)  \n- Detail dialog created (yes/no)\n- Tooltips added (yes/no)\n- CSV export working (yes/no)\n- All features tested (yes/no)\n- Git commit created (yes/no with commit hash)",
        "maxTokens": 12000,
        "compressionStrategy": "filter"
      },
      "outputImpulses": ["enhancements-status"],
      "validation": {
        "requiredFiles": [],
        "requiredPatterns": [],
        "forbiddenPatterns": []
      },
      "retry": {
        "maxAttempts": 3,
        "strategy": "simple"
      }
    },
    {
      "id": "task-4-verification",
      "subagent": "general",
      "description": "Test build, verify functionality, create summary",
      "dependencies": ["task-3-enhancements"],
      "prompt": {
        "template": "Final verification and summary.\n\n## Enhancements Status\n{{impulse:enhancements-status}}\n\n## Verification Steps\n\n1. Run build:\n```bash\ncd /workspace/activity-dashboard\nbun run build\n```\n\n2. Check for TypeScript errors:\n```bash\nbun run type-check\n```\n\n3. List all modified files:\n```bash\ngit status\ngit diff --stat\n```\n\n4. Create summary report:\n\nOutput JSON:\n```json\n{\n  \"phase\": \"Phase 1 Complete\",\n  \"filesModified\": [\"list of files\"],\n  \"filesCreated\": [\"list of new files\"],\n  \"buildSuccess\": true/false,\n  \"typeCheckSuccess\": true/false,\n  \"features\": {\n    \"stylingConsistency\": true/false,\n    \"errorRateCard\": true/false,\n    \"timestamps\": true/false,\n    \"detailDialog\": true/false,\n    \"tooltips\": true/false,\n    \"csvExport\": true/false\n  },\n  \"successCriteria\": {\n    \"allExistingFunctionalityWorks\": true/false,\n    \"consistentStyling\": true/false,\n    \"noConsoleErrors\": true/false,\n    \"buildSucceeds\": true/false\n  },\n  \"nextSteps\": \"Deploy to dashboard.minibob.local via helmfile\",\n  \"estimatedImpact\": \"Improved data density, better UX, minimal design achieved\"\n}\n```",
        "maxTokens": 6000,
        "compressionStrategy": "filter"
      },
      "outputImpulses": ["verification-report"],
      "validation": {
        "requiredFiles": [],
        "requiredPatterns": [],
        "forbiddenPatterns": []
      },
      "retry": {
        "maxAttempts": 2,
        "strategy": "simple"
      }
    }
  ]
}
EOF

echo -e "${GREEN}Template created at $TEMPLATE_FILE${NC}"

# 3. Check MiniBob health
echo -e "${YELLOW}[3/4] Checking MiniBob health...${NC}"
if curl -s "$MINIBOB_URL/health" | jq -e '.status == "ok"' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ MiniBob is healthy${NC}"
else
    echo -e "${RED}✗ MiniBob health check failed${NC}"
    kill $PF_PID 2>/dev/null
    exit 1
fi

# 4. Submit activity to MiniBob
echo -e "${YELLOW}[4/4] Submitting activity to MiniBob...${NC}"
echo ""
echo -e "${BLUE}Sending enhancement task to MiniBob...${NC}"

RESPONSE=$(curl -s -X POST "$MINIBOB_URL/run" \
  -H "Content-Type: application/json" \
  -d "{\"template\": $(cat $TEMPLATE_FILE)}")

echo ""
echo -e "${BLUE}=== MiniBob Response ===${NC}"
echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"

# Check if execution started
if echo "$RESPONSE" | jq -e '.executionId' > /dev/null 2>&1; then
    EXECUTION_ID=$(echo "$RESPONSE" | jq -r '.executionId')
    echo ""
    echo -e "${GREEN}✓ Activity submitted successfully!${NC}"
    echo -e "${GREEN}  Execution ID: $EXECUTION_ID${NC}"
    echo ""
    echo -e "${BLUE}Monitor progress:${NC}"
    echo "  kubectl logs -n activity-system -f minibob-minibob-cluster-69fc5998d-n9r5w"
    echo ""
    echo -e "${BLUE}When complete, verify changes:${NC}"
    echo "  1. Check MiniBob workspace for modified files"
    echo "  2. Review git commits created by MiniBob"
    echo "  3. Deploy via: cd repos/activity-dashboard && helmfile apply"
else
    echo ""
    echo -e "${YELLOW}⚠ Activity may have failed to start - check response above${NC}"
fi

# Cleanup note
echo ""
echo -e "${YELLOW}Port-forward running (PID: $PF_PID)${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop, or kill manually: kill $PF_PID${NC}"

# Keep port-forward alive
wait $PF_PID
