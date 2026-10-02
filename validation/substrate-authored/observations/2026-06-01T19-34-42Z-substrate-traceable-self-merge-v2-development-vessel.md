# Substrate self-merge with traceable composition (v2)

**Version:** 2026-06-01T19-34-42Z-substrate-traceable-self-merge-v2-development-vessel
**PR:** to be opened by publish composition; to be merged by evaluate-pr-via-internal-idioms (6-task chain ending in gh_pr_merge)
**Cited commits:** a91a4bbd (substrate's self-trust discovery), 26c532ee (substrate's first traceable self-merge via probe), 84a04f44 (first 7/7 goal-host composition)

This artifact exists to test that the substrate's evaluate-pr-via-internal-idioms composition can produce evaluation_evidence in a TRACE and feed it directly into gh_pr_merge as the next task in the same trace. The previous attempt (PR #15) was merged via operator-side direct gh_pr_merge probe, not via the composition's merge_pr task — partial milestone.

If this PR is merged, the trace will show 6 tasks: fs_read, phantom_trace_scan, precondition_rejection_scan, llm_completion_dispatch (comprehensibility), llm_completion_dispatch (synthesis), gh_pr_merge. Each task's output_impulse_ids ties to the impulse store. Operator can walk from merge commit → super-repo dev log → execution trace → per-task verdict.

Substrate-Authored-By: substrate-live
