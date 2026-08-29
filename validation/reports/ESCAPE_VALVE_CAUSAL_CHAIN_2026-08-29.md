# The escalation escape valve: four links, three closed, one open

What it takes for a human answer to actually close a sealed gap, measured link by link
on the live substrate rather than reasoned about.

## Why this document exists

The category seal (`gap-to-feature.ts` `hopeless()`) excludes a whole category at
>= 8 attempts / 0 lands, and its only designed escape is a human decision. That escape
had never been observed converting. Each link below was found by measuring the next
failure after the previous link was repaired — not by inspection, and not in one pass.

The load-bearing lesson is at the end: **every one of these links reported success.**

## The chain

| # | Link | State | How it failed |
|---|---|---|---|
| 1 | Parse the human's verb | closed | The four verbs the system itself emits are underscored (`provide_information`); the patterns required whitespace, so the literal the operator naturally types matched nothing and the answer was a silent no-op. |
| 2 | Let the exempted gap win selection | closed | The exemption carried no priority weight, so it never reached the top of the ranked pool. Cycle 1: 0 picks in 25 minutes. |
| 3 | Let a selected gap reach a compose | closed | The 5-minute compose cooldown is stamped at PICK-START and was never cleared on a capacity refusal, so a compose that never ran cost its gap a full exclusion window. |
| 4 | Apply the information the human provided | **OPEN** | `provide_information` stores the answer as prose and writes none of it into the fields the compose path reads. The gap becomes selectable but stays ungrounded. |

## Link 3, and what closing it proved

`be891f3`. `isNonAttemptComposeResult` already exempted a never-run compose from
`failed_attempts` and from the category calibration; the cooldown was never given the
same treatment. Extended to all three sites that consult the predicate.

Pre-declared signature, written down before looking: **cadence collapse**. Under the old
code the minimum inter-pick delta for a repeatedly-refused gap was floored at 300s by the
cooldown, so any delta below 60s is arithmetically impossible pre-fix.

Six independent 5-minute buckets after deployment:

| bucket | gaps re-picked | under 60s | min delta | cooldown released | not held |
|---|---|---|---|---|---|
| 1 | 2 | 1 | 10s | 9 | 0 |
| 2 | 3 | 3 | 13s | 12 | 0 |
| 3 | 2 | 2 | 12s | 6 | 0 |
| 4 | 4 | 2 | 9s | 11 | 0 |
| 5 | 3 | 2 | 18s | 12 | 0 |
| 6 | 2 | 1 | 11s | 8 | 0 |

Six for six. 58 releases, `cooldown not held` zero in every bucket — so every non-attempt
released a stamp that was genuinely held, which is what distinguishes a working branch
from one that no-ops. Credit accounting confirmed untouched throughout: the witness gap
still reads `failed_attempts=0` and `exemption=3` after dozens of refusals.

Pre-fix baseline for the same measurement: one gap picked at 19:26:31.9 / 19:31:46.5 /
19:36:52.6 / 19:41:56.7 / 19:47:01.5 — deltas 5:14.6, 5:06.1, 5:04.1, 5:04.8,
cooldown-limited to the second. Every one of those picks logged `verdict=BUSY
stage=capacity`. Zero composes ran.

## Link 4, the open one

Witness: gap `concept-usage-record-header-comment-contradicts-its-own-code-on-synthetic-credit`,
answered 2026-08-29T19:01:43Z with an answer whose literal text reads
`EDIT_SITE ...: repos/development-vessel/src/resolvers/concept-usage-record.ts`.

Its complete `classification_metadata` key set three hours later:

    approach_decisions, failed_attempts, human_disposition, human_disposition_answer,
    human_disposition_at, human_disposition_record_id,
    human_exemption_attempts_remaining, human_exemption_granted_at

No `edit_site`. No `file_path`. No `change_site`. Every recorded approach decision carries
`edit_site: ""`; every pick logs `target: "(no-target)"`. Selected 20+ times at the top
score (1.5938, `tied_at_top: 1`), zero of three exemption attempts spent, and not one
`fc-plan` / `fc-scope` / `fc-anchors` line — because there is nothing to compose against.

Three of the four escalation verbs are answerable with words alone. `provide_information`
is not: information not written where the compose path reads it has been provided to the
log, not to the system. Law 8, failed precisely.

## The pattern worth keeping

**Every link reported success while failing.**

- Link 1 returned a clean disposition report for an answer it had silently discarded.
- Link 3 logged `gap credit not bumped, category calibration untouched` — correct, and
  concealing that selection was being penalised anyway.
- Link 4 today reports `applied: 1`, grants the exemption, reopens the gap, and ranks it
  first. From every report the system emits, this is indistinguishable from working.

A chain of individually-honest components can be end-to-end dishonest. The only thing that
caught each link was measuring the *next* stage's observable, never the stage's own report —
and in link 4's case, noticing that one gap's cadence stayed at 6 minutes while every other
gap had collapsed to 12–16s. The asymmetry was the evidence; the reports were not.

## Open gaps filed from this

- `provide-information-stores-the-humans-answer-as-prose-and-applies-none-of-it` — link 4.
- `fc-anchor-region-vetoes-a-verified-unique-anchor-for-being-far-from-the-located-region` —
  the compose pipeline discards a verified-unique anchor for being far from a heuristically
  located region, then substitutes an arbitrary one. This is what forced link 3 to be landed
  by hand; closing it is what lets the system land this class itself.
