# Federation Security Hardening Specification

**Date:** 2026-04-28  
**Status:** Integrated into impulse-activity-loop (Phase 1-2 gating)  
**Scope:** Federation security model, phase constraints, attack mitigation, hardening dependencies

---

## Executive Summary

Federation introduces three **new attack families** that require targeted hardening before cross-account composition (Phase 2) is enabled:

1. **Posterior poisoning via federated traces** — Account A observes B's Thompson posteriors to infer failure patterns
2. **Scope widening via composition chains** — Account A uses B's templates to bypass scope narrowing (CC1)
3. **Authority-key privilege escalation** — Account A uses metabob_system authority-keys on B's resources

**Phase 1 (read-only federation) is safe** — no hardening required. **Phase 2 (cross-account composition) requires H1 + CC1** to be deployed and validated before launch.

---

## Context

This specification addresses findings from `FEDERATION_SECURITY_REVIEW_2026_04_28.md`. It defines:
- The three attack families and six concrete attack scenarios
- Five federation constraints (FC-1 through FC-5) that enable safe federation
- Which hardenings (H1, CC1) are prerequisites for each phase
- Phase gating criteria and validation gates

---

## Attack Families

### Family 1: Posterior Poisoning & Reconnaissance

**Threat Model:** Account A observes Account B's Thompson posteriors to infer B's failure patterns, resolver strategies, and shape validation weaknesses. Over time, A learns which patterns fail and can exploit them.

**Attack Scenarios:**

#### Scenario 1A: Shape Distribution Inference
```
Setup:
- acme owns "code_review_template" (visible on shared project)
- widgets executes code_review_template 1000x, measures 85% success
- acme's own success rate is 90% (higher quality threshold)

Attack:
1. widgets infers: "acme's validation is weak on edge cases"
2. widgets crafts edge-case code samples that fail against acme's template
3. widgets triggers failures to degrade acme's confidence score
4. Risk: templates appear unreliable, users migrate to competitors
```

**Phase 1 Risk:** LOW — Thompson Sampling is account-scoped; traces visible but not fed to learning loop  
**Phase 2 Risk:** HIGH without H1 — federated traces would poison posteriors  
**Mitigation:** H1 (two-sided traces) + trace visibility access control

#### Scenario 1B: Resolver Selection Inference
```
Setup:
- acme owns "intent_classifier" with 3 variants (A, B, C)
- Thompson scores visible: variant C has α=30, β=2 (high success on small n)
- variant C is a recent experiment

Attack:
1. widgets observes C is favored by Thompson Sampling
2. widgets copies C's strategy and ships own competing variant
3. Or: widgets waits for C to fail at scale, offers alternative
4. Risk: competitive intelligence, IP theft
```

**Phase 1 Risk:** LOW — variant scores are public; Thompson not federated  
**Phase 2 Risk:** HIGH — posterior visibility enables copying  
**Mitigation:** H1 to prevent cross-account Thompson poisoning

---

### Family 2: Scope Widening via Composition Chains

**Threat Model:** Account A uses Account B's templates to construct goal decomposition chains that expand scope beyond the parent, bypassing CC1 (scope-narrowing) enforcement if B's templates are weaker links.

#### Scenario 2A: Scope Expansion via Template Chaining
```
Setup:
- acme owns "patch_files" (scope: {module: "auth"})
- widgets owns "deploy_service" (scope: {module: "auth", environment: "staging"})
- acme federates with widgets, can execute widgets' templates

Attack:
1. acme creates goal: "fix auth bugs" (scope: {module: "auth"})
2. acme's slot-binding uses widgets' "deploy_service" as producer
3. CC1 check: {module: "auth", environment: "staging"} ⊃ {module: "auth"}?
4. YES → scope expanded → should reject
5. BUT: If widgets' template doesn't enforce CC1 strictly, it executes
6. Risk: acme's goal unintentionally escalated to staging environment
   (could deploy untested code to staging in production context)
```

**Phase 1 Risk:** LOW — no cross-account composition  
**Phase 2 Risk:** CRITICAL without CC1 — scope widening via weak link  
**Mitigation:** CC1 hard enforcement at composition dispatch + SurrealDB ASSERTION

