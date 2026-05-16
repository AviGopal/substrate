# Proposal: State-Space-Aware Template and Pointer Recommendations

**Change ID**: `2026-04-29-state-space-aware-recommendations`
**Status**: Draft
**Date**: 2026-04-29

---

## Problem Statement

Template recommendation is context-blind. `POST /v2/activities/recommend` ranks templates by Thompson Sampling posteriors alone, with no knowledge of what impulses the executor currently holds or what impulses it could resolve from the registered vessel registry. The result: a template requiring `concept` shape gets the same recommendation score regardless of whether concept-db is registered and ready to resolve it. A template requiring `activityExecutionTrace` is recommended even when no traces exist in the backend. Executors receive a ranked list of templates but no guidance on which impulses to load next to unlock the highest-value options.

## Solution

Extend `POST /v2/activities/recommend` to accept two optional state spaces: the executor's **impulse state space** (the set of impulses currently loaded in the executor's working memory) and the **pointer state space** (the set of shapes that could be resolved given the current vessel registry). The recommendation response is extended with two new result sets: **pointer recommendations** (which unresolved shapes to load next, ranked by the expected utility gain across top-N templates they would unlock) and **blocking shapes** (which missing shapes are gating the best templates and whether they are resolvable with current vessels). Template ranking applies a compatibility discount to templates whose required input shapes are not yet present in the impulse state space but are resolvable, and ranks last those templates whose inputs are unavailable from any registered vessel. Both new fields are optional in the request; when absent, existing Thompson Sampling behavior is fully preserved.
