# Substrate-authored drafts that could not land

Each patch here is work the substrate produced through `feature_compose`,
verified, and then failed to commit — the `staged-not-landed` outcome. They are
kept because a draft that cannot land is evidence about the edit path, not
scrap: deleting it hides the gap it demonstrates.

## d4-activity-api-by-shape.patch

Dispatch `49f8c0b6`, 2026-08-08. Goal: resolve activity-api through discovery
by shape instead of the `ACTIVITY_API_ENDPOINT` env pin — the last two env pins
in the surface, and the reason bullet 6 of the topology expectations is only
partially met.

The verdict was `staged-not-landed — feature_compose UNFAVORABLE (op_count=1,
rolled_back)`. It nevertheless left the edit in `substrate-live`'s working tree,
where it sat uncommitted and eventually **blocked `git pull --ff-only`** — the
vessel stopped converging to origin/dev and nothing reported that.

**Do not apply as-is.** Two defects:

1. It drops `.replace(/\/+$/, "")`, so a registry endpoint with a trailing
   slash yields `//api/...` on every upstream call.
2. It puts a top-level `await` in a module-scope `const`. Legal in ESM, but it
   makes the module's load order depend on a network round-trip to discovery —
   in a file whose own comment argues for going direct precisely so a shape
   lookup cannot fail closed and swallow human verdicts.

The intent is right and the shape of the fix is right. It needs the
normalization kept and the resolution moved to use-time rather than load-time,
which is how `candidateEndpointsFor` is already used for goal-host in the same
file.