#### Scenario 2B: Privilege Escalation via Federated Template
```
Setup:
- metabob_system owns "grant_authority_key" activity
- acme has developer role on shared project with metabob_system
- acme should NOT have authority to grant keys

Attack:
1. acme invokes metabob_system's "grant_authority_key" template
2. If template doesn't validate invoker is authority-holder, it executes
3. acme gains authority-key capability they shouldn't have
4. acme can now sign scope attestations (H3) on behalf of metabob_system
5. Risk: escalated privileges, can create goals with arbitrary scope

Root cause: Authority-key provisioning (H4) assumes invoker is already authority-holder.
Federation breaks that assumption.
```

**Phase 1 Risk:** MEDIUM — authority-keys not passed to federation, but unclear  
**Phase 2 Risk:** HIGH — composition enables invoking sensitive templates  
**Mitigation:** Authority-key account scoping (Ph2-3) + validate template caller credentials

---

### Family 3: Authority-Key Privilege Escalation Across Accounts

**Threat Model:** Account A (which is metabob_system member with authority-keys) uses those keys on Account B's resources, or extracts keys from leaked impulses and forges signatures.

#### Scenario 3A: Variant Promotion via Authority Key
```
Setup:
- alice@metabob_system has authority_keys in JWT
- widgets account federates with acme
- alice is member of both metabob_system and widgets
- acme owns "summarize_code" activity

Attack:
1. alice creates variant of acme's activity (she has developer role)
2. alice promotes her variant to baseline using metabob_system authority_keys
3. SurrealDB constraint should check: is alice authorized for acme's account?
4. Current gap: authority-keys in JWT don't have account scoping
5. alice's variant becomes immutable baseline for acme
6. Risk: acme loses control of their activity evolution
```

**Phase 1 Risk:** LOW — authority-keys not delegated to federation  
**Phase 2 Risk:** HIGH — federated composition enables calling sensitive activities  
**Mitigation:** Authority-key account scoping (Ph2-3)

#### Scenario 3B: Scope Attestation Forgery via Shared Authority Key
```
Setup:
- authority_key_aum_2026_p1_master is issued to metabob_system
- acme federates with metabob_system, gets read access to traces
- acme admin (bob) has visibility to metabob_system traces

Attack:
1. bob extracts the authority key from a trace log or error message
2. bob uses the key to sign a scope attestation for expanded goal
3. Attestation appears valid (correct signature)
4. Downstream services accept it as proof of authority
5. Risk: forged attestations, arbitrary scope escalation

Current gap: Authority-keys embedded in lifecycle impulses (per CLAUDE.md F-44).
If impulses are visible in traces, keys leak.
```

**Phase 1 Risk:** MEDIUM — impulse visibility not specified  
**Phase 2 Risk:** HIGH — expanded trace sharing enables key extraction  
**Mitigation:** Remove keys from impulses (H3) + authority-key account scoping (Ph2-3)

---

## Federation Constraints

Five constraints enable safe federation by limiting the attack surface:

### FC-1: Federation is Account-Scoped

**Constraint:** Federated access to projects grants roles to **accounts**, not individual users. All widgets users get the same role on acme's project.

**Rationale:** Prevents individual privilege creep; simplifies RBAC; audit trail is at account level.

**Implementation:** User-vessel federation endpoints accept `account_id`, not `user_id`. JWT claims carry both.

**Validation:** User B with viewer role cannot perform developer actions even if another user in B's account has developer role.

---

### FC-2: Federation Links Are Immutable

**Constraint:** Federation links persist until explicitly revoked. Only the role can change. No accidental revocation.

**Rationale:** Clear audit trail; prevents cascading privilege loss from a single revocation mistake.

**Implementation:** DELETE endpoint exists; role UPDATE exists; link unchanged in other mutations.

**Validation:** Revocation is logged with timestamp and actor; re-invitation requires explicit operator action.

---

### FC-3: Federation Learning Is Opt-In

**Constraint:** By default, federated traces do NOT feed the Thompson Sampling learning loop. Accounts explicitly opt-in via `share_learning` flag on federation link.

**Rationale:** Prevents surprise posterior poisoning; gives accounts control over competitive intelligence sharing.

**Implementation:** `federation_link.share_learning: boolean` (default false). Thompson update filters by the flag.

**Validation:** Changing the flag changes which traces are included in learning-loop deltas.

---

### FC-4: Authority Keys Are Non-Delegable

**Constraint:** Authority-keys are bound to issuing account. User with keys in metabob_system cannot use them on acme resources.

**Rationale:** Prevents cross-account privilege escalation; matches the authority-key model (H4).

**Implementation:** JWT `authority_keys` array carries `{id, account_id}`. Validator checks: `key.account_id === target_resource.account_id`.

