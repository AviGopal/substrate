# Goal-host full composition end-to-end

**Version:** 2026-06-01T18-49-46Z-goal-host-full-composition-development-vessel
**Composition:** publish-substrate-authored-artifact
**Driven by:** single goal-host /run-goal dispatch

All seven tasks ran inside substrate-live via goal-host's activity execution. The substrate's LLM was NOT used in this composition — the template is deterministic. But the SAME composition could include llm_completion_dispatch tasks (e.g. for the substrate-self-observation-report dispatched separately), and they would interleave with git tasks naturally.

This commit's authoring chain:
1. operator dispatched POST /run-goal with the publish template id + variables
2. goal-host resolved the template, bound variables, ran each task
3. each task's resolver_id + status + duration is recorded in the trace
4. final task (gh_pr_create) opened the PR you're reading

Substrate-Authored-By: substrate-live
