## Rationale

Invariant 2 of the vessel template — "every advertised shape has a dispatch case" — is the contract between discovery-vessel's registry and a vessel's `POST /v2/impulses/resolve` endpoint. Violations are silent: discovery-vessel returns a route based on advertised shapes, the caller dispatches a pointer with `type = shape`, and the vessel's switch falls through to the default branch. The HTTP layer returns 200 with an empty body, or 400, depending on the dispatcher's catch-all. Either way, the caller's activity records a non-deterministic failure mode and Thompson posteriors on the *calling* activity drift β-ward.

The reverse direction — handlers without advertised shapes — is equally load-bearing. Such handlers exist (see findings below), but they are reachable only by callers with out-of-band knowledge of the shape. That coupling defeats the purpose of the registry: discovery is supposed to be the single source of truth for what a vessel can resolve.

Comment-driven enforcement (`repos/metabob-activity-api/src/config.ts:216-217`, `repos/concept-db/src/config.ts:183-184`) has not held. This change replaces the comment with a structural check.

## Mechanism

**Chosen: static parse + runtime startup probe, both deriving from the same two files per vessel.**

For each vessel that exposes `POST /v2/impulses/resolve`:

1. **Static parser** (build-time, ~150 LOC TypeScript) reads two files:
   - `src/config.ts` — extracts the string-literal array assigned to `discovery.shapes`. Parser uses `ts.createSourceFile` and walks the AST; it does not eval the file. Shapes that are not string literals (computed names) fail the check with a clear error.
   - `src/routes/impulses.ts` — extracts every `case '<literal>':` inside the `switch(pointer.type)` (or `switch(shape)` for concept-db's variant, see below). Cases that fall through (`case 'a': case 'b':`) all count.
2. **Set diff**:
   - `advertised \ handled` → unhandled-shape errors.
   - `handled \ advertised` → orphan-handler errors, unless the case is annotated `// @shape-dispatch:private` (single-line comment immediately above the `case`). Private handlers are reachable by intra-vessel code but excluded from the registry contract.
3. **Output**: file:line for each violation, exit code 1 if any unsuppressed violation found. Wired into `bun run lint` (per-vessel `package.json` script).
4. **Runtime probe** (`startup()` in `src/index.ts`): runs the same diff against the live config object and a registry of handlers (each `case` registers itself in a `Map<string, Handler>` at module load — see "Worked example" below). On divergence the vessel:
   - Logs the divergence with `level=error`.
   - Filters the offending shapes out of the registration payload (does not advertise what it cannot resolve).
   - Emits one `failure_mode.type = "verifier_negative"` trace to activity-api with `validator_id = "shape-dispatch-agreement"`, `context.failed_evidence = [{ shape, file, line, direction: "advertised_unhandled" | "handled_unadvertised" }]`. Debounced per `(vessel_id, shape)` to one trace per startup.

### One rejected alternative

**TypeScript discriminated union making the switch exhaustive at the compiler level.** The handler map would be typed `Record<Shape, Handler>` where `Shape` is a union derived from `config.discovery.shapes`. Missing keys become compiler errors; extra keys become compiler errors. This is appealing because it folds the check into `tsc` with zero new tooling.

Rejected because: the `shapes` array is constructed at runtime from environment variables in several vessels (concept-db gates `mcpTool` on a feature flag in the same array literal today, and the same pattern is expected for future feature-flagged shapes), and the array contains entries whose presence depends on `parseEnvBool`. A purely type-level encoding would require lifting the array to a literal `const` and moving all feature gating to dispatch-time. That is a larger and more invasive refactor than the static parse, and it does not give us the runtime probe (a build-time-only check cannot catch a deployed image whose config drifted from the binary). The static parse handles the array as a literal *or* a literal spread over a small number of branches, surfaces dynamic expressions as explicit errors, and the runtime probe re-checks against whatever array the deployed vessel actually advertises.

The static parse is also language-agnostic in shape: when a non-TypeScript vessel arrives the same Set-diff logic ports trivially. The discriminated-union path is TypeScript-only.

## Location of the check

| Surface | Where | When it runs |
|---|---|---|
| Static parse | `scripts/check-shape-dispatch.ts` in each vessel repo | `bun run lint` (CI gate); also available as a standalone `bun scripts/check-shape-dispatch.ts` for local use |
| Runtime probe | `src/services/discovery-client.ts` `register()` path | On every vessel startup, before the first heartbeat |
| Trace emission | `src/services/discovery-client.ts` → activity-api `activityExecutionTrace_write` | One trace per divergence per startup; debounced |

A shared implementation lives in a small zero-dependency package — proposed location `packages/shape-dispatch-check/` in the super-repo, consumed by each vessel via a workspace dependency. This keeps the AST-walking logic in one place; the per-vessel script is a four-line wrapper that points at `src/config.ts` and `src/routes/impulses.ts`.

## Interaction with Phase 8 canary validation

Phase 8 of `2026-04-26-impulse-activity-loop` validates the loop end-to-end against canary. Until this change ships, a vessel-side divergence shows up in Phase 8 as a Thompson posterior drift on the *caller*, never on the vessel. After this change ships, the same divergence surfaces as a `verifier_negative` self-trace on the *vessel* with a precise file:line, before any caller ever dispatches. Phase 8 acceptance criteria should add: "Zero `validator_id = shape-dispatch-agreement` self-traces in the canary window."

## Worked example: what divergence looks like and how it is reported

Given (real, from `repos/metabob-activity-api`, audited 2026-05-17):

`src/config.ts:218-317` advertises 42 shapes including `activityExecutionTrace`, `activityTemplate`, …, `goal_verification_label`.

`src/routes/impulses.ts` defines cases including:
- `case 'analysisResult':` (line 1415)
- `case 'cochangeSuggestions':` (line 1416)
- `case 'impactAnalysis':` (line 1417)
- `case 'codebaseSearch':` (line 1418)
- `case 'problemCluster':` (line 1433)

None of the five appear in `config.discovery.shapes`. They are reachable only by callers who have hardcoded those shape names — a pre-discovery pattern that was not removed when the discovery contract landed.

Static parser output:

```
[shape-dispatch-agreement] metabob-activity-api: 5 orphan handlers
  src/routes/impulses.ts:1415  case 'analysisResult'        not in config.discovery.shapes
  src/routes/impulses.ts:1416  case 'cochangeSuggestions'   not in config.discovery.shapes
  src/routes/impulses.ts:1417  case 'impactAnalysis'        not in config.discovery.shapes
  src/routes/impulses.ts:1418  case 'codebaseSearch'        not in config.discovery.shapes
  src/routes/impulses.ts:1433  case 'problemCluster'        not in config.discovery.shapes
Resolution: add to config.discovery.shapes, or annotate `// @shape-dispatch:private` above each case.
Exit 1.
```

For `concept-db` (audited same day):

`src/config.ts:205` advertises `conceptUpkeepAuditLog`. No corresponding `case 'conceptUpkeepAuditLog':` exists in `src/routes/impulses.ts`.

Static parser output:

```
[shape-dispatch-agreement] concept-db: 1 unhandled advertised shape
  src/config.ts:205  'conceptUpkeepAuditLog'  has no case in src/routes/impulses.ts
Resolution: add a `case 'conceptUpkeepAuditLog':` to the switch, or remove from config.discovery.shapes.
Exit 1.
```

Runtime probe output (vessel startup, after a hypothetical config drift):

```json
{
  "level": "error",
  "msg": "[shape-dispatch] divergence at startup; refusing to advertise unhandled shapes",
  "vessel_id": "concept-db-pod-abc123",
  "unhandled_advertised": ["conceptUpkeepAuditLog"],
  "orphan_handlers": []
}
```

Followed by a single trace:

```json
{
  "activity_template_id": "self-check",
  "vessel_id": "concept-db-pod-abc123",
  "failure_mode": {
    "type": "verifier_negative",
    "reason": "shape-dispatch agreement broken at startup",
    "context": {
      "validator_id": "shape-dispatch-agreement",
      "failed_evidence": [
        { "shape": "conceptUpkeepAuditLog", "direction": "advertised_unhandled", "file": "src/config.ts", "line": 205 }
      ]
    }
  }
}
```

## Findings (audit 2026-05-17, not fixed in this change)

These are the divergences the check will surface on first run. Recording them here so the implementer is not surprised; fixing each is a follow-up per-vessel commit, not part of this change.

| Vessel | Direction | Shape / handler | Location |
|---|---|---|---|
| activity-api | orphan handler | `analysisResult` | `src/routes/impulses.ts:1415` |
| activity-api | orphan handler | `cochangeSuggestions` | `src/routes/impulses.ts:1416` |
| activity-api | orphan handler | `impactAnalysis` | `src/routes/impulses.ts:1417` |
| activity-api | orphan handler | `codebaseSearch` | `src/routes/impulses.ts:1418` |
| activity-api | orphan handler | `problemCluster` | `src/routes/impulses.ts:1433` |
| concept-db | unhandled advertised | `conceptUpkeepAuditLog` | `src/config.ts:205` |

Possible interpretation for activity-api's five: they may be legitimate intra-vessel handlers (the route is also reachable from `/v2/impulses/resolve` by internal callers). If so, the resolution is to annotate them `// @shape-dispatch:private`, not to advertise them. The check defers to the implementer.

## Identity-vessel: shape ≠ pointer.type

`repos/identity-vessel/src/services/config.ts:116-120` advertises three shapes — `authentication`, `apiKey`, `jwtToken` — but the dispatcher in `src/resolvers/auth.ts:192-193` reads `impulse.pointer.type` against `apiKey` and `session`. The advertised shape name and the pointer-type literal disagree by convention here; the shape is the *category* and the pointer-type is the *credential form*.

The check must accept this case. Concretely: the static parser allows a per-vessel `shape-dispatch.config.json` declaring an explicit mapping `{ shape: string → pointer_types: string[] }`. Identity-vessel ships one such file mapping `authentication → [apiKey, session, jwtToken]`. Default (no config) is the identity mapping `shape === pointer.type`, which covers activity-api and concept-db.

## ias-executor-ts

`repos/ias-executor-ts` does not advertise shapes through discovery (it is an executor library, not a vessel; see Milestone B percolation note 2026-05-15). The forge-template path produces vessel scaffolds. The check is added to the forge template so generated vessels inherit it from day one. No runtime probe applies to ias-executor-ts itself.

## Out of scope

- Fixing the 6 audited divergences. Each is a per-vessel commit after this change lands.
- Validating that handlers actually return data matching the shape contract. That is a separate concern (downstream of H1 two-sided execution traces in the security-hardening spec).
- Cross-vessel shape uniqueness (two vessels both advertising `mcpTool` is intentional, not a violation).
