# Substrate-as-development-side-effect — observation report

**Version:** 2026-06-01T19-06-17Z-substrate-as-development-side-effect-development-vessel
**Driven by:** two operator-issued goals dispatched through goal-host and the new LLM tool-use endpoint

After closing the queued bugs (#120 spec clarification, #121 LLM tool-use, #122 gh_pr_create config collision, #123 template variables persistence), the operator's directive shifted: watch substrate develop functionality AS A SIDE EFFECT of goal execution, not as the primary directive.

This report documents two substrate-driven actions that exercised the now-functional chain end-to-end.

## Goal 1 — recommend path observation

Dispatched: \ with goal "identify substrate vessels whose resource state needs operator attention right now" (no targetTemplateId — let recommend pick).

Selected template: \ (status: completed).

The recommend path's Thompson Sampling chose a gap-closing template — a substrate-authored activity from prior iterations. The substrate's own learning loop selected itself.

## Goal 2 — LLM tool-use observation

Dispatched: \ directly with one tool (\) and the prompt "read /workspace/git/super-repo/repos/llm-resolver-vessel/src/index.ts and propose a new tool to expose next."

Tool calls captured:

| iter | tool | input | duration |
|---|---|---|---|
| 1 | fs_read | /workspace/git/super-repo/repos/llm-resolver-vessel/src/index.ts | 2ms |


The LLM autonomously decided to use \, completed in one iteration, and produced this self-authored proposal:

> ## Summary

**Tool-use loop explanation:**
The tool-use loop iteratively calls Claude with a set of developer-provided tools. When Claude requests a tool (stop_reason = "tool_use"), the resolver dispatches it to a configured endpoint, collects the result, appends it to the message history, and re-calls Claude until it stops requesting tools or hits max iterations. This enables multi-step agentic reasoning with external action capabilities.

**Proposed new tool: `tool_cache`**
Expose a tool that allows the LLM to cache and retrieve previous tool call results by hash. This would reduce redundant

## What this enables

Future drafter dispatches can pass concept-db search tools, activity_recommend tools, comprehensibility_check tools, and let the LLM iterate without operator-side prompt-stuffing. The drafter becomes a single goal-host /run-goal dispatch instead of operator-orchestrated curl chains.

Combined with the publication composition (now end-to-end at 7/7 tasks), the loop is closed at the resolver layer: dispatch goal → Thompson Sampling picks template → engine runs each task → resolver-tier tools query the substrate state → LLM iterates → publication chain commits and PRs the output. Operator role narrows to dispatch + review.

This commit is itself an artifact of that loop.

Substrate-Authored-By: substrate-live
Version-Format: {ISO timestamp full Z (dashes)}-{variant-id}-{vessel}
