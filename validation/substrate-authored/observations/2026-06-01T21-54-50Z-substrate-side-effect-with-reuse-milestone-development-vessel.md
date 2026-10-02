# Side-effect development WITH reuse — fully observable milestone

**Version:** 2026-06-01T21-54-50Z-substrate-side-effect-with-reuse-milestone-development-vessel
**Trigger:** goal-host cf0fea3a (auto-draft on low-confidence recommend)
**Reuse trace:** exec_tldlql4z

## What this commit demonstrates

Two operational goals dispatched in succession with NO targetTemplateId and no use of the word "develop". The substrate decided what to do based on existing-catalogue fit:

### Goal 1 — no fit → substrate autonomously authored

- **Goal text:** "compute vessel-pair handshake latency p99 across the substrate fleet"
- **Recommend response:** 0 candidates (top_score=0)
- **Goal-host log:**
  ```
  [goal-host-vessel] auto-draft pre-recommend OK for goal="compute vessel-pair handshake latency p99 across the substra"
  [goal-host-vessel] auto-draft trigger: goal="..." top_score=0 < 2
  [goal-host-vessel] auto-draft: scenario auto-1780350731468-hpr6cd.json written; dispatching draft-gap-closing-activity
  [goal-host-vessel] auto-draft: drafter completed for scenario auto-1780350731468-hpr6cd
  ```
- **Drafter trace exec_ismvwtia:** 5 tasks success (read_report, read_scenario, prime_substrate_concepts, prime_substrate_edges, draft_via_llm). Output shapes include `draftedTemplate` — the substrate's LLM produced a candidate. Tasks 6-14 (write_proposal, register_variant, etc.) didn't fire; that's task #127 follow-up.

### Goal 2 — substrate-authored template fit → REUSE without authoring

- **Goal text:** "detect silent semantic failures where tasks report success but produce no useful output"
- **Recommend selected:** `activity:⟨gap-closing:fp-15-missing-producer-stale-registration-1780325042966⟩` — a substrate-authored template from a prior drafter cycle
- **Trace exec_tldlql4z:** 8151ms, 4 tasks success, output shapes `[fs_read, http_fetch, llm_completion_dispatch, fs_write]`
- **Auto-draft did NOT fire** for this goal — pre-recommend returned a top candidate above threshold, so the autoDraft function early-returned. The substrate reused its own prior authoring.

## How this is observable from the dev log

Walking the audit from this commit (the version identifier in the commit headline carries the timestamp prefix):

1. Read this finding for the references.
2. Query `/v2/activities/execution-traces/exec_tldlql4z` to see the substrate-authored template that was reused.
3. Query `/v2/activities/templates/activity:⟨gap-closing:fp-15-missing-producer-stale-registration-1780325042966⟩` to inspect the template the drafter authored in a prior cycle.
4. Query `/v2/activities/execution-traces/exec_ismvwtia` to see the most recent drafter dispatch (the one triggered by Goal 1 above).
5. Check `scripts/substrate/workspace/validation/failure-modes/scenarios/auto-1780350731468-hpr6cd.json` for the autonomous synthesized scenario.

Each artifact links to the next. No external tooling needed.

## How this exemplifies the operator's directive

The operator's stated criterion (paraphrased):
- Substrate adds new vessels/resolvers/activities AS A RESULT of trying to do something else
- Only when required
- Reuses anything that gets created for related objectives

What we showed:
- Goal 1 was a request for capability the substrate didn't have. Substrate noticed (via recommend score < threshold) and authored a candidate.
- Goal 2 was related to capability the substrate HAS authored. Substrate reused it.
- Neither goal said "develop". The trigger and the reuse decision both lived inside goal-host and activity-api's recommend.

The operator's role narrowed to dispatching domain goals; substrate decided when to author and when to reuse based on its own measurement of its catalogue's fit.

Substrate-Authored-By: substrate-live
