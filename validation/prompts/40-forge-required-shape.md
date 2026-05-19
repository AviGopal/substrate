# Prompt 40: Required shape that no vessel produces (forge-eligible)

This prompt drives a user-level goal whose natural completion requires an
impulse shape that **no vessel currently produces in the canary discovery
registry**. The goal text does NOT mention "forge" or "vessel" — the
escalation path through slot-binding's `check_discovery_for_producer` →
`forge_missing_shape` branch is what makes the goal completable.

The single goal-text body below is the **depth-0, single-step variant**.
Depth-1 and two-step variants follow; the runner selects per perturbation row.

The `{{target_shape}}` placeholder is substituted by the runner from the
week's perturbation row (one of `webhook_signature_verifier`,
`pdf_text_extractor`, `csv_dialect_detector`).

---

## Variant: single-step, depth-0 (default)

I have an incoming HTTP webhook from a third-party billing provider. The
provider sends each request with a header `X-Signature: sha256=<hex>` that is
an HMAC of the raw request body, signed with a shared secret I have stored
locally. I want to write `/workspace/check_webhook.md` that records, for the
sample payload at `/workspace/sample_payload.json` and the secret at
`/workspace/secret.txt`, whether the signature in
`/workspace/sample_signature.txt` is valid for that payload and secret.
Use whatever impulse shape your system can resolve that answers
"is this HMAC signature valid for this payload and this secret" — I don't
care about the implementation, only the verdict and a one-line reason.

The placeholder for the answering shape, written verbatim for the runner's
substitution: shape={{target_shape}}.

## Variant: two-step, depth-0

I have a PDF at `/workspace/report.pdf`. I want a one-paragraph summary of
its contents written to `/workspace/summary.md`. The pipeline needs to
first extract the page-by-page text and then summarise it. The extraction
step requires a shape your system can resolve that takes a PDF byte buffer
and returns per-page text. Once that exists, the summarisation is an
ordinary LLM call.

The placeholder for the extraction shape: shape={{target_shape}}.

## Variant: single-step, depth-1

I have a CSV file at `/workspace/data.csv` whose delimiter, quote character,
and header row are unknown — it was exported by an old enterprise system
that doesn't follow RFC 4180. Before I can write a downstream loader I need
the dialect detected. To get there, your system should first produce a goal
for me that captures "detect the CSV dialect", and then execute it. The
resulting dialect record (delimiter, quote char, has_header) should be
written to `/workspace/dialect.json`.

The placeholder for the dialect-detection shape: shape={{target_shape}}.

## Variant: two-step, depth-1

I'm building a billing-reconciliation report. The first thing it needs is
to validate that today's webhooks were genuinely from the billing provider —
each webhook in `/workspace/webhooks/*.json` has a payload and a signature,
and there's a shared secret at `/workspace/secret.txt`. Before validating
any single webhook, set up a sub-goal that captures the validation step
generically, then execute that sub-goal against the first webhook in the
directory. Write the verdict to `/workspace/first_webhook_verdict.md`.

The placeholder for the per-webhook validation shape: shape={{target_shape}}.

---

## Acceptance criteria (used by the runner, not by minibob)

1. The execution trace shows `slot-binding` in the composition chain.
2. The slot-binding child execution emits a `shape_producer_inventory`
   impulse with `count === 0` for the substituted `{{target_shape}}`.
3. The `forge_missing_shape` task fires (not `escalate_unbindable`).
4. A `forge-vessel-for-shape` execution appears in the composition chain.
5. A `vesselVerified` impulse appears in that forge child execution with
   `discovery: ok, observation: ok, auth: ok`.
6. The downstream user-goal task that consumes `{{target_shape}}` binds to
   the forged vessel id from step 5.
7. The root execution's `validation_result` impulse has `passed: true`.

Full assertion contract: see `validation/scripts/test-forge-goal-completion.ts`
and `openspec/changes/2026-05-18-forge-goal-completion-test/design.md` §c.
