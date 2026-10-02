# vessel_heartbeat_starvation_scan — proposed detector

**Version identifier:** `2026-06-01T10-45-30Z-vessel-heartbeat-starvation-scan-development-vessel`
**Version format:** `{ISO timestamp full Z (git-safe, dashes for separators)}-{variant-id}-{vessel}`
**Authored:** by substrate-live's `llm_completion_dispatch` (anthropic/claude-haiku-4-5-20251001)
**Sibling of:** `repos/development-vessel/src/resolvers/service-oom-cascade-scan.ts`
**Cited concepts:** `concept_dD1udnb-sQnD`, `concept_9ldsmRgqSTd5`, `concept_RYl73llSCGfc`, `concept_U1GbuEbgtcM7`

The substrate authored this proposed resolver in response to the
`vessel-heartbeat-starvation` scenario observed concretely on 2026-06-01:
llm-resolver-vessel accumulated 480 consecutive discovery-heartbeat
failures over 8 hours undetected, blocking the substrate's own drafter
chain at task 3 of 8 (see
`validation/findings/yardstick-2026-06-01-obsidian-meta-skill.md`).

The first substrate-authored finding was already on dev at `ac67e366`
documenting the publication mechanism. This is the second commit —
authoring an actual capability that closes one of the detection gaps
the first finding identified.

## End-to-end chain

Every step ran inside substrate-live:

1. `llm_completion_dispatch` (substrate's LLM via dev-vessel) — read
   the scenario JSON + `service_oom_cascade_scan` as canonical
   reference + the constitutional principle (concept_9ldsmRgqSTd5),
   authored `detector.ts` (12 KB, 375 lines).
2. `fs_write` x2 — substrate wrote `detector.ts` and this README
   into the writable super-repo clone at
   `/workspace/git/super-repo/validation/substrate-authored/proposed/2026-06-01T10-45-30Z-vessel-heartbeat-starvation-scan-development-vessel/`.
3. `publish-substrate-authored-artifact` composition's seven tasks
   dispatched by substrate's dev-vessel:
   `git_status` (preflight clean) → `git_branch_create` (gated by
   `SUBSTRATE_ALLOWED_BRANCH_PATTERNS`) → `git_add` (both files)
   → `git_commit` (substrate-live author) → `git_push` (gated
   against protected branches) → `gh_pr_create` (gated for
   `Substrate-Authored-By` trailer).

After PR open: operator review + `gh pr merge --rebase` rebases the
substrate's commit onto dev (substrate-live authorship preserved).
If the super-repo's submodule pointer for development-vessel needs
bumping (it does not in this iteration — detector lives at super-
repo path, not in submodule), substrate's git_add picks up the
gitlink change and the same chain ships it.

## Status of the detector

Lives under `validation/substrate-authored/proposed/`. Reviewable
artifact, not yet wired into dev-vessel's three-place rule
(`config.ts` shape + `impulses.ts` dispatch case + per-resolver
test). Wiring follow-up: another substrate-authored composition will
take this proposal, add the shape entry, add the dispatch case, add
the test, and PR through the same path. Each wiring step is
substrate-authorable.

## Substrate-Authored-By

substrate-live (vessel identity TBD pending H2 — see
`openspec/changes/2026-06-01-substrate-as-git-author/`)