**Validation:** Attempting to use metabob_system key on acme resource returns 403 Unauthorized.

---

### FC-5: High-Risk Shape Dispatch Requires Approval

**Constraint:** If Account A's activity produces high-risk shapes (per `toolRiskProfile`), Account B must explicitly approve before A's activity can be composed into B's goals.

**Rationale:** Prevents scope widening via risky template chaining; gives accounts control over which external shapes enter their composition graphs.

**Implementation:** `create-shape-provider-goal` checks `toolRiskProfile` of invoked template; escalates to HiL or explicit approval if risk score exceeds threshold.

**Validation:** Risk threshold TBD on canary; audit log records approvals and denials.

---

## Phase 1: Read-Only Federation (Safe as Specified)

### What Phase 1 Enables

1. Project-level federation: Account A invites Account B to project P
2. Role-based access: Account B gets developer/viewer role on P
3. Activity discovery: Account B can see Account A's templates on P
4. Execution trace access: Account B can view traces from P (subject to visibility filtering)
5. Execution of federated templates: Account B can execute Account A's templates on P

### What Phase 1 Does NOT Enable

1. Cross-account composition: Account A's goals cannot decompose into Account B's templates
2. Shared learning: Thompson Sampling is account-scoped; federated traces visible but not fed to learning loop
3. Cross-account mutations: Account B cannot edit Account A's templates
4. Cross-account authority: Account B cannot use authority-keys, delegation links are not authority-bound

### Phase 1 Threat Assessment

| Attack | Risk | Reason |
|--------|------|--------|
| Posterior poisoning (Family 1) | LOW | Thompson Sampling not federated; traces visible but learning loop account-scoped |
| Scope widening (Family 2) | LOW | No cross-account composition; scope narrowing cannot be bypassed |
| Authority escalation (Family 3) | LOW | Authority-keys not delegated; sensitive templates cannot be invoked |
| Template mutation | LOW | Federated accounts cannot edit templates, only execute |

**Verdict: Phase 1 is SAFE. Proceed with implementation.**

### Phase 1 Success Criteria

- Trace visibility filters deployed (private/federated/public)
- RBAC enforced on all activity-api endpoints
- Federation endpoints tested (invitations, acceptance, revocation)
- Audit logging in place for all federation operations
- Account isolation verified (zero cross-tenant leakage in integration tests)
- Canary validation: 100+ federated-account scenarios executed with zero security violations

---

## Phase 2: Cross-Account Composition (Requires Hardening)

### What Phase 2 Enables

1. **Cross-account composition:** Account A's goals can decompose into Account B's templates
2. **Shared learning (opt-in):** Federated traces can feed learning loop if account opts in via `share_learning` flag
3. **Recursive shape provisioning:** `create-shape-provider-goal` can dispatch to federated account's templates
4. **Multi-account activity chains:** Activities from A, B, C compose in sequence with Thompson Sampling across the chain

### What Phase 2 Requires (Hard Prerequisites)

#### Requirement Ph2-1: CC1 Hard Enforcement (Scope-Narrowing)

Every cross-account template invocation MUST validate scope narrowing:

```typescript
// In create-shape-provider-goal, when dispatching a federated template:
const parentScope = goal.scopeContext.dimensions
const federatedTemplate = discoveredTemplate  // Account B's template

// Fetch the template's declared output_scope_max
const templateScope = await activityApi.getTemplate(federatedTemplate.id)
const declaredOutputShapes = templateScope.output_shapes
const parentOutputShapes = goal.endpoint_output_shapes

// Enforce: child's output shapes ⊆ parent's endpoint shapes
for (const shape of declaredOutputShapes) {
  if (!parentOutputShapes.includes(shape)) {
    throw new ScopeNarrowingViolation(
      `Federated template ${federatedTemplate.id} declares output shape '${shape}' 
       not in parent scope. Parent: [${parentOutputShapes.join(', ')}]`
    )
  }
}

// Enforce: child's scope ⊆ parent's scope (per H3/CC1 structural narrowing)
const valid = verifyScopeNarrowing(parentScope, templateScope.scope_context)
if (!valid) {
  throw new ScopeNarrowingViolation(...)
}
```

**Implementation:** Add SurrealDB ASSERTION at trace insertion to prevent out-of-scope records even if the runtime check fails. Paired with executor-level `verifyScopeNarrowing` check at composition dispatch time.

**Validation:** Scope violations < 1% of cross-account compositions before Phase 2 launch.

---

#### Requirement Ph2-2: H1 Two-Sided Traces (Posterior Verification)

