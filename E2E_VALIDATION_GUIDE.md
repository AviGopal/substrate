# End-to-End Data Flow Validation Guide
**metabob-cli → metabob-rpc-api → surrealdb → metabob-rpc-api → metabob-dashboard**

## Test Account Credentials
```
Dashboard URL: http://app.metabob.local
Email: demo@example.com
Password: Demo123!SecurePassword
User ID: 65268594-97a6-45e1-b0e9-a25e53f338e3
Org ID: 80a7904b-77a1-4a25-b053-1a82127eafed
```

## Step 1: Verify Dashboard Access & Login ✅

### 1.1 Check Dashboard Pod Status
```bash
kubectl get pods -n metabob -l app=metabob-dashboard
# Expected: 1/1 Running
```

### 1.2 Verify Istio Routing
```bash
curl -I http://app.metabob.local
# Expected: HTTP/1.1 200 OK
```

### 1.3 Login via Dashboard UI
1. Open browser: http://app.metabob.local
2. Click "Login" or navigate to login page
3. Enter:
   - Email: `demo@example.com`
   - Password: `Demo123!SecurePassword`
4. Click "Login"
5. ✅ Should redirect to dashboard home page

### 1.4 Verify Login API Call (Command Line)
```bash
curl -X POST http://api.metabob.local/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","password":"Demo123!SecurePassword"}' | jq '.'
# Expected: JSON response with token, user, organizations
```

---

## Step 2: Create API Key via Dashboard UI ✅

### 2.1 Navigate to Settings
1. In dashboard, find "Settings" or user menu
2. Navigate to "API Keys" section

### 2.2 Create New API Key
1. Click "Create API Key" or similar button
2. Enter name: `CLI Test Key`
3. Select scopes: `read`, `write` (or default)
4. Click "Create" or "Generate"
5. ✅ Copy the generated API key (starts with `mb_`)
6. **IMPORTANT**: Save the key - it won't be shown again!

### 2.3 Verify via API (Command Line)
```bash
# Get auth token first
TOKEN=$(curl -s -X POST http://api.metabob.local/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","password":"Demo123!SecurePassword"}' | jq -r '.token')

# List API keys
curl -X GET "http://api.metabob.local/auth/orgs/80a7904b-77a1-4a25-b053-1a82127eafed/api-keys" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
# Expected: JSON array with your newly created API key
```

---

## Step 3: Configure metabob-cli with API Key ✅

### 3.1 Find or Create Test Project
```bash
# Option 1: Use existing test project
cd test-cli-project

# Option 2: Create new test project
mkdir -p test-metabob-cli-e2e
cd test-metabob-cli-e2e
git init
echo "print('Hello World')" > test.py
```

### 3.2 Initialize metabob-cli Configuration
```bash
# Create .metabob directory if it doesn't exist
mkdir -p .metabob

# Create config.json with your API key
cat > .metabob/config.json <<EOF
{
  "api_key": "YOUR_API_KEY_HERE",
  "api_url": "http://api.metabob.local",
  "org_id": "80a7904b-77a1-4a25-b053-1a82127eafed"
}
EOF

# Verify config
cat .metabob/config.json | jq '.'
```

**Replace `YOUR_API_KEY_HERE` with the actual API key from Step 2!**

---

## Step 4: Run CLI Analysis & Verify Data Flow ✅

### 4.1 Run metabob-cli Analyze
```bash
# Navigate to your test project
cd test-metabob-cli-e2e

# Run analysis (replace with actual metabob-cli command)
metabob-cli analyze --path . --verbose

# Or if using local metabob-cli:
python -m metabob_cli analyze --path . --verbose
```

### 4.2 Verify RPC-API Received Request
```bash
# Check RPC-API logs for authentication
kubectl logs -n metabob -l app=metabob-rpc-api --tail=50 | grep -i "api.key\|analysis\|session"
# Expected: Logs showing API key authentication and analysis request
```

### 4.3 Expected CLI Output
- ✅ Authentication successful
- ✅ Project registered or found
- ✅ Analysis started
- ✅ Results returned
- ❌ No authentication errors
- ❌ No API key errors

---

## Step 5: Verify Data in SurrealDB (Read-Only) ✅

### 5.1 Check API Key Usage
```bash
# Query last_used_at for your API key
echo "SELECT api_key, last_used_at, name FROM api_keys WHERE org_id = '80a7904b-77a1-4a25-b053-1a82127eafed' ORDER BY last_used_at DESC LIMIT 3;" | \
kubectl exec -i -n metabob $(kubectl get pods -n metabob -l app=surrealdb --no-headers | head -1 | awk '{print $1}') -- \
/surreal sql --endpoint http://localhost:8000 --namespace metabob --database metabob --username root --password changeme --pretty
# Expected: Your API key with updated last_used_at timestamp
```

### 5.2 Check Session/Activity Records
```bash
# Query activity executions for your org
echo "SELECT execution_id, template_id, org_id, created_at FROM activity_executions WHERE org_id = '80a7904b-77a1-4a25-b053-1a82127eafed' ORDER BY created_at DESC LIMIT 5;" | \
kubectl exec -i -n metabob $(kubectl get pods -n metabob -l app=surrealdb --no-headers | head -1 | awk '{print $1}') -- \
/surreal sql --endpoint http://localhost:8000 --namespace metabob --database metabob --username root --password changeme --pretty
# Expected: Records of your CLI analysis sessions
```

