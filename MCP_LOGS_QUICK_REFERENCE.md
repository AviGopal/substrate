# MCP Communication Logs - Quick Reference Card

## 📌 What to Expect in rpc-api Logs

### Your Original Logs (Explained)
```
INFO:     10.1.1.24:47986 - "POST /v2/session HTTP/1.1" 404 Not Found    ← Old endpoint (ignore)
INFO:     10.1.1.24:47986 - "POST /session HTTP/1.1" 200 OK              ← ✅ Session created
INFO:     10.1.1.24:47994 - "GET /session HTTP/1.1" 200 OK               ← ✅ Session validated  
INFO:     10.1.0.1:59766 - "GET / HTTP/1.1" 200 OK                       ← Health check (k8s)
```

---

## 🎯 Key Log Patterns

### 1. MCP Connection Established
```
INFO: POST /session HTTP/1.1 200 OK
```
**Meaning:** metabob-cli MCP connected, session token created

### 2. MCP Tool Called
```
INFO: GET /v2/activities/templates HTTP/1.1 200 OK
```
**Meaning:** `search_activities()` tool was called

### 3. Activity Execution Started
```
INFO: POST /v2/submit HTTP/1.1 200 OK
INFO: WebSocket /ws/job?token=... [accepted]
INFO: routes WebSocket connected for session <id>
```
**Meaning:** Activity template execution in progress

### 4. Background Noise (Ignore)
```
INFO: GET / HTTP/1.1 200 OK          ← k8s health checks
INFO: GET /metrics HTTP/1.1 200 OK   ← Prometheus scraping
```

---

## 🔍 IP Address Guide

| IP          | Source           | What It Means                    |
|-------------|------------------|----------------------------------|
| 10.1.1.24   | External         | Your metabob-cli MCP calls       |
| 10.1.0.1    | Kubernetes       | Internal health checks           |
| 127.0.0.1   | Localhost        | Metrics, local requests          |

---

## 📋 Complete Flow Cheat Sheet

```
User Action              →  HTTP Call                    →  Log Entry
─────────────────────────────────────────────────────────────────────────
Start MCP session        →  POST /session               →  200 OK
Call search_activities() →  GET /v2/activities/templates →  200 OK
Execute activity         →  POST /v2/submit             →  200 OK + WebSocket
Check status             →  GET /session                →  200 OK
```

---

## 🚀 Quick Test Commands

### Watch Live Logs
```bash
kubectl logs -n metabob -f metabob-rpc-api-76bff4cbcf-wf8lf | grep -E '(POST|GET|WebSocket)'
```

### Test API Manually
```bash
# Create session
curl -X POST http://api.metabob.local:8080/session

# Query templates (with token)
curl -X GET http://api.metabob.local:8080/v2/activities/templates \
  -H "Authorization: Bearer <token>"
```

### Set Environment for metabob-cli
```bash
export METABOB_RPC_API_URL="http://api.metabob.local:8080"
```

---

## ✅ Validation Checklist

When metabob-cli MCP connects to your rpc-api, you should see:

- [ ] `POST /session` → 200 OK (authentication)
- [ ] `GET /v2/activities/templates` → 200 OK (template query)
- [ ] Source IP: `10.1.1.24` (external, from your machine)
- [ ] Bearer token in Authorization header
- [ ] WebSocket connection (if executing activities)

---

## 🎬 What We Demonstrated

✅ Complete communication flow documented  
✅ All log patterns identified and explained  
✅ HTTP/WebSocket interaction mapped  
✅ Authentication flow verified  
✅ Test scripts created for future use  

**Result:** You now know exactly what to expect in rpc-api logs when metabob-cli MCP tools communicate with your k8s deployment!

---

## 📚 Additional Resources

- Full guide: `MCP_COMMUNICATION_GUIDE.md`
- Summary: `COMMUNICATION_FLOW_SUMMARY.md`
- Test scripts: `test-mcp-communication-flow.sh`, `test-mcp-live-communication.sh`
