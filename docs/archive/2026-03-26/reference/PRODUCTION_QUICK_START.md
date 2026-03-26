# Production Backend - Quick Start Guide

**One-page reference for daily use**

---

## 🚀 Start Your Session

### 1. Start Port-Forwards (Required First!)
```bash
# Start both port-forwards in background
kubectl port-forward -n metabob svc/metabob-rpc-api 9090:80 > /tmp/backend-pf.log 2>&1 &
kubectl port-forward -n metabob surrealdb-0 8888:8000 > /tmp/db-pf.log 2>&1 &

# Verify they're running
ps aux | grep "kubectl port-forward"
```

### 2. Test Connection
```bash
# Backend health check
curl http://localhost:9090/health
# Should return: {"status":"ok","timestamp":"...","version":"0.16.0"}

# Config check
cd repos/metabob-cli && metabob-cli config | grep base_url
# Should show: "base_url": "http://localhost:9090"
```

---

## 👥 User Credentials

### DevBob (Admin)
- **Email**: `devbob@metabob.com`
- **API Key**: `mb_ZFHainw-YiH7OTgJ4X9HBtXUz7YxtGxFQohkXOW3HB4`
- **Password**: `devbob123`

### Axel (Admin)
- **Email**: `axel@metabob.com`
- **API Key**: `mb_4PbBW5Z2Yx9dLXWyqqoQC_K6_wjkU8XvKnqAFrG1_mc`
- **Password**: `axel123`

### Organization
- **Name**: `metabob`
- **ID**: `org_metabob`
- **Project**: `default`

---

## 🔧 Common Admin Operations

### List Organizations
```bash
./get_production_api_key_via_admin_cli.sh orgs
```

### List Users in Organization
```bash
./get_production_api_key_via_admin_cli.sh users org_metabob
```

### List All API Keys
```bash
./get_production_api_key_via_admin_cli.sh list
```

### Create New User
```bash
# Interactive (will prompt for password)
./get_production_api_key_via_admin_cli.sh user-create <email> org_metabob admin
```

---

## 🔍 Troubleshooting

### "Connection refused" error
**Problem**: Port-forward not active  
**Fix**: Restart port-forwards (see "Start Port-Forwards" above)

### "Backend not responding"
```bash
# Check backend pod status
kubectl get pods -n metabob | grep metabob-rpc-api

# View recent logs
kubectl logs -n metabob -l app=metabob-rpc-api --tail=50
```

### Wrong API Key or URL
```bash
# Re-run migration (dry-run first to check)
python migrate_to_production_backend.py \
  --url "http://localhost:9090" \
  --api-key "mb_ZFHainw-YiH7OTgJ4X9HBtXUz7YxtGxFQohkXOW3HB4" \
  --dry-run

# Apply if looks good (remove --dry-run)
```

### Port Already in Use
```bash
# Kill all port-forwards
pkill -f "kubectl port-forward"

# Wait 2 seconds
sleep 2

# Restart with different port if needed
kubectl port-forward -n metabob svc/metabob-rpc-api 9091:80 &
# Then update config files to use 9091
```

---

## 📍 Important Paths

| File | Purpose |
|------|---------|
| `repos/metabob-cli/.metabob/config.json` | CLI configuration |
| `repos/metabob-opencode/.metabob/config.json` | OpenCode configuration |
| `repos/metabob-opencode/packages/opencode/opencode.json` | OpenCode MCP config |
| `get_production_api_key_via_admin_cli.sh` | Admin tool wrapper |
| `migrate_to_production_backend.py` | Config migration script |

---

## 🧪 Test Everything Works

```bash
# 1. Port-forwards active?
ps aux | grep "kubectl port-forward" | grep -v grep

# 2. Backend healthy?
curl http://localhost:9090/health

# 3. Config correct?
cd repos/metabob-cli && metabob-cli config | head -20

# 4. Can list orgs?
./get_production_api_key_via_admin_cli.sh orgs

# 5. Can list users?
./get_production_api_key_via_admin_cli.sh users org_metabob
```

**All 5 checks passed?** ✅ You're good to go!

---

## 📞 Quick Reference

| Task | Command |
|------|---------|
| Start work | `kubectl port-forward -n metabob svc/metabob-rpc-api 9090:80 &` |
| Check health | `curl http://localhost:9090/health` |
| List orgs | `./get_production_api_key_via_admin_cli.sh orgs` |
| List users | `./get_production_api_key_via_admin_cli.sh users org_metabob` |
| List keys | `./get_production_api_key_via_admin_cli.sh list` |
| View config | `cd repos/metabob-cli && metabob-cli config` |
| Backend logs | `kubectl logs -n metabob -l app=metabob-rpc-api --tail=50` |
| Stop all | `pkill -f "kubectl port-forward"` |

---

## 🎯 For OpenCode Sessions

Once port-forwards are active and config is correct, use these tools:

- `metabob_search_codebase_issues("query")`
- `metabob_get_priority_issues()`
- `metabob_annotate_component(...)`
- `metabob_mark_problem_complete(...)`
- `search_activities({ category: "feature" })`
- `activity({ templateId: "...", variables: {...} })`

All Metabob tools will now use the **production backend** automatically! 🚀

---

**Need more details?** See `PRODUCTION_MIGRATION_COMPLETE.md`
