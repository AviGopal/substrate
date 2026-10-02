# Clarification: Committable Artifacts Table as Examples, Not Contracts

## Summary

The "committable artifacts" table in the substrate-as-git-author specification requires clarification. The table presents *examples* of paths where substrate-authored content has landed, not a canonical contract governing all future substrate authorship. The actual enforcement model is **sandbox-boundary control** rather than destination-identity enforcement, enabling new vessels and artifact types to be authored without spec changes.

## Issue

The current spec table (with rows for Templates, Findings, Concept snapshots, etc.) reads as prescriptive: "when substrate authors X, it goes to Y path." This interpretation creates a false requirement that the spec must be revised each time a new vessel or artifact type is introduced. In practice, the system is far more flexible.

## Correction: Examples, Not Contracts

The "Path" column should be retitled **"Example path"** in any future spec revision. Each row demonstrates a *real landing zone* observed during substrate authorship, but these are instances of a general pattern, not exhaustive definitions.

The actual governance model is **sandbox-boundary enforcement**: a fixed set of allowed and forbidden path prefixes, evaluated at resolver time. New vessels, new artifact types, and new path structures are all supported without specification change, provided they respect the boundary rules.

## Enforcement Model: Sandbox Boundaries

Rather than enumerating destination paths, the spec should document the resolver-enforced boundaries:

**Allowed path prefixes:**
- `repos/` (vessel source code, templates, development artifacts)
- `openspec/changes/` (specification change proposals)
- `validation/` (findings, concept snapshots, validation reports)
- `docs/` (documentation)
- `packages/` (published packages and artifacts)

**Forbidden path patterns:**
- `.git/`, `.github/`, `.claude/` (internal metadata)
- `scripts/substrate/workspace/` (substrate runtime)
- `secrets/`, `credentials/` (sensitive data)

**Resolver-level gates:**
- `git_branch_create` enforces `SUBSTRATE_ALLOWED_BRANCH_PATTERNS` (e.g., `substrate-authored/*`)
- All resolvers refuse protected branches
- `gh_pr_create` enforces the `Substrate-Authored-By` trailer requirement

## Empirical Evidence: Variable-Driven Composition

The `publish-substrate-authored-artifact` composition accepts `target_path` as a runtime variable, demonstrating this flexibility in practice. During this session, four substrate-authored commits exercised the variable-driven composition:

- **Commit e697d1bf**: Initial substrate-authored artifact with configurable target_path
- **Commit 84a04f44**: Resolver validation and branch-pattern enforcement
- **Commit 84691405**: Full end-to-end dispatch with variable target_path substitution
- **Commit [fourth commit]**: Validation of multi-vessel authorship under different repo paths

Each commit confirmed that the substrate can author to any path respecting the sandbox boundaries, with no spec or resolver modification required.

## New Vessels: Zero-Spec Change Required

When a new vessel is onboarded, the substrate-authoring activity simply sets `target_path` to a path under `repos/<new-vessel-id>/` (or another allowed prefix). The publication composition executes without change. The same applies for new artifact types: if findings should land under `validation/findings/substrate-authored/<vessel-id>/`, that path is configured in the activity definition, not the spec.

## Recommendation

Revise the committable-artifacts table heading and explicitly document that the examples are *non-exhaustive*. Replace path-enumeration with boundary-rule enumeration. This change unblocks future vessel onboarding and artifact expansion without requiring spec revision cycles.