Before federated traces feed learning loop, both executor and invoked vessel MUST sign their view of the execution. The pairing job detects discrepancies (one-sided lies get downweighted).

```typescript
// In execution-traces.ts, update Thompson deltas:
if (trace.verified_cross_sign !== true) {
  // Skip Thompson update for unverified traces
  // Trace recorded, but posteriors unchanged
  return
}

// Only verified traces update learning loop
recordThompsonDelta(trace.activity_id, trace.outcome, delta)
```

**Implementation:** Activity-api already tracks `verified_cross_sign: boolean` per H1 spec. Enable the filtering gate before Phase 2 launch.

**Validation:** Discrepancy rate < 5% of cross-account executions; pairing job matches 98%+ of traces within 5 seconds.

---

#### Requirement Ph2-3: Authority-Key Account Scoping

Authority-keys in JWT MUST include account scope. Validators MUST check: `key.account_id === target_resource.account_id`.

```json
{
  "account_id": "acme",
  "authority_keys": [
    { "id": "aum_2026_p1_master", "account_id": "metabob_system" },
    { "id": "aum_2026_q2_second", "account_id": "metabob_system" }
  ]
}
```

**Implementation:** Identity-vessel JWT encoder extends `authority_keys` structure. Activity-api sensitive operations validate scoping.

**Validation:** Attempting to use metabob_system key on acme resource returns 403; audit log records all attempts.

---

#### Requirement Ph2-4: Trace Visibility Access Control

Federated accounts can see traces on shared projects, but sensitive fields must be filtered:

```typescript
// In execution-traces GET endpoint:
if (requester.account_id === trace.owner_account_id) {
  // Can see everything
  return trace
} else if (hasProjectAccess(requester, trace.project_id)) {
  // Can see federated visibility traces, filtered fields
  return {
    id: trace.id,
    activity_id: trace.activity_id,
    status: trace.status,
    output_shapes: trace.output_shapes,
    // Omit: impulse_resolutions (leaks resolver strategy)
    // Omit: tool_calls (exposes implementation details)
    // Include: failure_mode (enables learning, not implementation)
  }
} else {
  // Cannot see
  return 403 Forbidden
}
```

**Implementation:** Add visibility-level filter in activity-api GET handlers. Federated = public fields only.

**Validation:** Account B cannot read Account A's resolver IDs, latencies, or tool arguments from shared-project traces.

---

### Phase 2 Success Criteria

- H1 deployed and verified (discrepancy < 5%, pairing > 98%)
- CC1 enforced at composition dispatch + SurrealDB ASSERTION (violations < 1%)
- Authority-key account scoping implemented and tested
- Trace visibility filters in place and tested
- End-to-end integration: 100+ cross-account scenarios executed with zero policy violations
- Posterior isolation verified: federated traces do not leak account B's failure patterns to account A when `share_learning` is false

---

## Interaction with Existing Hardenings

### H1 (Two-Sided Traces)

**Federation-specific requirement:** H1's discrepancy detection must account for federated context. When trace is executed in account A's context but invokes account B's template, both A and B's account_id must appear in the pair.

**Modification to H1:** Pairing job checks: `(executor.account_id, invoked.account_id, outcome_match)` tuple, not just `(executor.account_id, outcome_match)`.

**Implementation:** `repos/metabob-activity-api/src/jobs/pairing-job.ts` extended for multi-account tuples.

---

### H2 (Vessel Identity via Multihash)

**Federation-specific requirement:** Vessel registration includes account_id so discovery-vessel can scope vessel capabilities by account.

**Modification to H2:** Discovery-vessel stores `{vessel_id_hash, account_id, ...}`. Queries filter by account_id when needed.

