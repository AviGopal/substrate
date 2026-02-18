# ACP Phase 3 - Next Steps Guide

**Phase 3 Status**: ✅ COMPLETE  
**Commit**: `cdab20de` on `feat/acp-phase3-bidirectional-resolution`  
**Last Updated**: February 16, 2026

---

## What's Done ✅

Phase 3 bidirectional impulse resolution is complete with:
- ✅ Resolution cache (100MB LRU, 1hr TTL)
- ✅ Content request tool (acp_request_impulse_content)
- ✅ ImpulseResolver.resolveForPrompt() function
- ✅ ACP delegate host session context
- ✅ 28 tests, all passing
- ✅ Comprehensive documentation

---

## Immediate Next Steps (Choose One)

### Option 1: Merge Phase 3 to Dev (Recommended)
**Goal**: Integrate Phase 3 into main development branch

**Steps**:
```bash
cd repos/metabob-opencode

# Ensure all tests pass
bun test packages/opencode/src/session/__tests__/

# Switch to dev branch
git checkout dev
git pull origin dev

# Merge Phase 3
git merge feat/acp-phase3-bidirectional-resolution

# Resolve conflicts if any
# Run full test suite
bun test

# Push to remote
git push origin dev
```

**Duration**: 15-30 minutes  
**Risk**: Low (no breaking changes, full test coverage)

---

### Option 2: Docker Integration Testing (Phase 4A)
**Goal**: Test bidirectional resolution in real Docker containers

**Prerequisites**:
- Docker containers running (devbob-opencode, devbob-cli)
- Backend services healthy (api-server-dev, redis)

**Test Scenario**:
```bash
# Start containers
docker-compose --profile stable --profile devbob-dev up -d

# Wait for health
docker ps --filter "name=devbob" --format "table {{.Names}}\t{{.Status}}"

# Test delegation with impulse sharing
docker exec -it devbob-opencode bun opencode --eval "
  // Create impulse with file pointer
  await impulse_create({
    id: 'test-config',
    type: 'file',
    pointer: { type: 'file', path: '/workspace/package.json' },
    budget: 2000
  })
  
  // Delegate to CLI agent with impulse sharing
  await acp_delegate({
    target: 'docker://devbob-cli',
    taskDescription: 'Analyze package dependencies',
    prompt: 'List the dependencies from the shared package.json',
    shareImpulses: ['test-config']
  })
"

# Check if remote agent fetched content
docker exec -it devbob-cli bun opencode --eval "
  import { globalImpulseCache } from './packages/opencode/src/session/impulse-cache'
  console.log('Cache stats:', globalImpulseCache.getStats())
"
```

**Duration**: 1-2 hours  
**Risk**: Medium (environment-dependent)

**Expected Results**:
- ✅ Remote agent receives pointer (175 bytes)
- ✅ Remote agent attempts local resolution
- ✅ Falls back to acp_request_impulse_content
- ✅ Host resolves and returns content
- ✅ Remote agent caches content
- ✅ Cache stats show 1 entry, 0 misses after cache

---

### Option 3: Performance Profiling
**Goal**: Measure actual performance in production-like environment

**Metrics to Collect**:
1. Network traffic (bytes sent/received)
2. Resolution latency (local vs remote)
3. Cache hit rate over time
4. Memory usage (cache size)
5. CPU usage (cache operations)

**Tools**:
```bash
# Install profiling tools
bun add --dev clinic autocannon

# Profile resolution latency
cd repos/metabob-opencode
bun run clinic doctor -- bun test packages/opencode/src/session/__tests__/impulse-bidirectional-resolution.test.ts

# Measure cache performance
bun run clinic bubbleprof -- bun test packages/opencode/src/session/__tests__/impulse-cache.test.ts
```

**Duration**: 2-3 hours  
**Risk**: Low (read-only analysis)

---

### Option 4: Phase 4B - Prefetch Optimization
**Goal**: Reduce latency by prefetching likely-needed impulses

**Design**:
```typescript
// Add prefetch hints to shared_impulses
interface SharedImpulsesMetadata {
  impulses: SerializedImpulse[]
  hostSessionId: string
  prefetchHints?: {
    priority: 'high' | 'medium' | 'low'
    impulseIds: string[]
  }
}

// Remote agent prefetches high-priority impulses in background
async function prefetchImpulses(hints: PrefetchHints) {
  for (const impulseId of hints.impulseIds) {
    if (hints.priority === 'high') {
      // Prefetch immediately
      await fetchImpulseContent(impulseId)
    } else {
      // Queue for background prefetch
      queuePrefetch(impulseId)
    }
  }
}
```

**Duration**: 3-4 hours  
**Risk**: Medium (new functionality)

---

### Option 5: Phase 4C - Monitoring & Metrics
**Goal**: Production monitoring for impulse resolution

**Components**:
1. Prometheus metrics exporter
2. Grafana dashboard
3. Alerting rules

**Metrics to Track**:
```typescript
// Prometheus metrics
const metrics = {
  impulse_resolution_total: Counter,
  impulse_resolution_latency_seconds: Histogram,
  impulse_cache_hit_rate: Gauge,
  impulse_cache_size_bytes: Gauge,
  impulse_cache_evictions_total: Counter,
  impulse_fetch_errors_total: Counter
}

// Example metric collection
metrics.impulse_resolution_total.inc({ type: 'file', source: 'cache' })
metrics.impulse_resolution_latency_seconds.observe(0.025)
```

