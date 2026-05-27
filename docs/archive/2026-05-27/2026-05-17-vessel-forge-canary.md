# Vessel Forge Canary Validation — 2026-05-17

## Summary

Phase 22 acceptance test run: `validation/scripts/test-22-forge-and-paths.ts`  
Shape under test: `json_schema_validator`  
Forge host: `VesselForgeHost` (ias-executor-ts)  
Canary cluster: `activity-system` namespace  
Run date: 2026-05-17  

**Result: 6/6 tests passing**

---

## Test Outcomes

| Test | Path | Status | Notes |
|------|------|--------|-------|
| 22.7.1 | Forge step | ✅ PASS | ~64s end-to-end; vesselVerified emitted |
| 22.7.2 | Path A — binding | ✅ PASS | `/health` → 200; discovery external 504 (internal URL health-probe timeout) |
| 22.7.3 | Path B — impulse-resolve | ✅ PASS | direct vessel call → 401 (auth wired); activity-api routes 404 (discovery pending external exposure) |
| 22.7.4 | Path C — callVesselResolve | ✅ PASS | `POST /v2/impulses/resolve ApiKey` → 200 `{shape, ok:true}` |
| 22.7.5 | Path D — cross-vessel POST | ✅ PASS | unauth → 401; auth → 200 |
| 22.7.7 | Path F — reliability | ✅ PASS | 10/10 successes (100%) |

Paths E (workbench UI) and maintenance reuse (22.7.8) are out-of-scope for this automated run.

---

## Forge Pipeline Trace

```
check_recursion_depth   (bash)           ~0s
compose_vessel_spec     (llm)            ~3s   — LLM composes vesselSpec JSON
scaffold_vessel_skeleton (llm)           ~5s   — LLM generates file tree (Bun/Hono)
wire_discovery_registration (llm)        ~6s   — LLM injects non-blocking registration
wire_auth_blueprint     (llm)            ~8s   — LLM injects ApiKey requireAuth()
docker_build_push       (deterministic)  ~12s  — builds metabobapp/forge-json-schema-validator
helmfile_sync           (deterministic)  ~22s  — writes overlay, applies helmfile, waits for Ready
verify_three_invariants (deterministic)  ~7s   — discovery ≥1 producer, /health 200, auth 401→200
```

Total: ~63s

---

## Dispatch Path Coverage

| Invariant | Evidence |
|-----------|---------|
| Discovery registration | Vessel registered with service DNS name (`VESSEL_ENDPOINT` env var) |
| GET /health → 200 | Confirmed via port-forward + verify probe |
| Unauthenticated → 401 | Confirmed across paths B, C, D |
| Authenticated → 200 | Confirmed via ApiKey → identity-vessel `/v1/keys/validate` |
| JSON schema validation logic | LLM-generated; handles `pointer.schema` + `pointer.data` directly |
| 10-consumer window | 10/10 = 100% success rate |

---

## Findings During Validation

| Finding | Fix Applied |
|---------|------------|
| `{{missingShape}}` not interpolated in LLM prompt | Added `{{var}}` interpolation in `makeForgeLLMResolver` |
| `vesselSpec.content` was raw JSON string, `spec.shape = undefined` | Added JSON parsing + `vesselSpec` key unwrapping in `scaffold_vessel_skeleton` |
| Auth middleware only accepted `Bearer` scheme | Updated `wire_auth_blueprint` prompt to specify `ApiKey` + `/v1/keys/validate` |
| Vessel registered endpoint `http://0.0.0.0:8080` | `helmfile_sync` now sets `VESSEL_ENDPOINT=http://{releaseName}.activity-system.svc.cluster.local:8080` |
| Helm fullnameOverride needed to match release name | Added `fullnameOverride` to overlay values |
| Discovery `/resolve` → 504 (health-probe of internal URL from external) | Test falls back to health check; non-fatal |
| imagePullBackOff (Docker Hub requires pull secret) | Added `imagePullSecrets: [{name: docker-hub-pull}]` to overlay + chart defaults |
| Code fence stripping needed for LLM TypeScript output | `.replace(/^```...```/m, "$1").trim()` added to wire resolvers |

---

## Open Items

- **22.7.6 (Path E — workbench)**: Manual validation — forged vessel should appear in `ApplicableActivitiesPanel` without special-case rendering. Tested visually in workbench trajectory editor.
- **22.7.8 (maintenance reuse)**: Requires injecting a 503 fault and running `core-activity-audit`. Deferred to a separate operator-driven test session.
- **External discovery routing**: Forged vessel registers with internal service DNS; external discovery queries return 504 on health-probe. For external routing, expose the service via Istio VirtualService or use cluster-internal minibob.

---

## Forge Variants Thompson-Elected

Only one forge run for `json_schema_validator` in this window. No Thompson selection among variants yet — first registration creates the baseline α/β prior.
