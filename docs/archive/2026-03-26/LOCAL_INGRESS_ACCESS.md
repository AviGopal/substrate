# Local Ingress Access via Istio

## ✅ Successfully Configured

### Services Accessible Through Istio Gateway

1. **metabob-rpc-api** 
   - Host: `api.metabob.com`
   - Endpoint: `http://localhost/` (with Host header)
   - Status: ✅ Working

### Istio Components Deployed

- **Gateway**: `metabob-gateway` in `metabob` namespace
- **VirtualServices**:
  - `metabob-rpc-api` → `api.metabob.com`, `ide.metabob.com`
  - `metabob-dashboard` → `app.metabob.com`
  - `opencode-server` → `devbob.metabob.com`
  - `amphitheatre` → `demo.metabob.com`
  - `metabob-site` → `metabob.com`
- **Ingress Gateway**: LoadBalancer on `localhost` (Docker Desktop)

## 🚀 Quick Access

### Method 1: Using Host Headers (Works Now)

```bash
# Health check
curl -H "Host: api.metabob.com" http://localhost/

# Activity templates
curl -H "Host: api.metabob.com" http://localhost/v2/activities/templates

# Analysis endpoint
curl -H "Host: api.metabob.com" http://localhost/analysis
```

### Method 2: Add /etc/hosts Entries (Recommended for Browser)

Add these lines to `/etc/hosts`:
```
127.0.0.1 api.metabob.com
127.0.0.1 app.metabob.com
127.0.0.1 devbob.metabob.com
127.0.0.1 demo.metabob.com
```

Then access directly:
```bash
curl http://api.metabob.com/
curl http://api.metabob.com/v2/activities/templates

# Or in browser:
open http://api.metabob.com/
```

## 📋 What Was Fixed

### 1. Service Port Mismatch
**Problem**: VirtualServices routed to port 8080, but Service had `targetPort: 80` while pod listened on 8080

**Solution**: Created service manifest with correct targetPort:
```yaml
# repos/platform/metabob-apps/charts/metabob-rpc-api/charts/templates/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: metabob-rpc-api
spec:
  ports:
    - port: 8080
      targetPort: 8080  # Fixed: was 80
      name: http
```

### 2. Istio Application Chart Updates
**Files Modified**:
- `environments/default/default.values.yaml`: Set `useIstio: true`
- `charts/istio-application/values/default.istio-application.values.yaml`: Created with wildcard hosts
- `charts/istio-application/charts/templates/service-accounts.yaml`: Removed conflicting Service resources
- `charts/metabob-rpc-api/charts/templates/service.yaml`: Created with correct ports

## 🔧 Architecture

```
Browser/CLI
    ↓ (Host: api.metabob.com)
localhost:80 (istio-ingressgateway LoadBalancer)
    ↓
metabob-gateway (Istio Gateway)
    ↓
metabob-rpc-api VirtualService
    ↓
metabob-rpc-api Service (port 8080)
    ↓
metabob-rpc-api Pod (container port 8080)
```

## 🎯 Benefits

1. **No Port-Forwards Needed**: All services accessible through single ingress point
2. **Production Parity**: Same Istio routing as production environment
3. **Clean URLs**: Use domain names instead of localhost:PORT
4. **WebSocket Support**: Istio handles WS upgrades properly
5. **Unified Configuration**: Single helmfile manages all routing

## 🔍 Verification Commands

```bash
# Check Istio gateway
kubectl get gateway -n metabob

# Check virtual services
kubectl get virtualservice -n metabob

# Check ingress gateway external IP
kubectl get svc -n istio-system istio-ingressgateway

# Test connectivity
curl -H "Host: api.metabob.com" http://localhost/
```

## ⚠️ Known Issues

1. **opencode-server**: Pod readiness probe failing, investigating health endpoint
2. **Templates**: Backend returns 0 templates due to scope/org filtering (separate issue)

## 📝 Configuration Files

### Helm Values
- `repos/platform/metabob-apps/environments/default/default.values.yaml`
- `repos/platform/metabob-apps/charts/istio-application/values/default.istio-application.values.yaml`

### Service Manifests
- `repos/platform/metabob-apps/charts/metabob-rpc-api/charts/templates/service.yaml`

### Deploy Command
```bash
cd repos/platform/metabob-apps
helmfile -e default sync
```

## ✅ Success Criteria Met

- [x] Istio Gateway deployed and accessible on localhost
- [x] VirtualServices created for all services
- [x] metabob-rpc-api accessible via ingress
- [x] Service ports corrected (8080 → 8080)
- [x] Health endpoint responding correctly
- [x] Configuration persisted in helm charts

---

**Status**: ✅ Ingress access fully functional for metabob-rpc-api
**Next**: Fix opencode-server health probe and test other services
