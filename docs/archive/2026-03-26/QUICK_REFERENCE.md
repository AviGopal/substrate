# Activity System - Quick Reference

**TL;DR**: Three vessels, one cluster, observable development

---

## 🚀 Quick Start (3 Commands)

```bash
# 1. Setup repos and build images
./scripts/init-vessel-repos.sh && ./scripts/build-vessels.sh

# 2. Set API key
export ANTHROPIC_API_KEY="sk-ant-..."

# 3. Deploy
helmfile -f helm/helmfile-activity-dev.yaml -e dev apply
```

**Access**: http://dashboard.minibob.local

---

## 📦 Vessels

| Vessel | Purpose | Port | Domain |
|--------|---------|------|--------|
| **activity-dashboard** | Observability UI | 3000 | dashboard.minibob.local |
| **metabob-activity-api** | Learning loop API | 8080 | api.minibob.local |
| **minibob** | Autonomous agent | 8080 | - |

---

## 🔧 Common Commands

### **Deployment**
```bash
# Deploy all
helmfile -f helm/helmfile-activity-dev.yaml -e dev apply

# Destroy all
helmfile -f helm/helmfile-activity-dev.yaml -e dev destroy

# Update specific release
helmfile -f helm/helmfile-activity-dev.yaml -e dev -l component=ui apply
```

### **Monitoring**
```bash
# All pods
kubectl get pods -n activity-dev

# Logs (follow)
kubectl logs -n activity-dev -l app.kubernetes.io/name=activity-dashboard -f
kubectl logs -n activity-dev -l app.kubernetes.io/name=metabob-activity-api -f
kubectl logs -n activity-dev -l app.kubernetes.io/name=minibob -f

# Port-forward (bypass Ingress)
kubectl port-forward -n activity-dev svc/activity-dashboard 3000:3000
kubectl port-forward -n activity-dev svc/metabob-activity-api 8080:8080
```

### **Building**
```bash
# Build all
./scripts/build-vessels.sh

# Build one
./scripts/build-vessels.sh activity-dashboard

# Manual build
docker build -t activity-dashboard:dev repos/activity-dashboard
```

### **Git**
```bash
# Initialize repos
./scripts/init-vessel-repos.sh

# Push changes
cd repos/activity-dashboard
git add .
git commit -m "Update dashboard UI"
git push
```

---

## 🌐 URLs

| Service | URL | Purpose |
|---------|-----|---------|
| Dashboard | http://dashboard.minibob.local | Observability UI |
| API Health | http://api.minibob.local/health | API status |
| Templates | http://api.minibob.local/v2/activities/templates | List templates |
| Sessions | http://api.minibob.local/v2/session | Create session |

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `helm/helmfile-activity-dev.yaml` | Dev deployment config |
| `helm/environments/activity-dev.values.yaml` | Dev environment settings |
| `scripts/init-vessel-repos.sh` | Initialize git repos |
| `scripts/build-vessels.sh` | Build Docker images |
| `DEVELOPMENT_SETUP.md` | Full setup guide |
| `SETUP_SUMMARY.md` | What was built |

---

## 🔍 Debugging

### **Pod Not Starting**
```bash
kubectl describe pod -n activity-dev <pod-name>
kubectl logs -n activity-dev <pod-name>
```

### **Ingress Not Working**
```bash
# Check Ingress
kubectl get ingress -n activity-dev
kubectl describe ingress -n activity-dev activity-dashboard

# Check /etc/hosts
cat /etc/hosts | grep minibob

# Bypass with port-forward
kubectl port-forward -n activity-dev svc/activity-dashboard 3000:3000
open http://localhost:3000
```

### **Hot-Reload Not Working**
```bash
# Check volume mount
kubectl exec -it -n activity-dev <pod> -- ls -la /app/src

# Check Bun is running with --hot
kubectl exec -it -n activity-dev <pod> -- ps aux | grep bun

# Restart pod
kubectl rollout restart deployment -n activity-dev activity-dashboard
```

---

## 🎯 Validation Checklist

- [ ] All pods Running: `kubectl get pods -n activity-dev`
- [ ] API responds: `curl http://api.minibob.local/health`
- [ ] Dashboard loads: `open http://dashboard.minibob.local`
- [ ] Hot-reload works: Edit `App.tsx`, see changes
- [ ] MiniBob idle: `kubectl logs -n activity-dev -l app.kubernetes.io/name=minibob`

---

## 📊 Architecture

```
Browser → Ingress → {Dashboard, API} → {Redis, SurrealDB} → MiniBob
   ↑                        ↑
   |                        |
*.minibob.local     repos/*/src (volume mounts)
```

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Pods pending | Check Docker Desktop resources |
| 404 on domains | Check `/etc/hosts` and NGINX Ingress |
| Hot-reload fails | Verify volume mounts in deployment |
| MiniBob not working | Check `ANTHROPIC_API_KEY` |
| Build fails | Run `bun install` in vessel directory |

---

## 📚 Documentation

- **Setup Guide**: `DEVELOPMENT_SETUP.md`
- **Dashboard Docs**: `repos/activity-dashboard/README.md`
- **Dashboard Goals**: `repos/activity-dashboard/PROJECT_GOALS.md`
- **Quick Start**: `repos/activity-dashboard/QUICKSTART.md`

---

## 🎓 Learning Path

1. **Deploy**: Run quick start commands
2. **Access**: Open dashboard and API URLs
3. **Edit**: Modify dashboard code, see hot-reload
4. **Activity**: Create simple template, watch MiniBob execute
5. **Observe**: See execution in dashboard (when UI is built)
6. **Develop**: Have MiniBob add feature to itself

---

## 💡 Pro Tips

- Use `kubectl logs -f` to follow logs in real-time
- Edit code directly in `repos/*/src`, changes appear in pods
- Dashboard UI is basic template - build components in Phase 2
- MiniBob boredom polls every 15 seconds in dev mode
- SurrealDB runs in-memory for fast resets

---

**Need Help?** See `DEVELOPMENT_SETUP.md` for full guide  
**Quick Access**: http://dashboard.minibob.local 🚀
