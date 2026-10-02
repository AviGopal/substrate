# Every human input on the surface names its reader and shows its outcome

**Vessel:** human-surface-vessel (UI and its proxy routes), with named dependencies on
development-vessel and goal-host-vessel
**Extends:** [`surface-render-contract`](../surface-render-contract/design.md) — its
`Interaction` contract (Choice / Score / Noul / Text, shared footer states) is the widget
layer this change uses; this change adds the half that contract left open: what happens to
an answer *after* it is sent.

## Problem

The surface asks people for four kinds of input — answers to the system's questions,
context for a running goal, answers to a walk that is waiting on them, and problem
reports / grades — and treats all of them the same way: a free-text box, a Send button, and
a "Sent" receipt. Whether anything reads the input, what the reader needs from it, and
whether it changed anything are invisible to the person giving it.

Traced against the running system (evidence in [`design.md`](design.md) §7):

- **Escalation answers are mostly discarded.** `escalation_disposition_apply` acts on an
  answer only when it contains one of four verbs (redefine / provide information / grant
  access / drop). The surface never names them. Of 65 answered escalations, about 40 carry
  no recognisable verb and were left unparsed — by the reader's design, correctly.
- **The most common question has no reader.** "Did the fix work?" (`pending-verify-*`)
  answers are stored and read by nothing; so are "where should the change go?"
  (`needs-localization-*`) answers. Docs-decision answers are read only from Obsidian vault
  notes, so the same answers given on this surface are unread.
- **Added context rarely lands.** It enters the walk's pool, but its default shape
  (`human_context`) is consumed by no activity, while the walk already publishes the shapes
  it is missing (`pendingTargets`) and the surface does not show them.
- **Mid-walk questions never reach a person.** goal-host posts them to whichever vessel
  advertises `human_input`; that is development-vessel's vault-note reader, whose 200 is
  taken as "posted".
- **No outcome is ever shown.** A person cannot tell "applied", "not understood" and
  "nothing reads this" apart, so they cannot correct an answer or stop wasting one.

## Change

One rule for every input site: **an input declares its reader, is built to that reader's
contract, and reads its outcome back.** A site whose reader does not exist yet says so on
the card and has a held gap for the reader — it is never presented as if it acts.

In the UI grant: typed escalation answers matched to the applier's parser (verb + labelled
fields, pre-checked with a mirror of the parser), an outcome receipt read back from the gap,
add-context driven by the walk's missing shapes, report-to-issue linking, and honest
labelling of unread kinds. Outside it (held gaps): readers for pending-verification and
localization answers, and the mid-walk question route.

See [`design.md`](design.md) for the inventory, per-site contracts, wireframes, phases and
validation.
