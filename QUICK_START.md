# Metabob Stack - Quick Start

## One-Command Deploy

```bash
cd helm && helmfile -f helmfile.yaml sync
```

## Verify Deployment

```bash
./scripts/validate-metabob-stack.sh
```

Expected output:
```
✓ All checks passed!
```

## Check Status

```bash
kubectl get pods -n metabob
```

Expected: All 3 pods Running (devbob, redis-master, surrealdb)

## Test ACP Server

```bash
kubectl port-forward -n metabob svc/devbob 3000:3000 &
curl http://localhost:3000/config
```

Expected: JSON config returned

## Components

- **DevBob:** AI agent with ACP server (port 3000)
- **Redis:** Session storage (port 6379)
- **SurrealDB:** Graph database (port 8000)

## Key Files

- `METABOB_STACK_DEPLOYMENT_GUIDE.md` - Full deployment guide
- `DEVBOB_ACP_USAGE_GUIDE.md` - ACP usage examples
- `scripts/validate-metabob-stack.sh` - Validation script

## Common Commands

```bash
# View logs
kubectl logs -n metabob -l app.kubernetes.io/name=devbob -f

# Restart component
kubectl rollout restart deployment/devbob -n metabob

# Remove stack
cd helm && helmfile -f helmfile.yaml destroy
```

## Troubleshooting

Pod not starting? Check logs:
```bash
kubectl logs -n metabob <pod-name>
kubectl describe pod -n metabob <pod-name>
```

## Next Steps

1. Test with `acp_delegate` tool
2. Build multi-agent workflows
3. Review full documentation

---

**Status:** ✅ Ready  
**Last Updated:** February 26, 2026
