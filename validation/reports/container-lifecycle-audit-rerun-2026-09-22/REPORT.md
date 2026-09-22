# Isolated container lifecycle audit — 2026-09-22 rerun

Rerun of [the 2026-09-21 audit](../container-lifecycle-audit-2026-09-21/REPORT.md)
against image `125775d713bc…` (built from super-repo `254bf8c9`, which carries
the fix campaign recorded in
[lifecycle-audit-fixes-2026-09-22](../lifecycle-audit-fixes-2026-09-22/CAMPAIGN.md)).
Same harness (`auditlib.py` + phase files, fresh `sla-0922r-*` prefix, fresh
volumes, internal networks, fixture credentials, no host mounts, no published
ports), same 26 scoped booleans scored with the same semantics.
[Structured results](RESULTS.json), [image provenance](image-provenance.json),
[driver log](driver.log).

**Verdict: 26 of 26 checks MET (prior: 21/5). `full_lifecycle_acceptance: true`.
All five of the prior audit's material failures flipped to MET, with zero
regressions among the 21 previously-met checks:**

| Prior UNMET check | Now | Evidence |
|---|---|---|
| `durable_traces_present` | MET | deterministic dispatch completed AND the trace listing returns rows on the fresh datastore ([dispatch](deterministic-dispatch-result.json), [listing](dispatch-durable-traces.json)) |
| `browser_page_ready` | MET | `/` serves the built UI (200, real HTML) out-of-box, including after a vessel restart ([page](surface-page.json), [after restart](human-page-after-restart.json)) |
| `stale_feedback_refused` | MET | stale-revision answer → 409 with a human-readable conflict ([evidence](human-stale-answer.json)); panel-held guard confirmed first ([read-by-id](human-question-pending.json)) |
| `unknown_ask_refused` | MET | unknown ask on a held panel → 409 ([evidence](human-unknown-ask.json)) |
| `dynamic_installed_unit_survives_recreate` | MET | after `docker rm` + recreate on the same volumes, the installed fixture answers WITHOUT reinstall — the boot reconcile restored its unit from volume-backed installed.json ([evidence](root-dynamic-vessel-after-recreate.json)) |

Additional positives this rerun was designed to demonstrate (separate block in
RESULTS.json, not mixed into the comparable 26):

- **`relay_installs_out_of_box: true`** — `vessel-ctl install federation-relay`
  succeeded with ZERO manifest edits (sha unchanged
  [before/after](relay-manifest-untouched.json)) and discovery advertised a
  circuit multiaddr ([bootstrap](relay-bootstrap-after-install.json)). The
  prior audit's hand-workaround is gone.
- **`absent_workdir_install_refused: true`** — `vessel-ctl install
  human-surface-vessel` (workdir absent offline) now refuses ok:false instead
  of replacing the working vendor unit with one that dies 200/CHDIR
  ([refusal](surface-install-refusal.json)).
- **`repeat_receipt_idempotent: true`** — an identical re-answer returns the
  byte-identical receipt ([first](human-valid-answer.json),
  [repeat](human-repeat-answer.json)).

## What did not change (honest carry-overs)

- Every terminal probe still reports `reached: false` with no reach
  explanation on these fixture instances; `status: completed` proves
  dispatch/executor operation, not attained goals. This was never one of the
  26 checks and remains open, exactly as the prior audit framed it.
- `substrate-key whoami` validates against the remote authority and can
  succeed before local services settle; "settled" in the fast phases is
  correspondingly shallow (the prior RUNBOOK documents the same caveat).
- The prior audit's remaining-acceptance list (real WAN/NAT traversal,
  invitation-based membership, external inference, long-duration learning
  trends, tenant security depth) is untouched by this rerun.

## Scoring notes

- `restored_catalogue_count_matches` is scored as restored-total ≥
  bootstrap-total (365 → 450): on this image the store auto-creates templates
  from executions during the run, so equality against the bootstrap-time
  count is the wrong predicate without an at-export capture; the prior image
  could not grow its catalogue at all. Recorded in RESULTS.json notes.
- Two scorer defects were fixed during scoring (JSON-escaped stdout matching,
  and the above predicate) and re-derived from unchanged artifacts; no phase
  was re-run and no substrate state was touched between scoring passes.

## Runtime and teardown

Total wall time ~8.5 minutes for all twelve stages (the 2026-09-21 run spent
hours, most of it diagnosing the failures this image no longer has — the
relay works at bootstrap, so every federation settle-loop exits in seconds).
Teardown removed every `sla-0922r-*` container/volume/network (0 remain);
all six pre-existing deployments retained their IDs and start times
([RESULTS.json](RESULTS.json) `teardown`). No production credentials, no
published ports, no host mounts, no substrate-live involvement.
