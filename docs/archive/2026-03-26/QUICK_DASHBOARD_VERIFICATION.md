# Quick Dashboard Verification Guide

## Step 1: Open Dashboard
```bash
# URL to open in browser
http://app.metabob.local
```

## Step 2: Login
- Use GitHub OAuth or email/password
- Should redirect to dashboard after successful login

## Step 3: Verify Each Panel

### ✅ Activity History Panel
**Expected:** 1 activity execution
- [ ] Panel loads without errors
- [ ] Shows activity with timestamp
- [ ] Can view details

### ✅ Templates Panel  
**Expected:** 3 templates
- [ ] Shows template list
- [ ] Displays success rates
- [ ] Shows execution counts

### ✅ Usage Statistics
- [ ] Total executions displayed
- [ ] Metrics visible
- [ ] No errors

## Step 4: Test Data Flow

### Create test activity:
```bash
kubectl exec -n metabob deployment/metabob-rpc-api -- \
  metabob-cli activity create \
    --name "Dashboard Test" \
    --description "E2E validation" \
    --category "test"
```

### Verify in dashboard:
- [ ] Refresh dashboard
- [ ] New activity appears
- [ ] Count increments (1 → 2)
- [ ] Timestamp is current

## Step 5: Validate Filtering
- [ ] Only shows data for your API key
- [ ] No cross-user data visible
- [ ] Filtering persists on refresh

## Expected Results
✅ All panels load without errors
✅ Data matches backend (1 execution, 3 templates)  
✅ New activities appear after refresh
✅ API key filtering works correctly

## If Issues Found
1. Check browser console for errors
2. Check network tab for failed API calls
3. Verify authentication token is present
4. Check `/validation-results/dashboard-data-*.log` for backend state

