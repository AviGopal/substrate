# Validation Findings

Files in this directory are field reports — substrate observations, operator
probes, and validator narrations — that don't fit the structured `investigations/`
or `dev-responses/` formats.

## Provenance protocol (per F-131, inv-055)

Per audit F-131 (reclassified MEDIUM in inv-055, 2026-05-27): files in this
directory claim authorship in their YAML frontmatter (`agent: operator`,
`agent: validator`, etc.) but those claims are **unverifiable without a backing
git commit** from the named author's signed identity. Substrate processes can
write any file with any frontmatter.

To make a probe **verifiable as operator-authored**, the operator must:

1. Author the file locally with the desired `agent:` frontmatter.
2. Commit it via `git commit -s -m "operator: <description>"` using their
   personal signed identity (e.g. `avigopal.aero@gmail.com`), NOT the
   substrate's `devbob` identity.
3. Push the commit. The signed commit-history entry becomes the durable
   provenance.

Without that, the file should be treated as **unverified** — readable, useful
for context, but not authoritative as a coordination-protocol input.

## Existing files

| File | Authored | Verifiable? | Notes |
|---|---|---|---|
| `operator-probe-2026-05-27-application-question-answering.md` | 2026-05-27T03:30Z (frontmatter claim) | **NO** — file is untracked in git, no operator-signed commit. Dev-response-007 (iter 14, commit dfbc587) acknowledged it but the acknowledgment cites the file's frontmatter not a signed commit. | The file's *substance* (Disrupt-application gap → no producer for `answeredApplication`) is internally consistent and the resulting refusal-guard work (iter 8, 14) is correct regardless of authorship. The provenance gap means future audits should not treat this single file as authoritative evidence of operator intent. |
| `iter-*-narration.md` | validator (audit-loop) | per-file (depends on git commit) | Validator narrations are typically committed; check `git log` for each. |
| `dev-guidance-*.md` | dev session | per-file | Same. |

## What this directory should hold (forward-looking)

After F-131:

- **Operator probes**: only files committed by the operator's signed identity. Files written by substrate processes claiming `agent: operator` are unverifiable and should be moved to `validation/unverified/` or annotated with `provenance: unverified` in their frontmatter.
- **Validator narrations**: committed as part of the audit-loop's own commit history.
- **Dev guidance**: committed as part of dev-session commits (named `dev-guidance-<date>.md`).
- **Field reports**: anything else (incident postmortems, ad-hoc probes, etc.).

The frontmatter `agent:` field is a *self-description claim*. Provenance is the
git history. When the two conflict, trust git.

## F-number namespace collisions (F-140, inv-056)

Two independent agents — the **substrate dev process** (this directory's
authors of `dev-response-*` files) and the **audit chain** (authors of
`investigations/`) — both file findings using `F-<num>` identifiers and both
increment independently. Three confirmed collisions to date (F-129, F-130,
F-139 between substrate-side and audit-side numbering).

**Protocol to avoid collision going forward**:

| Range | Owner | Notes |
|---|---|---|
| `F-001` – `F-099` | **audit chain** (primary auditor + opus-iter auditors) | Audit agents continue here as they have been. |
| `F-100` – `F-199` | reserved — see existing usage; current open: F-101 (structural), F-140 (this protocol), F-141 (no remote) | Mixed historical assignments. Treat as read-only; do not allocate new numbers here. |
| `F-200` – `F-299` | **substrate dev process** (this dev session and future devbob iterations) | All new substrate-self-authored findings start at F-200. |
| `F-300` – `F-399` | **operator-filed findings** (committed by `avigopal.aero@gmail.com`) | Operator probes that are filed as findings rather than ad-hoc files. |
| `F-V*` series | **validation harness** (`validation/scripts/*`) | Already in use; harness-machine-generated. |

When an existing F-number is referenced in a dev-response or investigation, it
keeps its original number regardless of owner — the protocol only governs new
allocations. Both audit and dev chains must check this README before allocating
to confirm the next free number in their owned range.

**Why ranges, not prefixes**: prefixes like `audit-F-1` would require migrating
every existing reference in commits, dev-responses, and investigations. Ranges
let existing F-numbers keep their identity while structurally preventing future
collisions.