**Duration**: 4-6 hours  
**Risk**: Medium (infrastructure setup)

---

## Recommended Path

### Short Term (Next 1-2 days)
1. **Merge Phase 3 to dev** (Option 1) - 30 minutes
2. **Docker integration testing** (Option 2) - 2 hours
3. **Fix any issues found** - 1-2 hours

### Medium Term (Next week)
4. **Performance profiling** (Option 3) - 3 hours
5. **Optimize based on profiling results** - 2-4 hours

### Long Term (Next 2 weeks)
6. **Prefetch optimization** (Option 4B) - 3-4 hours
7. **Monitoring & metrics** (Option 4C) - 6 hours
8. **Production deployment** - 2-3 hours

---

## Quick Commands Reference

### Development
```bash
# Run Phase 3 tests
cd repos/metabob-opencode
bun test packages/opencode/src/session/__tests__/impulse-cache.test.ts
bun test packages/opencode/src/session/__tests__/impulse-bidirectional-resolution.test.ts

# Check git status
git status
git log --oneline -5

# View cache implementation
cat packages/opencode/src/session/impulse-cache.ts

# View tool implementation
cat packages/opencode/src/tool/acp-request-impulse-content.ts
```

### Docker Testing
```bash
# Start environment
docker-compose --profile stable --profile devbob-dev up -d

# Check container health
docker ps --filter "name=devbob"

# Access container
docker exec -it devbob-opencode bash

# View logs
docker logs devbob-opencode --tail 100 -f
```

### Debugging
```bash
# Enable debug logging
export LOG_LEVEL=DEBUG

# Watch cache operations
grep -i "impulse-cache" logs/*.log

# Monitor network traffic
docker stats devbob-opencode devbob-cli
```

---

## Success Criteria (Phase 4A Integration Testing)

### Must Have ✅
- [ ] Remote agent receives pointer (< 200 bytes)
- [ ] Local resolution attempted first
- [ ] Fallback to acp_request_impulse_content works
- [ ] Host resolves and returns content
- [ ] Content cached on remote side
- [ ] Subsequent access uses cache (no network)
- [ ] Cache stats show expected values

### Should Have ⭐
- [ ] Latency < 100ms for cached access
- [ ] Latency < 1s for remote fetch
- [ ] Cache hit rate > 80% after warmup
- [ ] Zero memory leaks over 1 hour
- [ ] Error handling works for missing files

### Nice to Have 🎯
- [ ] Automatic cache warming on startup
- [ ] Prefetch hints reduce latency
- [ ] Metrics exported to Prometheus
- [ ] Dashboard shows real-time stats

---

## Troubleshooting Guide

### Issue: Cache not working
**Symptoms**: High miss rate, repeated network requests

**Debug**:
```typescript
import { globalImpulseCache } from './impulse-cache'

// Check cache state
console.log(globalImpulseCache.getStats())

// Verify TTL not expiring too quickly
const content = globalImpulseCache.get('test-impulse')
if (!content) {
  console.log('Cache miss - check TTL setting')
}
```

### Issue: Remote agent can't fetch content
**Symptoms**: "Host session not found" or "Impulse not found"

**Debug**:
1. Verify host session ID is correct
2. Check impulse exists in host session
3. Verify acp_request_impulse_content tool registered
4. Check network connectivity between containers

### Issue: Memory usage growing
**Symptoms**: Cache size exceeds 100MB, container OOM

**Debug**:
```typescript
const stats = globalImpulseCache.getStats()
console.log(`Cache size: ${stats.totalSizeBytes / 1024 / 1024}MB`)
console.log(`Evictions: ${stats.evictions}`)

// If evictions low but size high, reduce max size
// If evictions high, consider increasing max size
```

---

## Questions to Answer in Phase 4

1. **Performance**: What's the actual latency difference between local and remote resolution?
2. **Scalability**: How does cache perform with 100+ impulses?
3. **Reliability**: What's the error rate for remote fetches?
4. **Usability**: Is the two-step resolution (local → remote) intuitive?
5. **Efficiency**: What's the cache hit rate in real workflows?

---

## Contact & Resources

**Branch**: `feat/acp-phase3-bidirectional-resolution`  
**Commit**: `cdab20de`  
**Documentation**: 
- [ACP_PHASE3_COMPLETE.md](./ACP_PHASE3_COMPLETE.md) - Full implementation report
- [ACP_PHASE3_DESIGN.md](./ACP_PHASE3_DESIGN.md) - Design document
- [ACP_PROJECT_STATUS.md](./ACP_PROJECT_STATUS.md) - Overall project status

**Tests**:
- `packages/opencode/src/session/__tests__/impulse-cache.test.ts` (14 tests)
- `packages/opencode/src/session/__tests__/impulse-bidirectional-resolution.test.ts` (14 tests)

**Key Files**:
- `packages/opencode/src/session/impulse-cache.ts` (322 lines)
- `packages/opencode/src/tool/acp-request-impulse-content.ts` (199 lines)
- `packages/opencode/src/session/impulse-resolver.ts` (modified)
- `packages/opencode/src/tool/acp-delegate.ts` (modified)

---

**Ready for Phase 4!** 🚀
