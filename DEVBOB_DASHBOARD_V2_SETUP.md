# DevBob Container & Cloud Dashboard V2 API Integration

## Investigation Summary

Date: February 8, 2026

### Issues Found and Fixed

#### 1. DevBob Container Failing ✅ FIXED
**Problem:** Container was restarting repeatedly with config validation error
```
Error: Config file at /tmp/opencode-config-*.json is invalid
↳ Unrecognized key: "$"
```

**Root Cause:** Invalid schema key in config file: `"$$schema"` instead of `"$schema"`

**Fix:** Removed the invalid schema key from `/config/opencode.devbob.json`

**Status:** ✅ Container now running successfully
- ACP server: http://0.0.0.0:3004
- CLI Dashboard: http://0.0.0.0:3100

#### 2. Dashboard Nginx Configuration Missing ✅ FIXED
**Problem:** No API proxy configuration for dashboard to reach backend

**Root Cause:** 
- Dashboard `nginx.conf` only served static files
- No proxy_pass configuration for `/api` or `/v2` endpoints
- Ingress container using wrong nginx config

**Fix:** Created `/repos/metabob-dashboard/nginx-ingress.conf` with proper routing:
- `/api/*` → metabob-rpc-api backend
- `/v2/*` → v2 API endpoints (activities, session)
- `/auth/*` → auth endpoints
- `/ws` → WebSocket support
- `/*` → React dashboard (with client-side routing)

**Status:** ✅ Configuration ready, ingress service updated in docker-compose

---

## Architecture Overview

