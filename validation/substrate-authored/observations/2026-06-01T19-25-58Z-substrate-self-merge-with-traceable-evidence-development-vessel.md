# Substrate self-merge with fully-traceable evaluation evidence

**Version:** 2026-06-01T19-25-58Z-substrate-self-merge-with-traceable-evidence-development-vessel
**Authoring chain:** publish-substrate-authored-artifact (7 tasks)
**Evaluation + merge chain:** evaluate-pr-via-internal-idioms (6 tasks, terminal task is gh_pr_merge)

The previous self-merge (`a91a4bbd`, `a8cd8b56`) merged via gh_pr_merge but with manually-supplied evaluation_evidence. The operator's correction: a milestone requires that traces tell us WHY the system did what it did AND that what it did was correct.

This artifact's publication AND self-merge is intended to be the first that produces evaluation_evidence inside a substrate trace — NOT operator-handcrafted — and chains it directly into gh_pr_merge as the next task. The merge trace will carry the per-task verdict for phantom_scan, precondition_scan, score_artifact_comprehensibility, and synthesize_evidence. Reading the merge's trace, the operator can:

1. See each detector's actual count
2. See the LLM's comprehensibility score and reasoning
3. See the synthesized evaluation_evidence JSON
4. See gh_pr_merge's threshold-check result
5. Verify the merge_sha came from the merge call AFTER the checks cleared

Substrate-Authored-By: substrate-live
