# DevBob & Metabob Setup - Quick Start Guide

## 🚀 Quick Start (2 minutes)

### 1. Verify Everything is Running
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
./FINAL_VERIFICATION.sh
```

### 2. Test from Host Machine
```bash
# Check metabob status
opencode metabob status

# Test API connectivity
curl http://localhost:8080/
# Response: {"version":"0.16.0"}
```

### 3. You're Ready!
All containers are healthy and configured. You can now:
- Use metabob tools from the OpenCode CLI
- Delegate tasks to devbob containers
- Run activity templates with metabob integration

---

## 📚 Detailed Documentation

See these files for more information:

1. **DEVBOB_SETUP_COMPLETE.md**
   - Complete setup details
   - Configuration files explanation
   - Network architecture
   - Usage examples

2. **SETUP_SUMMARY.txt**
   - Quick reference
   - Running containers list
   - Available metabob tools
   - Known issues & workarounds

3. **VERIFICATION_CHECKLIST.md**
   - Complete checklist
   - All configuration items
   - Test commands

---

## 💡 Common Commands

### From Host Machine
```bash
# Navigate to project
cd /home/avi/documents/work/exp-repo/metabob-devbob

# Test metabob connectivity
opencode metabob status

# List available metabob tools
test_metabob_mcp

# Delegate work to container
opencode acp delegate docker://devbob-opencode "Your task description"
```

### From Container
```bash
# Access the container
docker exec -it devbob-opencode bash

# Check opencode
opencode --version

# Check metabob
opencode metabob status

# Exit container
exit
```

### Docker Operations
```bash
# View logs
docker logs devbob-opencode
docker logs api-server-dev

# View running containers
docker ps | grep -E "(devbob|api-server|metabob)"

# View network
docker network inspect metabob-devbob_default
```

---

## ✅ What's Configured

### Containers (All Running ✅)
- **devbob-opencode** (Port 3004) - Development agent with ACP server
- **api-server-dev** (Port 8080) - Metabob RPC API
- **metabob-worker** - Background task processor
- **metabob-redis** (Port 6379) - Cache layer
- **metabob-surreal** (Port 8000) - Database

### Networks (All Connected ✅)
- **devbob_default** - Container orchestration network
- **metabob-devbob_default** - Metabob services network

### Configuration (All Created ✅)
- **opencode.json** - Host machine config
- **.metabob/config.json** - Metabob CLI config
- **configs/opencode.devbob.json** - Container config

### Tools Available (11 Tools ✅)
- search_codebase_issues
- mark_problem_complete
- annotate_component
- analyze_change_impact
- list_file_components
- assess_deletion_safety
- suggest_related_changes
- generate_implementation_template
- ... and 3 more

---

## 🔧 If Something Doesn't Work

### Issue: "Connection refused" when running opencode commands

**Check 1:** Is the API server running?
```bash
docker ps | grep api-server-dev
```

**Check 2:** Is the port open?
```bash
curl http://localhost:8080/
```

### Issue: Container can't reach API

**Solution:** Reconnect to network
```bash
docker network connect metabob-devbob_default devbob-opencode
```

### Issue: "Connection timed out"

**Check:** API server health
```bash
docker logs api-server-dev
```

---

## 📊 Architecture at a Glance

```
Host Machine
├─ opencode CLI
│  └─ http://localhost:8080
│
Docker Network (metabob-devbob_default)
├─ devbob-opencode (Port 3004)
│  └─ http://api-server-dev:8080 (internal)
│
└─ Metabob Services
   ├─ api-server-dev:8080
   ├─ metabob-worker
   ├─ metabob-redis:6379
   └─ metabob-surreal:8000
```

---

## 🎯 Next Steps

1. ✅ Verify setup with `./FINAL_VERIFICATION.sh`
2. ✅ Test with `opencode metabob status`
3. ✅ Ready to delegate tasks and use metabob tools

---

**Setup Date:** 2026-01-31  
**Status:** ✅ Complete and Verified  
**All Containers:** ✅ Healthy  
**API Connectivity:** ✅ Working  

For detailed information, see DEVBOB_SETUP_COMPLETE.md
