# MiniBob Verification - Quick Execution Guide

## Prerequisites Check

```bash
# 1. Verify Kubernetes
kubectl config current-context
# Should show: docker-desktop

# 2. Check pods
kubectl get pods -n activity-system | grep minibob
kubectl get pods -n metabob | grep -E "(surrealdb|redis)"

# 3. Test connectivity
curl http://api.minibob.local/health
curl http://dashboard.minibob.local

# 4. Verify Bun
bun --version
```

## Setup

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/test-minibob-verification

# Run environment checks
bun run setup.ts

# Link minibob library (if not already linked)
cd ../repos/minibob && bun link
cd ../metabob-opencode && bun link @metabob/minibob
cd ../test-minibob-verification
```

## Run Tests

### All Tests
```bash
bun run test:all
```

### Individual Tests
```bash
# Test 1: Goal-seeking improvisation
bun run test:1

# Test 2: Activity selection
bun run test:2

# ... and so on
```

### Direct Execution
```bash
# Run setup first
bun run setup.ts

# Then run specific test
bun run tests/01-goal-seeking-improvisation.ts
```

## Monitor via Dashboard

```bash
# Open in browser
open http://dashboard.minibob.local

# Or port-forward if needed
kubectl port-forward -n metabob svc/metabob-dashboard 3000:80
open http://localhost:3000
```

## Troubleshooting

### Backend Not Accessible
```bash
# Check service
kubectl get svc -n activity-system metabob-activity-api

# Port forward
kubectl port-forward -n activity-system svc/metabob-activity-api 8081:8080

# Update env
export MINIBOB_BACKEND_URL="http://localhost:8081"
```

### Library Not Found
```bash
# Re-link
cd repos/minibob
bun link

cd repos/metabob-opencode
bun link @metabob/minibob

# Verify
bun run -e 'import("@metabob/minibob")'
```

### Tests Fail with Auth Error
```bash
# Set API key
export ANTHROPIC_API_KEY="your-key-here"

# Or create .env file
echo "ANTHROPIC_API_KEY=your-key" > .env
```

## Expected Results

```
✅ Test 1.1: Novel Feature Request - PASS
✅ Test 1.2: Improvisation After Failures - PASS
✅ Test 1.3: Improvisation Constraints - PASS

Total: 18 tests
Passed: 18 ✅
Failed: 0
Duration: ~2 minutes
```

## Next Steps

After tests pass:
1. Review dashboard visualizations
2. Analyze execution traces in `results/`
3. Document any failures or unexpected behavior
4. Implement remaining test cases (tests 2-6)
