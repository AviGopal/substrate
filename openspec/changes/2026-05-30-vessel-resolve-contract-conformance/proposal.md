# 2026-05-30 — Vessel /resolve Contract Conformance Probe

## Motivation

The impulse-resolver contract is the canonical cross-vessel dispatch path:
discovery-vessel routes by `pointer.type`, callers send
`{ impulse: { pointer: { type: "<shape>", ...fields } } }`, the receiving
vessel resolves and returns. Every modern caller — MCP-fronted tools
(`run_goal`, landed 2026-05-30), goal-host-vessel's dev-vessel proxy
resolvers, analysis-vessel's bridge observer — uses this form.

However, vessel `/resolve` handlers historically grew the form by
patching only what each caller needed. As of 2026-05-30, an audit shows:

- **goal-host-vessel**: detected `type` from `body.impulse.pointer.type`
  but read all other fields (`goal`, `variables`, `target_template_id`,
  `parent_execution_id`, `composition_chain`) ONLY from `body.*`.
  Compliant impulse-wrapper callers got HTTP 400 "goal or
  target_template_id is required". Patched 2026-05-30 by operator
  (concept: `vessel_resolve_handler_dual_form`).
- **concept-db** (`repos/concept-db/src/routes/impulses.ts`): reads
  `body?.pointer` with no fallback. Impulse-wrapper → HTTP 400.
  (concept: `concept_dIRm3TC4LwUr`)
- **llm-resolver-vessel** (`repos/llm-resolver-vessel/src/index.ts:80`):
  framework passes raw body, handler reads `ctx.body.prompt` directly.
  Impulse-wrapper → HTTP 200 `{resolved:false, error:"...prompt..."}`.
  (concept: `concept_dyHquRIpl8hR`)

The shared root cause — partial impulse-contract implementation — is
both a coordination smell (each vessel re-derives the parsing rule) and
a reliability hazard (the failure is silent at the wrapper-detection
level: shape is recognized, but the resolver runs against the wrong
body and returns a domain-shaped error that hides the real cause).

Operator-side hand-patching is the wrong mechanism. The substrate
should detect contract drift on its own and surface it as actionable
gap signal that the failure-mode autonomous loop
(`openspec/changes/2026-05-22-failure-mode-autonomous-loop`) can route
to `draft-gap-closing-activity` for variant proposal.

## Proposal

Add a development-vessel seed template **`verify-resolver-contract-conformance`** that:

1. Reads discovery-vessel's `vesselRegistry` to enumerate every vessel
   advertising `resolve_request_format: "pointer"`.
2. For each vessel + each shape it advertises, constructs a *probe pair*:
   - **A** — top-level form: `{ "type": "<shape>", ...synthetic minimal fields }`
   - **B** — impulse-wrapper form: `{ "impulse": { "pointer": { "type": "<shape>", ...same fields } } }`
3. POSTs both to the vessel's advertised `resolve_endpoint` and captures
   `{ http_status, response_body.shape, response_body.resolved,
   response_body.error }`.
4. Diffs A vs B:
   - **conformant**: both A and B reach the resolver (success OR resolver-level
     error). Specifically: status ≥ 200, and any error string does not
     match `/(missing|required).*pointer|(missing|required).*<field>/i`
     for a field present in the probe.
   - **drift**: A reaches the resolver but B returns a 4xx with a
     parsing-shaped error, OR A and B return different `resolved`
     verdicts on synthetic-valid input.
5. For each drifting (vessel, shape) pair, emits a `vesselContractDrift`
   impulse and writes a `substrateGap` impulse with body:
   ```json
   {
     "gap_class": "resolve_contract_partial_parse",
     "vessel_id": "<vid>",
     "shape": "<shape>",
     "probe_A": { ... },
     "probe_B": { ... },
     "fix_priors": ["concept_y-CPpfVcAhL0"]
   }
   ```
6. Returns a summary `vesselContractAudit` impulse with counts and
   drifting-vessel list.

The synthetic minimal fields are derived from the vessel's existing
`endpoint_input_shapes` declaration (when present) or — fallback — by
sampling one recent successful trace's input from
`executionTraceWithSignatures` filtered by the target shape.

### Substrate-side resolution path

`substrateGap` impulses with `gap_class: "resolve_contract_partial_parse"`
become input to `draft-gap-closing-activity`. With the fix-priors edge
to `vessel_resolve_handler_dual_form`, the drafter can:

- For non-framework cases (concept-db): propose a variant of the
  vessel's route file that replaces `body?.pointer` with
  `body?.impulse?.pointer ?? body?.pointer`.
- For framework cases (llm-resolver-vessel): propose either a per-handler
  normalization shim, or escalate by emitting an `iasExecutorPatchProposal`
  impulse (framework patches stay operator-authored — that's the seam
  between substrate-authored and operator-authored fixes).

### Scheduling

`verify-resolver-contract-conformance` joins the boredom-vessel goal
rotation as a low-frequency slot (e.g. one in N idle cycles), or runs
on demand. It is read-only against vessels (synthetic probes only) and
write-only to the substrate's own gap-impulse store.

## Out of Scope

- **Fixing the two known drift cases.** Per the autonomous-loop
  discipline, the substrate authors fixes via Thompson variant
  competition; operator review judges them. Hand-patching concept-db
  and llm-resolver-vessel today would short-circuit the very signal
  this proposal is trying to generate.
- **Generalizing to other contract dimensions** (auth header form,
  timeout, response shape, error envelope). Each is a separate
  conformance probe; collecting them all in one activity would couple
  unrelated drift classes.
- **Framework patch to `ias-executor-ts` ResolverServer** (centralized
  `ctx.pointer` normalization in `src/hosts/resolver-server.ts`). The
  framework patch is the cleanest fix but is operator-authored work on
  a published package and lives outside the substrate's authoring
  surface. The conformance probe surfaces the gap; the framework patch
  is a separate change scheduled on operator time.
- **Probing vessels that advertise non-`pointer` request formats**
  (e.g. future vessels using a different envelope). The probe filters
  on `resolve_request_format: "pointer"` and skips others.

## Success Criteria

1. `verify-resolver-contract-conformance` template registered in
   development-vessel's seed set, executable via
   `POST /v2/impulses/resolve { impulse: { pointer: { type: "verify_resolver_contract_conformance" } } }`.
2. Running it against today's substrate emits at least two
   `vesselContractDrift` impulses (concept-db, llm-resolver-vessel) and
   zero false positives against goal-host-vessel, analysis-vessel,
   local-tools-vessel, development-vessel (the known-conformant set).
3. The drift impulses' `fix_priors` field cites `concept_y-CPpfVcAhL0`
   so the autonomous loop's prior-reading path picks them up.
4. **Lift signal**: within K cycles after the probe lands,
   `draft-gap-closing-activity` proposes at least one variant for one
   of the two known drift cases without operator authoring. The
   variant need not be merged — the proposal itself counts.

## References

- `concept_y-CPpfVcAhL0` — vessel_resolve_handler_dual_form (parent
  rule)
- `concept_IsGiRuTMb-N0` — mcp_resolver_passthrough (downstream
  pattern that depends on the rule)
- `concept_dIRm3TC4LwUr` — concept-db drift evidence
- `concept_dyHquRIpl8hR` — llm-resolver-vessel drift evidence
- `openspec/changes/2026-05-22-failure-mode-autonomous-loop/` — the
  drafter this probe feeds
- `repos/goal-host-vessel/src/index.ts` handleResolve (the operator-
  authored fix shape that the autonomous drafter should reproduce
  per-vessel)