### 5.3 Check Projects
```bash
# Query projects for your org
echo "SELECT project_id, name, created_at FROM projects WHERE org_id = '80a7904b-77a1-4a25-b053-1a82127eafed' ORDER BY created_at DESC LIMIT 3;" | \
kubectl exec -i -n metabob $(kubectl get pods -n metabob -l app=surrealdb --no-headers | head -1 | awk '{print $1}') -- \
/surreal sql --endpoint http://localhost:8000 --namespace metabob --database metabob --username root --password changeme --pretty
# Expected: Your test project record
```

---

## Step 6: Verify Usage Data in Dashboard ✅

### 6.1 Navigate to API Keys in Dashboard
1. Refresh dashboard page (F5)
2. Go to Settings → API Keys
3. ✅ Verify "Last Used" timestamp updated for your key
4. ✅ Check if usage stats are displayed (sessions count, etc.)

### 6.2 Check Analytics/Activity Page
1. Navigate to "Activity" or "Analytics" section (if exists)
2. ✅ Verify your recent analysis appears in the timeline
3. ✅ Check that activity is attributed to your API key
4. ✅ Verify timestamps match when you ran the CLI

### 6.3 Verify via Analytics API
```bash
# Get recent activity for your organization
curl -X GET "http://api.metabob.local/auth/orgs/80a7904b-77a1-4a25-b053-1a82127eafed/activity?limit=10" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
# Expected: JSON with recent activities including your CLI analysis
```

---

## Success Criteria ✅

### End-to-End Data Flow Verified When:
1. ✅ Dashboard login works with credentials
2. ✅ API key creation via dashboard succeeds
3. ✅ API key appears in list and can be retrieved via API
4. ✅ metabob-cli authenticates successfully with API key
5. ✅ CLI analysis request reaches RPC-API
6. ✅ Data persists in SurrealDB (projects, sessions, activities)
7. ✅ API key `last_used_at` updates in database
8. ✅ Dashboard displays updated usage data
9. ✅ Activity timeline shows CLI-triggered analysis
10. ✅ All data flows through RPC-API (no direct DB writes)

### Architecture Compliance ✅
- ✅ CLI → RPC-API: Authentication via API key
- ✅ RPC-API → SurrealDB: Data persistence
- ✅ SurrealDB → RPC-API: Data retrieval
- ✅ RPC-API → Dashboard: Usage data display
- ✅ No direct database access from CLI or Dashboard
- ✅ All communication through defined API endpoints

---

## Troubleshooting

### Issue: Dashboard Won't Load
```bash
# Check dashboard pod
kubectl get pods -n metabob -l app=metabob-dashboard
kubectl logs -n metabob -l app=metabob-dashboard --tail=50

# Check Istio routing
kubectl get virtualservice -n metabob test-dashboard -o yaml
```

### Issue: API Key Authentication Fails
```bash
# Check RPC-API logs
kubectl logs -n metabob -l app=metabob-rpc-api --tail=100 | grep -i "auth\|api.key"

# Verify API key in database
echo "SELECT * FROM api_keys WHERE api_key = 'YOUR_API_KEY' LIMIT 1;" | \
kubectl exec -i -n metabob $(kubectl get pods -n metabob -l app=surrealdb --no-headers | head -1 | awk '{print $1}') -- \
/surreal sql --endpoint http://localhost:8000 --namespace metabob --database metabob --username root --password changeme
```

### Issue: Data Not Appearing in Dashboard
```bash
# Check if data exists in SurrealDB
echo "SELECT COUNT() FROM activity_executions WHERE org_id = '80a7904b-77a1-4a25-b053-1a82127eafed' GROUP ALL;" | \
kubectl exec -i -n metabob $(kubectl get pods -n metabob -l app=surrealdb --no-headers | head -1 | awk '{print $1}') -- \
/surreal sql --endpoint http://localhost:8000 --namespace metabob --database metabob --username root --password changeme --pretty

# Check RPC-API activity endpoint
TOKEN=$(curl -s -X POST http://api.metabob.local/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","password":"Demo123!SecurePassword"}' | jq -r '.token')

curl "http://api.metabob.local/auth/orgs/80a7904b-77a1-4a25-b053-1a82127eafed/activity?limit=5" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

---

## Components Involved

| Component | Role | Access Method |
|-----------|------|---------------|
| **metabob-dashboard** | UI for viewing usage data | http://app.metabob.local |
| **metabob-rpc-api** | API backend for all operations | http://api.metabob.local |
| **surrealdb** | Primary data store | Internal (via RPC-API only) |
| **istio-gateway** | Routing & ingress | app.metabob.local, api.metabob.local |
| **metabob-cli** | Command-line analysis tool | Local execution |

---

## Quick Validation Commands

```bash
# 1. Check all services are running
kubectl get pods -n metabob | grep -E "dashboard|rpc-api|surrealdb"

# 2. Test login API
curl -X POST http://api.metabob.local/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","password":"Demo123!SecurePassword"}' | jq '.user.user_id'

# 3. List API keys
TOKEN=$(curl -s -X POST http://api.metabob.local/auth/login -H "Content-Type: application/json" -d '{"email":"demo@example.com","password":"Demo123!SecurePassword"}' | jq -r '.token')
curl "http://api.metabob.local/auth/orgs/80a7904b-77a1-4a25-b053-1a82127eafed/api-keys" -H "Authorization: Bearer $TOKEN" | jq '.api_keys | length'

# 4. Check SurrealDB connectivity
echo "INFO FOR DB;" | kubectl exec -i -n metabob $(kubectl get pods -n metabob -l app=surrealdb --no-headers | head -1 | awk '{print $1}') -- \
/surreal sql --endpoint http://localhost:8000 --namespace metabob --database metabob --username root --password changeme --pretty | grep -i "metabob"
```
