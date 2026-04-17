# Validation Apparatus Quick Start

## Setup

1. **Install dependencies** (if not already installed):
   ```bash
   cd /home/avi/documents/work/exp-repo/metabob-devbob
   bun install
   ```

2. **Set environment variables**:
   ```bash
   export VALIDATION_ENDPOINT=https://activity.metabob.com
   export VALIDATION_API_KEY=your-metabob-api-key
   ```

## Running Validation

### Run all scenarios
```bash
cd validation
bun run run-validation.ts
```

### Run specific sequence
```bash
bun run run-validation.ts --sequence=02-impulse-resolution
```

### Output
```
🧪 Activity System Validation
📡 Backend: https://activity.metabob.com
🔑 API Key: mbk_1234...

📋 Running validation: 02-impulse-resolution.yaml
  Testing: Relevance filtering applies thresholds correctly
    ✓ Relevance filtering applies thresholds correctly
  Testing: Always-load threshold bypasses filtering
    ✓ Always-load threshold bypasses filtering
  Testing: Irrelevance score causes skip
    ✓ Irrelevance score causes skip

📊 Summary:
  ✓ 02-impulse-resolution: 3/3 passed

🎯 Overall: 3/3 scenarios passed
📄 Results saved to: results/validation-2026-04-16.json
```

## Adding New Scenarios

1. **Read the sequence documentation**:
   ```bash
   cat docs/architecture/sequences/01-activity-selection.md
   ```

2. **Create scenario YAML** in `scenarios/`:
   ```yaml
   scenarios:
     - name: "Test name"
       doc_reference: "lines X-Y"
       assertion: "What the docs claim"
       setup:
         # Initial state
       action:
         type: "action_type"
         # Parameters
       expected:
         # Expected outcome
       validation:
         - "How to verify"
   ```

3. **Implement executor** in `run-validation.ts`:
   ```typescript
   case 'action_type':
     actual = await executeAction(scenario.action, setup);
     break;
   ```

4. **Run and iterate**:
   ```bash
   bun run run-validation.ts --sequence=your-sequence
   ```

## Validation Results

Results are saved in `results/` with timestamps:
```
results/
├── validation-2026-04-16.json
└── validation-2026-04-17.json
```

Each result file contains:
```json
{
  "sequence": "02-impulse-resolution",
  "total_scenarios": 10,
  "passed": 8,
  "failed": 2,
  "results": [
    {
      "scenario": "Relevance filtering applies thresholds correctly",
      "passed": true,
      "errors": [],
      "actual": { "loaded": [...], "skipped": [...] },
      "expected": { "loaded": [...], "skipped": [...] },
      "timestamp": "2026-04-16T19:50:00.000Z"
    }
  ]
}
```

## Integration with CI/CD

Add to `.github/workflows/validate-sequences.yml`:
```yaml
name: Validate Architecture Sequences

on:
  push:
    branches: [dev, main]
    paths:
      - 'docs/architecture/sequences/**'
      - 'repos/metabob-activity-api/**'
      - 'repos/minibob/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - name: Run validation
        env:
          VALIDATION_ENDPOINT: https://activity.metabob.com
          VALIDATION_API_KEY: ${{ secrets.METABOB_API_KEY }}
        run: |
          cd validation
          bun run run-validation.ts
```

## Troubleshooting

### Backend not responding
```bash
curl https://activity.metabob.com/health
```

### API key invalid
```bash
curl -H "Authorization: ApiKey $VALIDATION_API_KEY" \
  https://activity.metabob.com/v2/activities/templates
```

### Scenario fails unexpectedly
1. Check backend logs
2. Verify setup data is correct
3. Add debug logging to executor
4. Run scenario in isolation

## Next Steps

1. **Create more scenarios** for other sequences:
   - `01-activity-selection.yaml`
   - `03-resolver-processing.yaml`
   - `04-improvisation-trailblazing.yaml`
   - `05-hooks-behavior-injection.yaml`

2. **Implement missing executors**:
   - `resolve_impulses` - Test resolver dispatch chain
   - `load_impulse` - Test budget enforcement
   - `format_for_context` - Test metadata-first formatting

3. **Generate compliance reports**:
   ```bash
   bun run generate-report.ts
   ```

4. **Run validation daily** to catch regressions
