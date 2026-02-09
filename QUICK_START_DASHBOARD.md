# Quick Start: Cloud Dashboard with V2 API

## Current Status ✅

### DevBob Container
- **Status:** ✅ Running (healthy)
- **ACP Server:** http://localhost:3004
- **CLI Dashboard:** http://localhost:3100
- **API Connection:** http://host.docker.internal:8080
- **Config Fixed:** Invalid schema key removed

### metabob-rpc-api
- **Status:** ✅ Running
- **Version:** 0.16.0
- **Port:** 8080
- **V2 Endpoints:** ✅ Working
  - `/v2/session` - Session management
  - `/v2/activities/templates` - Activity templates (8 available)

### Cloud Dashboard
- **Status:** ⚠️ Not Running (ready to start)
- **Nginx Ingress:** ✅ Configured
- **Configuration:** ✅ Complete

---

## Start the Dashboard

```bash
cd repos/metabob-dashboard
docker-compose up -d
```

**Access Points:**
- Dashboard UI: http://localhost:8888
- Direct API: http://localhost:8080
- Dashboard (direct): http://localhost:3000

---

## Quick Test Commands

### 1. Health Check
```bash
curl http://localhost:8080/health
```

### 2. Create Session
```bash
curl -X POST http://localhost:8080/v2/session \
  -H "X-API-Key: mb_TfdRc58VlhLzio5jebyESJnTplTiDHlAiQtPB0JdOrQ" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "default"}' | jq .
```

### 3. List Activity Templates
```bash
# Use session_token from step 2
TOKEN="<your_session_token>"

curl http://localhost:8080/v2/activities/templates \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## What Was Fixed

1. **DevBob Config:** Removed invalid `"$$schema"` key
2. **Nginx Ingress:** Created proper proxy configuration
   - Routes `/api/*` to backend
   - Routes `/v2/*` to v2 API
   - Routes `/auth/*` to auth endpoints
   - Routes `/*` to dashboard
3. **Docker Compose:** Updated to use correct nginx config

---

## Files Modified

- ✅ `/configs/opencode.devbob.json` - Fixed schema key
- ✅ `/repos/metabob-dashboard/nginx-ingress.conf` - Created
- ✅ `/repos/metabob-dashboard/docker-compose.yaml` - Updated ingress config

---

## Next Steps

### To Use Dashboard:
1. Start dashboard stack: `cd repos/metabob-dashboard && docker-compose up -d`
2. Open browser: http://localhost:8888
3. Dashboard will auto-create session via `/v2/session` endpoint

### To Test V2 Integration:
1. DevBob already configured to use http://host.docker.internal:8080
2. V2 endpoints are working
3. Can test from within devbob container or host

---

## Architecture

```
Browser → Ingress Nginx (:8888) 
           ├─ /api/* → metabob-rpc-api (:8080)
           ├─ /v2/*  → metabob-rpc-api (:8080)
           └─ /*     → Dashboard (:3000)

DevBob Container
 ├─ OpenCode ACP (:3004)
 └─ metabob-cli Dashboard (:3100)
     └─ Uses: http://host.docker.internal:8080
```

See `DEVBOB_DASHBOARD_V2_SETUP.md` for complete documentation.