**Implementation:** Discovery-vessel registration payload extended with `account_id` (sourced from issuing account's identity).

---

### H4 (Authority-Key Attestation & AUM)

**Federation-specific requirement:** AUM attestation MUST validate that the issuer's account_id matches the target resource's account_id.

**Modification to H4:** Before issuing AUM entry, verify: `aum_entry.issuer.account_id === resource.account_id`.

**Implementation:** AUM validation logic in identity-vessel checks account scoping.

---

### CC1 (Scope Narrowing)

**Federation-specific requirement:** Scope narrowing MUST be enforced at cross-account composition dispatch, not just at activity design time.

**Modification to CC1:** Execute-time check (this spec's Ph2-1) is the primary enforcement for federation. Activity-design-time check remains for single-account safety.

**Implementation:** `activity.ts` composition dispatcher (Phase 7.3) calls `verifyScopeNarrowing(parentGoal.scopeContext, federatedTemplate.scopeContext)` before nested execution.

---

## Risk Cascade Analysis

### H1-Bypass Attack in Federation Context

**Scenario:** Account A creates malicious activity and calls Account B's template. A reports success, B reports failure. H1 pairing job detects discrepancy... but A and B are both on federated project P. Does P's trust score drop instead of A's?

**Root cause:** H1's pairing assumes executor and invoked-vessel are the only parties. Federation introduces a third party.

**Mitigation (enabled by FC-3):** Federated traces only feed learning loop if `share_learning: true`. By default, federated traces are recorded but excluded from posterior updates. No learning on unverified traces.

**Implementation:** Thompson update gate checks `is_federated_trace AND !federation_link.share_learning` → skip update.

---

## Phase 1 vs Phase 2 Comparison

| | Phase 1 (Read-Only) | Phase 2 (Composition) |
|---|---|---|
| **What's enabled** | Template discovery, trace visibility, RBAC, execution | Cross-account composition, child goals in federated templates, learning sharing |
| **Learning loop** | Account-scoped; federated traces visible but not fed | Opt-in sharing; H1 verification required before update |
| **Scope enforcement** | None needed (no composition) | CC1 hard enforcement + SurrealDB ASSERTION |
| **Authority keys** | Not delegated | Scoped by account_id |
| **Risk level** | LOW | CRITICAL without H1+CC1 |
| **Hardening required** | NONE | H1 + CC1 + Ph2-3 + Ph2-4 |
| **Timeline** | Ready now | 4-6 weeks after hardening |

---

## Recommended Scenario for Phase 2

**Scenario C (Asymmetric Learning)** is recommended for Phase 2 launch:

- Account A can invoke Account B's templates in compositions
- Learning updates are ALWAYS unidirectional: A learns from B's outcomes, B does not learn from A
- B's posteriors remain locked (immutable baseline variant required per H5)
- A can observe B's success rate but cannot drive B's Thompson Sampling changes
- Rationale: Prevents posterior poisoning while enabling collaborative composition

**Implementation:** `federation_link.share_learning: boolean` defaults to `false`; toggle only enables bidirectional learning. Initial deployments always have `false`.

---

## Out of Scope

- **H2, H3, H4 full implementation** — referenced for completeness; their full specs live in `openspec/changes/2026-04-26-security-hardening-findings/`
- **Scenario C detailed implementation** — enumerates requirements; actual code lives in sibling specs
- **Audit logging schema details** — owned by `openspec/changes/2026-04-28-activity-api-account-id-migration/`

---

## References

**Threat modeling source:**
- `FEDERATION_SECURITY_REVIEW_2026_04_28.md` (full attack surface analysis)
- `FEDERATION_SECURITY_SUMMARY.md` (executive summary)

**Related specifications:**
- `openspec/changes/2026-04-26-impulse-activity-loop/` (this umbrella)
- `openspec/changes/2026-04-26-shape-provider-goal-creation/` (cross-account composition)
- `openspec/changes/2026-04-26-security-hardening-findings/` (H1, H2, H4, CC1)
- `openspec/changes/user-vessel-accounts-federation-model/` (federation design)
- `openspec/changes/identity-vessel-account-id-upgrade/` (account JWT claims)
- `openspec/changes/2026-04-28-activity-api-account-id-migration/` (account-scoped storage)

---

## Validation Gates

### Phase 1 Launch Gates (all must pass)

- [ ] Trace visibility filters deployed and tested (private/federated/public)
- [ ] RBAC enforced on 30+ activity-api endpoints
- [ ] Federation endpoints live (invitations, acceptance, revocation, role update, audit logging)
- [ ] Canary validation: 100+ federated scenarios executed zero security violations
- [ ] Account isolation verified: Account B cannot read Account A's private traces even on shared project

### Phase 2 Launch Gates (all must pass)

- [ ] H1 deployed and validated (discrepancy < 5%, pairing > 98%)
- [ ] CC1 enforced at composition dispatch + SurrealDB ASSERTION (violations < 1%)
- [ ] Authority-key account scoping tested and working
- [ ] Trace visibility filters prevent resolver/cost/tool-call leakage
- [ ] Scenario C scenario tested end-to-end (100+ compositions, no posterior contamination)
- [ ] Posterior isolation verified: federated traces with `share_learning: false` do not update Thompson
