# Obsidian legibility surface — humans operate the substrate without understanding it

**Date:** 2026-07-18
**Vessel:** obsidian-vessel (surface) + goal-host-vessel (intake confidence, outcome emission) + interaction disposition router
**Stage:** SPEC (rung 4 of `2026-07-18-s2-stability-ladder`; depends on rungs 1–2 for believable verdicts)
**Lever:** replace the interlocutor's translation and interpretation jobs with substrate behavior, so a human who does not know what a shape is can dispatch, understand outcomes, and drive retries in prose.

## Problem

Today a human goal only works after an operator rewrites it (path-first phrasing, contract-in-goal), and a dispatch's outcome is only legible after an operator reads `reached` vs `status`, the reasoning log, and the diff. Law 13 says humans are resolvers, not preprocessors; the current surface makes them preprocessors and forces an interlocutor. Strangers will not tolerate this burden — the legibility surface is also the retention curve of any future public exposure.

## Behavior (expectations a reader can hold the system to)

**1. Clarification exit on low-confidence intake.** When the walk's confidence in target inference falls below a learned threshold, the system does not guess: it emits a well-formed question through the ask exit to the originating vault ("Did you mean the panel in the sidebar, or the pulse strip? One file will change: `<path>`."). The human's prose reply resolves the ask and the dispatch proceeds. The ask→answer roundtrip already exists; this wires goal intake into it via the interaction disposition router.

**2. System-proposed reformulation on failure.** When a dispatch falls short, the *system* — not the human — produces the reformulation candidate (informed by walk repair's tier diagnosis). The human sees "This didn't reach because X. I propose retrying as: '…'. Approve, edit, or drop." in their vault and answers in prose. The human never learns phrasing rules; the system's parser weaknesses stop being the human's problem.

**3. Every dispatch terminates in a written outcome note.** Structure: **what was asked** (the goal as typed), **what happened** (one sentence, honest — hollow completion is reported as not-reached), **evidence** (diff link, output excerpt, probe trace), **what happens next** (retry proposed / gap filed / done). Never a bare status enum. The note is written to the originating vault via the sidecar conduit, attributed to the dispatch.

**4. All flows are shaped and graded.** Intake-confidence thresholds, ask emission, reformulation drafting, and outcome-note rendering are activities selected and graded by the loop — legibility behavior is learnable and replaceable, not hardcoded formatting.

## Non-goals

- Not a dashboard: the surface is prose notes and prose replies in the human's own vault, not a status UI.
- Not a bypass: outcome notes report the audited verdict; they do not soften it. A legible lie is worse than an opaque one — this surface ships only on top of verifier supremacy (ladder rung 2).

## Acceptance

A human with no substrate knowledge, in a connected vault: types an intent in prose → is asked at most one clarifying question → receives an outcome note they can act on → on failure, approves a system-proposed retry in prose → the retry lands. Zero interlocutor touches end-to-end; every step traced. The measured gauge is the unassisted reach rate (ladder rung 5).
