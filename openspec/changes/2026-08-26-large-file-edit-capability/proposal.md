# Large-file-edit capability for the composer

## Why

The composer (`feature-compose`) edits by anchor-matching into a bounded grounding
window (`groundVesselFiles` → `find src` + excerpts), never holding the whole file.
On large files the load-bearing lines are not uniquely anchorable in the window, so:

- the drafter emits **`op_count=0` ("plan had no ops")** — measured live 2026-08-25 on a
  precise 7-hunk removal from a large `impulses.ts`;
- multi-op plans roll back atomically on any bad op;
- the `patch_with_tools` byte-anchored escalation **timed out**.

This is the ~0.7% intractable tail that saturates at 8 attempts and auto-closes as
"not patch-tractable by re-drafting." It is also the shared keystone this session's
audit kept hitting: the substrate's own gap-closing dispatches **hollow-reach** on the
learning-core gaps (compose can't do the large-file edit → falls to the ReAct floor →
the floor can't edit at all), so the substrate cannot self-close them — which is why an
operator, who reads the whole file and anchors against what they read, could land every
one of them this session while the composer could not.

**This is the enabler.** With it, the learning-core fixes (marginal-credit formula,
grader hardening) and the cross-family dedup become substrate-closable rather than
operator-only. Without it, the substrate stays dependent on an operator for its own
large-file self-development — the exact dependency the S1→S2→S3 trajectory exists to
remove.

## What changes

A large-file edit primitive for the drafter, one or more of:

1. **Verbatim-unique-anchor grounding.** Instead of excerpt windows, give the drafter
   the ability to request the *exact current text* of a named region (by symbol, by
   line range, or by a verbatim search string proven to occur once) and edit against
   that — the same discipline an operator uses (read the whole span, anchor on a unique
   string). The vessel-edit-gate already demands "quote the exact current line" — make
   that first-class instead of advisory.
2. **Line-range edits.** Accept `{file, start_line, end_line, replacement}` ops so a
   multi-hunk change to identical/near-identical blocks (which cannot be uniquely
   content-matched) is expressible — the exact failure mode of the 7-dead-switch-arm
   removal.
3. **AST-level ops** (stretch) for structural edits (remove case, rename symbol) that
   are brittle as text.
4. **A working `patch_with_tools` path that does not time out** on large files (the
   byte-anchored escalation must stream/scope rather than re-read the whole file per op).

## Verification

- A known-intractable large-file edit lands autonomously: the 7-dead-`case`-arm removal
  from `activity-api/src/routes/impulses.ts` (op_count=0 today) lands with the arm count
  dropping 8→1 and typecheck green.
- The substrate's own gap-closing dispatch for a learning-core gap produces a real
  compose plan (op_count>0) and lands, instead of hollow-reaching via the floor.

## Scope / non-goals

- Not a change to Thompson selection, credit, or the walk.
- The grounding-window path stays for small edits (it works — rIS-debug landed in ~15m).

## Status

Filed as the resolution of gap `composer-cannot-edit-large-files-marginal-anchor-loss`.
Its operator-urgency fell once direct-edit was authorized (the operator is the large-file
editor this session), but its S2 value — the substrate editing its own large files without
an operator — is real and is the highest-leverage remaining item. Deferred to spec rather
than built this session because it is a genuine feature (multiple new op types + a
grounding redesign), not a point fix.
