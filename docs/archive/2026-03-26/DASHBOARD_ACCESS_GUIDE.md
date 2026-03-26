# MiniBob Dashboard Access Guide

**Dashboard URL**: `dashboard.minibob.local`  
**Status**: ✅ Infrastructure configured and working

## Current Status

### ✅ Working Components
- **Dashboard Service**: Running in `activity-system` namespace
- **Health Endpoint**: Responding correctly
- **API Endpoints**: Working (`/api/hello`, `/health`)
- **Istio VirtualService**: Configured for `dashboard.minibob.local`
- **Ingress Gateway**: Routing traffic correctly
- **Backend Data**: Templates, metrics, and executions all available

### ⚠️ Known Issue
- **Root Path (`/`)**: Hangs when accessed (Bun server issue with index.html serving)
- **Workaround**: Dashboard API is accessible, health checks work

## Verification Results

### Health Check via Ingress ✅
```bash
curl -H "Host: dashboard.minibob.local" http://localhost:80/health
# Response: {"status":"healthy","timestamp":"2026-03-18T11:16:05.603Z","uptime":85686.904213207}
```

### API Endpoint via Ingress ✅
```bash
curl -H "Host: dashboard.minibob.local" http://localhost:80/api/hello
# Response: {"message":"Hello, world!","method":"GET"}
```

### Direct Pod Access ✅
```bash
kubectl exec -n activity-system activity-dashboard-5cffbcbd45-z842x -- \
  wget -q -O- http://localhost:3000/health
# Response: {"status":"healthy",...}
```

## Infrastructure Configuration

### Istio VirtualService
```yaml
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: minibob-dashboard
  namespace: activity-system
spec:
  hosts:
  - "dashboard.minibob.local"
  gateways:
  - metabob/metabob-gateway
  http:
  - match:
    - uri:
        prefix: /
    route:
    - destination:
        host: activity-dashboard.activity-system.svc.cluster.local
        port:
          number: 3000
```

**Status**: ✅ Applied and active

### Service
```bash
kubectl get svc activity-dashboard -n activity-system
# NAME                  TYPE        CLUSTER-IP       EXTERNAL-IP   PORT(S)    AGE
# activity-dashboard    ClusterIP   10.107.128.168   <none>        3000/TCP   24h
```

**Status**: ✅ Running and healthy

### Ingress Gateway
```bash
kubectl get svc istio-ingressgateway -n istio-system
# NAME                   TYPE           CLUSTER-IP   EXTERNAL-IP   PORT(S)
# istio-ingressgateway   LoadBalancer   10.97.1.3    localhost     80:30163/TCP,...
```

**Status**: ✅ Accessible on localhost:80

## Access Methods

### Method 1: Via Ingress (Production)
**Prerequisites**:
1. Add to `/etc/hosts`:
   ```
   127.0.0.1 dashboard.minibob.local
   ```

2. Access:
   ```
   http://dashboard.minibob.local/health
   http://dashboard.minibob.local/api/hello
   ```

### Method 2: Direct Port-Forward (Development)
```bash
kubectl port-forward -n activity-system svc/activity-dashboard 8888:3000

# Access:
http://localhost:8888/health
http://localhost:8888/api/hello
```

### Method 3: With Host Header (Testing)
```bash
curl -H "Host: dashboard.minibob.local" http://localhost:80/health
curl -H "Host: dashboard.minibob.local" http://localhost:80/api/hello
```

## Dashboard Data Available

All backend data is ready and accessible via the Activity API:

### Templates
```bash
curl http://localhost:8082/v2/activities/templates
# Returns: 1 registered template ("Generate Greeting")
```

### Metrics
```sql
SELECT * FROM variant_performance_metrics;
# Returns: Thompson Sampling metrics (α=1.0, β=1.0)
```

### Executions
```sql
SELECT * FROM activity_executions;
# Returns: 4 execution records with full metrics
```

## Troubleshooting

### Issue: Root path hangs
**Symptom**: `curl http://dashboard.minibob.local/` times out  
**Cause**: Bun server issue with index.html/frontend.tsx serving  
**Workaround**: Use API endpoints directly or fix Bun server configuration

### Issue: Can't resolve dashboard.minibob.local
**Solution**: Add to `/etc/hosts`:
```bash
echo "127.0.0.1 dashboard.minibob.local" | sudo tee -a /etc/hosts
```

### Issue: Connection refused
**Check**: Ensure istio-ingressgateway is running:
```bash
kubectl get pods -n istio-system | grep ingress
# Should show: istio-ingressgateway-xxxxx   1/1   Running
```

## Playwright Testing Status

**Version Compatibility**: ❌ MCP server expects chromium-1200, installed is chromium-1208  
**Workaround**: Manual browser testing + API verification  
**Status**: Infrastructure verified via API testing

### Manual Browser Testing
1. Add hosts entry (requires sudo):
   ```bash
   echo "127.0.0.1 dashboard.minibob.local" | sudo tee -a /etc/hosts
   ```

2. Open browser to:
   ```
   http://dashboard.minibob.local/health
   ```

3. Expected: JSON response showing healthy status

## Next Steps

### Fix Bun Server Root Path Issue
The dashboard server (`repos/activity-dashboard/src/index.ts`) needs investigation:
- Check why `"/*": index` route is hanging
- Verify Bun's handling of index.html serving
- Test with different Bun configurations

### Alternative: Rebuild Dashboard
If Bun issue persists, consider:
1. Use a simple Express/Fastify server
2. Pre-build React frontend (static files)
3. Serve static files instead of on-demand transpilation

## Summary

✅ **Infrastructure**: Fully configured and working  
✅ **API Endpoints**: Accessible via ingress  
✅ **Health Checks**: Responding correctly  
✅ **Data**: All templates, metrics, and executions available  
⚠️  **UI**: Root path needs debugging (Bun server issue)  

**Conclusion**: The dashboard backend and infrastructure are production-ready. The frontend serving issue is isolated to the Bun server's index.html handling and can be fixed or worked around.
