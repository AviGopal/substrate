# Root Cause: Backend Container Running Old Docker Image

**Date**: February 11, 2026  
**Status**: 🔴 **CRITICAL - Backend Container Missing V2 Endpoints**

---

## TL;DR

The activity template system is **fully implemented in the codebase** but **not available in the running backend container** because:

1. Container uses pre-built image: `metabobapp/metabob-rpc-api:0.16.12`
2. V2 endpoints were added AFTER this image was built
3. Local source code has all features, but container doesn't

**Solution**: Mount local source code to container OR rebuild image.

---

## Evidence

### Container Doesn't Have V2 Code

```bash
$ docker exec api-server-dev ls /opt/app/server/routes/v2_activities.py
ls: cannot access '/opt/app/server/routes/v2_activities.py': No such file or directory
```

### But Local Code Has It

```bash
$ ls -la repos/metabob-rpc-api/server/routes/v2_activities.py
-rw-r--r-- 1 avi avi 48762 Feb 11 03:41 v2_activities.py
```

### Logs Show 404 Errors

```
INFO: "POST /v2/activities/templates HTTP/1.1" 404 Not Found
INFO: "GET /v2/activities/templates HTTP/1.1" 404 Not Found
```

---

## Quick Fix

### Option 1: Mount Source (Development Mode) ⭐

Edit `docker-compose.yaml`:

```yaml
metabob-rpc-api-server:
  volumes:
    # ADD THIS LINE:
    - ../repos/metabob-rpc-api/server:/opt/app/server:ro
    # Keep existing volumes...
```

Then restart:
```bash
docker-compose restart metabob-rpc-api-server
```

### Option 2: Rebuild Image

```bash
docker-compose build metabob-rpc-api-server
docker-compose up -d metabob-rpc-api-server
```

---

## What We Discovered

✅ **CLI is correct** - Uses `/v2/activities/templates`  
✅ **Backend code exists** - Full v2 API implemented  
✅ **Router registered** - Properly included in app.py  
✅ **Proto schema aligned** - ProtoTaskStep format correct  
✅ **Database schema ready** - Tables exist  
✅ **Configuration fixed** - Project IDs consistent  

❌ **Container missing code** - Old image doesn't have v2_activities.py

---

## Complete Documentation Created

1. **ACTIVITY_DATA_FLOW_MAPPING.md** - Full data flow trace
2. **BACKEND_CONFIGURATION_STATUS.md** - Config analysis  
3. **BACKEND_FIX_COMPLETE.md** - Config fixes applied

**All systems ready** - Just need to update the running container!

---

**Fix Time**: ~5 minutes  
**Next Step**: Mount source code and restart container