### Current Setup

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloud Dashboard Stack                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────┐         ┌──────────────┐                    │
│  │  Client    │ :8888   │   Ingress    │                    │
│  │  Browser   ├────────►│    Nginx     │                    │
│  └────────────┘         └──────┬───────┘                    │
│                                 │                             │
│                    ┌────────────┼────────────┐               │
│                    │            │            │               │
│                    ▼            ▼            ▼               │
│           ┌─────────────┐  ┌─────────┐  ┌─────────┐        │
│           │  Dashboard  │  │   API   │  │  Auth   │        │
│           │   :3000     │  │ /api/*  │  │ /auth/* │        │
│           │             │  │ /v2/*   │  │         │        │
│           └─────────────┘  └────┬────┘  └────┬────┘        │
│                                 │            │              │
│                                 ▼            ▼              │
│                        ┌──────────────────────┐             │
│                        │  metabob-rpc-api    │             │
│                        │      :8080          │             │
│                        │   (v0.16.0)         │             │
│                        └─────────┬───────────┘             │
│                                  │                          │
│                         ┌────────┼────────┐                │
│                         ▼        ▼        ▼                │
│                    ┌──────┐ ┌──────┐ ┌──────┐             │
│                    │Redis │ │Surreal│ │Celery│             │
│                    │:6379 │ │:8000 │ │Worker│             │
│                    └──────┘ └──────┘ └──────┘             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      DevBob Container                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────────────────────────────┐                 │
│  │  devbob-opencode                       │                 │
│  │  ├─ OpenCode ACP (:3004)               │                 │
│  │  ├─ metabob-cli Dashboard (:3100)      │                 │
│  │  └─ Config: /config/opencode.devbob.json                 │
│  │     ├─ Metabob API: host.docker.internal:8080            │
│  │     └─ API Key: mb_TfdRc58V...         │                 │
│  └────────────────────────────────────────┘                 │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## V2 API Endpoints Status

### API Server: http://localhost:8080

#### V2 Session Endpoints ✅ WORKING
```bash
# Create session
POST /v2/session
Headers: X-API-Key: <api_key>
Body: {"project_id": "default"}
Response: Proto Session message

# Get session
GET /v2/session
Headers: Authorization: Bearer <token>
Response: Proto Session message

# Delete session
DELETE /v2/session
Headers: Authorization: Bearer <token>
```

**Verified:**
```bash
curl -X POST http://localhost:8080/v2/session \
  -H "X-API-Key: mb_TfdRc58VlhLzio5jebyESJnTplTiDHlAiQtPB0JdOrQ" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "default"}'

# Returns: session_id, session_token, org_id, project_id
```

#### V2 Activities Endpoints ✅ WORKING
```bash
# List templates
GET /v2/activities/templates
Headers: Authorization: Bearer <token>
Query: ?query=&category=&limit=20&offset=0
Response: {templates: [...], total: N}

# Get template
GET /v2/activities/templates/{template_id}
Headers: Authorization: Bearer <token>
Response: Proto ActivityVariant message

# Create template
POST /v2/activities/templates
Headers: Authorization: Bearer <token>
Body: TemplateCreateRequest

# Update template
PUT /v2/activities/templates/{template_id}
Headers: Authorization: Bearer <token>
Body: {updates}

# Delete template
DELETE /v2/activities/templates/{template_id}
Headers: Authorization: Bearer <token>
```

**Verified:**
```bash
curl http://localhost:8080/v2/activities/templates \
  -H "Authorization: Bearer <token>"

# Returns: 8 templates
```

#### Additional V2 Endpoints (Available)
- `POST /v2/activities/mutate/derive` - Derive new template from parent
- `GET /v2/activities/mutate/lineage/{template_id}` - Get template lineage
- `POST /v2/activities/record/start` - Record execution start
- `POST /v2/activities/record/step` - Record execution step
- `POST /v2/activities/record/complete` - Record execution completion

---

## Dashboard Configuration

### Environment Variables (`.env`)
```bash
REACT_APP_API_BASE_URL='/api'
REACT_APP_AUTH_BASE_URL='/auth'
REACT_APP_OPENREPLAY_PROJECT_TOKEN='jagYenyC6JmWn1JM6WT4'
REACT_APP_MIXPANEL_TOKEN_DEV='16aa5aedb90009c2d811a882b659dc62'
REACT_APP_MIXPANEL_TOKEN='9b75df0453c34711bdbc54f678dee2b6'
```

### API Client Configuration
**File:** `src/common/MetabobRestApi.js`

**Base URL Logic:**
- Development: `http://localhost:8080`
- Production Cloud: `/api` (proxied via nginx ingress)
- Production Local: `/api` (direct MCP server)

**Authentication:**
- Bearer token in `Authorization` header
- Token stored in Redux state (`USER.token`)
- Auto-retry with session creation on 401/404

---

## Nginx Routing Configuration

### Ingress Nginx (`nginx-ingress.conf`)
```nginx
# API endpoints
location /api/ {
    proxy_pass http://server:80/;
    # Headers, timeouts configured
}

# V2 API endpoints
location /v2/ {
    proxy_pass http://server:80/v2/;
    # Headers, timeouts configured
}

# Auth endpoints
location /auth/ {
    proxy_pass http://server:80/auth/;
}

# WebSocket support
location /ws {
    proxy_pass http://server:80/ws;
    # WebSocket upgrade headers
}

# Dashboard frontend
location / {
    proxy_pass http://dashboard:80/;
    # React Router support
}
```

---

## Starting the Dashboard Stack

### Option 1: Full Stack (Recommended for Dashboard Testing)
```bash
cd repos/metabob-dashboard
docker-compose up -d

# Access points:
# - Dashboard: http://localhost:8888
# - Direct API: http://localhost:8080
# - Dashboard (direct): http://localhost:3000
```

**Services Started:**
1. `redis` - Session/cache storage
2. `server` - metabob-rpc-api (v0.12.0 - update to 0.16.0 recommended)
3. `worker` - Celery worker for async tasks
4. `dashboard` - React frontend
5. `ingress` - Nginx reverse proxy (port 8888)

### Option 2: Use Existing API Server
If you already have metabob-rpc-api running (port 8080), you can:

1. Update `nginx-ingress.conf` upstream:
```nginx
upstream api_backend {
    server host.docker.internal:8080;
}
```

2. Start only dashboard + ingress:
```bash
docker-compose up -d dashboard ingress
```

---

## Testing the Integration

### 1. Health Check
```bash
curl http://localhost:8080/health
# Expected: {"status": "ok", "version": "0.16.0"}
```

### 2. Create V2 Session
```bash
curl -X POST http://localhost:8080/v2/session \
  -H "X-API-Key: mb_TfdRc58VlhLzio5jebyESJnTplTiDHlAiQtPB0JdOrQ" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "default"}' | jq .

# Save the session_token from metadata.session_token
```

### 3. List Activity Templates
```bash
TOKEN="<session_token_from_step_2>"

curl http://localhost:8080/v2/activities/templates \
  -H "Authorization: Bearer $TOKEN" | jq .

# Expected: {templates: [...], total: 8}
```

### 4. Test via Ingress (when running)
```bash
curl http://localhost:8888/v2/session \
  -X POST \
  -H "X-API-Key: mb_TfdRc58VlhLzio5jebyESJnTplTiDHlAiQtPB0JdOrQ" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "default"}' | jq .
```

---

## Current Status Summary

### ✅ Working
- [x] DevBob container running successfully
- [x] metabob-rpc-api v2 endpoints operational
- [x] V2 Session API (create, get, delete)
- [x] V2 Activities API (list, get, create, update, delete)
- [x] Nginx ingress configuration created
- [x] Docker compose updated with correct config

### 🔧 Ready to Deploy
- [ ] Dashboard docker-compose stack (not currently running)
- [ ] Ingress nginx container (not started)
- [ ] Dashboard web interface (not accessible)

### 📋 Next Steps

#### To Start Dashboard:
```bash
cd repos/metabob-dashboard
docker-compose up -d
```

#### To Verify Dashboard → API Connection:
1. Access dashboard: http://localhost:8888
2. Check browser network tab for API calls
3. Verify `/api/session` or `/v2/session` calls succeed
4. Check Redux DevTools for session token storage

#### To Update API Version in Dashboard Stack:
Edit `repos/metabob-dashboard/docker-compose.yaml`:
```yaml
server:
  image: metabobapp/metabob-rpc-api:0.16.0  # Updated from 0.12.0
```

---

## DevBob Configuration

### Config File: `configs/opencode.devbob.json`
```json
{
  "share": "disabled",
  "model": "anthropic/claude-sonnet-4-5",
  "metabob": {
    "cli_path": "metabob-cli",
    "api_key": "mb_TfdRc58VlhLzio5jebyESJnTplTiDHlAiQtPB0JdOrQ",
    "base_url": "http://host.docker.internal:8080",
    "state_directory": ".metabob",
    "max_issues": 5,
    "min_severity": "MEDIUM"
  }
}
```

### Container Access Points
- ACP Server: http://localhost:3004
- CLI Dashboard: http://localhost:3100

---

## Troubleshooting

### DevBob Container Restarting
✅ **FIXED** - Config file had invalid schema key

If issues persist:
```bash
docker logs devbob-opencode --tail 50
```

### Dashboard Can't Reach API
Check ingress routing:
```bash
docker logs metabob-dashboard-ingress-1
```

Verify nginx config:
```bash
docker exec metabob-dashboard-ingress-1 cat /etc/nginx/conf.d/default.conf
```

### V2 API Returns 401
Verify API key exists:
```bash
cd repos/metabob-rpc-api
./admin-cli.sh apikey list
```

Create new API key if needed:
```bash
./admin-cli.sh apikey create --user-id <user_id> --name "Dashboard Key"
```

---

## References

- **V2 Session API:** `/repos/metabob-rpc-api/server/routes/v2_session.py`
- **V2 Activities API:** `/repos/metabob-rpc-api/server/routes/v2_activities.py`
- **Dashboard API Client:** `/repos/metabob-dashboard/src/common/MetabobRestApi.js`
- **DevBob Config:** `/configs/opencode.devbob.json`
- **Ingress Config:** `/repos/metabob-dashboard/nginx-ingress.conf`
