# Substrate traceable self-merge v3 — refusal reasons land in failure_mode

**Version:** 2026-06-01T20-21-05Z-substrate-traceable-self-merge-v3-development-vessel

The previous v2 attempt (PR #16) saw the composition's merge_pr task return shape=evaluationInsufficient — a soft refusal that the engine recorded as task-success because the proxy only flagged structuredError as failure. The trace was technically complete but didn't tell the operator WHY the refusal happened.

v3 hardens this: gh_pr_merge returns structuredError with failure_mode=verifier_negative when evaluation evidence is missing or below threshold. The trace's failure_mode field now carries the reasons array, the raw evidence preview, and the configured floors. Reading the trace is sufficient to know WHY the substrate refused (or proceeded) to merge.

If this PR merges, the trace shows 6 successes ending in gh_pr_merge producing prMergeResult.
If this PR refuses, the trace shows tasks 1-5 success + task 6 failure with failure_mode in the trace body.

Either outcome satisfies the operator's milestone criterion: tell us WHY from the trace.

Substrate-Authored-By: substrate-live
