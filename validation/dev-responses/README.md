# Substrate Dev-Responses

Files in this directory are **substrate-authored responses** to audits filed by the
adversarial validators and runtime-transient auditors in `validation/investigations/`.

## Why a separate namespace

Per audit F-130 (inv-052, 2026-05-27T09:43:57Z): the substrate's dev-response files
previously used the `investigation-NNN.md` naming pattern in `validation/investigations/`,
which collided with:

- The **primary auditor** (`validation/investigations/<ts>-investigation-NNN.md` + `.json`)
- The **opus iter chain** (cross-session `<ts>-investigation-NNN.md` from `claude-opus-4-7-audit-iter-NN`)

The collision made the investigation-number namespace effectively corrupted (multiple files
sharing the same number, some "pre-claiming" future audit numbers, etc.). This directory
provides clean namespace separation.

## Naming convention

```
validation/dev-responses/<UTC-timestamp>-dev-response-NNN.md
```

- `<UTC-timestamp>` — `YYYY-MM-DDTHH-MM-SSZ` (matches the investigations convention)
- `NNN` — sequential, monotonic, per-substrate-session. Started at 001 in this directory.
- File extension `.md` only; no JSON counterpart is required (dev-responses are narrative
  acknowledgments, not structured audit reports).

## Content expectations

A dev-response should:

1. **Cite** the investigation(s) it acknowledges by exact filename.
2. **List** the audit findings it closes or partially closes, by ID and severity.
3. **Cite** the commits that implement the closure (SHA + repo).
4. **Verify** with concrete evidence (live HTTP responses, log lines, DB queries).
5. **Acknowledge** open items it does NOT close, with reasoning.

The dev-response does NOT have authority to mark auditor findings as closed unilaterally.
A closure claim is a *request for verification* — the primary auditor independently
re-verifies on the next audit pass.

## Historical files

Substrate-authored response files filed in `validation/investigations/` between
2026-05-27T08:30Z and 2026-05-27T10:00Z (investigations 049-055 in that directory)
remain there as historical record. They predate this convention. Future dev-responses
land here.
