# Container Environment Status

**Date**: February 13, 2026  
**Profile**: stable + devbob (clean)

## ✅ Running Containers

| Container | Status | Ports | Profile |
|-----------|--------|-------|---------|
| devbob-clean | Up (healthy) | 3000 (ACP), 8082 (MCP) | devbob |
| api-server-dev | Up (healthy) | 8080 | stable |
| metabob-surreal | Up (healthy) | 8000 | stable |
| metabob-redis | Up (healthy) | 6379 | stable |

## 🔗 Network

All containers on `metabob-network`:
- devbob-clean can access api-server-dev at http://api-server-dev:8080
- Backend has access to redis and surreal
- Data preserved in existing volumes

## 📊 Data Volumes

- **SurrealDB**: `configs_metabob_surreal_data` (preserved from previous setup)
- **Redis**: `metabob_redis_data`
- **Workspace**: Empty (clean environment)

## 🎯 Testing Ready

**devbob-clean** is ready for activity testing:
- Empty workspace (no local code)
- Connected to backend
- ACP server listening on port 3000
- MCP server available

**Next Step**: Submit activity to test self-containment!

```bash
# Test activity execution
curl -X POST http://localhost:3000/execute \
  -H "Content-Type: application/json" \
  -d '{
    "activityId": "INFRASTRUCTURE-bda5eef0",
    "variables": {
      "template_name": "clean-env-test",
      "template_category": "test"
    }
  }'
```

## 📋 Access Points

- **Backend API**: http://localhost:8080
- **Devbob ACP**: http://localhost:3000  
- **Devbob MCP**: http://localhost:8082
- **SurrealDB**: http://localhost:8000
- **Redis**: localhost:6379

## ✅ Validation

- [x] Backend services running
- [x] SurrealDB data preserved
- [x] devbob-clean container healthy
- [x] ACP server responding
- [x] Network connectivity working

**Status**: Environment ready for activity testing! 🚀
