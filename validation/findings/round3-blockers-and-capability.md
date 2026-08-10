# Round 3 — a failed trace store, a narrower regression, and a hole in the floor

Same method as the previous rounds: a goal passes only when its **answer** matches
a ground truth computed independently in `/workspace/git/super-repo`, the tree the
substrate reads. `reached` is recorded, never used as the verdict. All dispatches
strictly serial.

---

## Part 1 — the blocker was a failed trace store, and the obvious remedy was wrong

`substrate-live` was **unhealthy** with `activity-api.service` in
`failed (start-limit-hit)`. The container healthcheck gates on it, so the whole
substrate reported unhealthy.

It was not crashing. Every cycle is clean: start → connect to SurrealDB → register
with discovery → `[Server] SIGTERM received, shutting down gracefully`. With
`NRestarts=0` and `Restart=on-failure`, systemd's own policy never fired — an
**external agent** issues repeated `systemctl restart activity-api.service`, and
concurrent bursts trip `DefaultStartLimitBurst`.

`reset-failed` + `start` brought it back and the container returned to healthy —
but that was **cosmetic**. It is still cycling: `ExecMainStartTimestamp` moved from
19:37:07 to 19:47:09 with bursts observed at 19:34, 19:37, 19:44 and 19:47.

### The remedy I rejected, and why

The scouted remedy was `systemctl mask activity-api.service`, on solid-looking
reasoning: this substrate is a **spoke**, `ENABLED_ROLES=spoke`, and
`vessels.inventory.json` puts `activity-api` in role `api`, which appears only in
the `hub` and `full` groups. The unit is `disabled` but **not masked**, and 14
units carry a soft `Wants=activity-api.service`, so it gets resurrected. By the
inventory, it should be dark here.

**Measured state says otherwise.** The trace store the spoke would fall back to is
not reachable:

```
http://syzygy.host:18100/health   -> 200 in 0.20s   (hub discovery: alive)
http://syzygy.host:18080/health   -> 000 in 12.0s   (hub trace store: timeout)
RELAY_MULTIADDR=""                                  (no federation transport)
```

The hub registry advertises `goal_execution` and `activity_execution` among 388
shapes, but advertised is not resolvable. With the hub store timing out and no
relay configured, **the local out-of-role `activity-api` is the only trace store
this substrate has**. Masking it would have silently blinded the learning loop —
every execution untraced — while looking like a clean fix.

This is the session's clearest case of *a remedy that is correct in principle and
wrong against measured state*. The inventory says spoke; the network says the hub
half of that arrangement is not answering.

### What is actually needed

- **Class fix (belongs to the substrate, not to me):** the third branch of step 10
  in `vessel-mitosis-cutover.ts` (`runSystemctl(["restart", unit])`) is bare and
  unguarded. The sibling branches already do this correctly — the `goal-host`
  branch drains in-flight dispatches then defers via `systemd-run --on-active`,
  and the self-cutover branch quiesces on a lockfile. `activity-api` matches
  neither and takes the unguarded else. It should also consult `is-enabled` and
  skip a restart for a role-excluded unit.
- **Operator mitigation, attempted and blocked:** a drop-in setting
  `StartLimitIntervalSec=0`, so a burst cannot drive the only reachable trace
  store into `failed`. Rate-limiting buys nothing here because the unit is not
  crash-looping. **Blocked by the permission classifier; not applied.**

**Attribution honesty:** `cutover.ts:2043` is the strongest *candidate*, not a
proven cause. The supporting evidence offered for it — 49 compose reports
containing the literal `"op": "systemctl restart activity-api.service"` — are all
dated Aug 5–6, and **no journal line today names the restarter**. The unguarded
branch is real and verified; today's actor is not pinned.

---

## Part 2 — correcting my own regression claim

The previous findings doc and commit `600d2b94` state that `c9faf50d` makes
`verifyRegistryInventoryReach` claim goals like *"How many shapes does `src/foo`
serve?"*. **That specific example is wrong**, and the error is mine.

I tested the two regexes in isolation. Executing the **full downstream guard
chain** shows that goal still abstains — it flips its abstention reason from
`path-guard` to `not-registry-count`, and never reaches a verdict. That is the
same instrument error this session has been cataloguing: measuring a predicate
without the guards that surround it.

**The regression is real but narrower.** The family that actually flips
abstain → claim is a counting goal carrying a path **and** a registry/discovery
token — e.g. *"How many `.ts` files are under `src/discovery/handlers`?"* — 7 of 7
such goals confirmed by execution. Those now get graded against registry stats,
producing deterministically wrong verdicts that β-penalise correct compositions:
a false-negative learning signal.

Two further facts change the remedy:

- The gap that drove it, `route-edit-ed7585e0:9`, was **never filed** — the store
  returns `{"gaps":[],"total":0}`, verified against a control id that does return
  a row. So unlike the earlier re-landing incident, **a correction here will not be
  re-demanded by an open gap.**
- `c9faf50d` is an unreverted ancestor of the push-clone HEAD, and the intended
  target at `verifyCountFilesReach` is still unwidened.

**Recommended:** forward-fix at the `verifyRegistryInventoryReach` site to abstain
when *either* predicate matches (union), anchored on the function name and regex
text — never a line number, since the stale submodule carries it at 1669 and the
deployed tree at 1233. **Not dispatched this round**, deliberately: `goal-host`
`index.ts` is receiving autonomous cutovers every 15–25 minutes built from earlier
base SHAs, so a landing can be clobbered by a cutover staged pre-fix — and two of
three repair dispatches this session produced either nothing or a regression.
Dispatching another into that race has negative expected value without an
anchor-and-inertness check in the loop.

---

## Part 3 — capability, round 3

Eight goals, none reused from rounds 1 or 2, spanning eight distinct task kinds.

| goal | kind | answer | verdict |
|---|---|---|---|
| r3-02 Node version in `.nvmrc` | file lookup | 25 | ✓ trial 1 |
| r3-03 `.sh` files recursively under `scripts/` | filtered count | 40 | ✓ trial 1 |
| r3-05 longest top-level `docs/*.md` | superlative | — | ✗ no answer, both trials |
| r3-06 (1234 × 5678) − 4321 | arithmetic | — | ✗ no answer, both trials |
| r3-07 seconds in 3.75 hours | unit conversion | 13500 | ✓ trial 1 |
| r3-08 count of `s` in a given string | text transformation | 7 | ✓ trial 1 |
| r3-09 summarize `docs/SCHEMA_OWNERSHIP.md` | prose summary | accurate | ✓ trial 1 |
| r3-10 is `minibob_instance` read-only? | yes/no from a doc | yes, cites `FOR create, update, delete NONE` | ✓ trial 1 |

**6/8 correct, all six on trial 1, zero wallpaper.**

Every numeric pass was hand-read rather than trusted to the matcher, because
dispatch UUIDs contain digit runs that a regex reads as claimed counts. All four
are exact: `stdout` of `25`, `40`, `13500`, `7`, clean stderr, exit 0. r3-02 is
the nicest of them — it produced `fileContent` *and* `shellResult` and the two
agree. r3-10 quoted the actual migration clause rather than guessing.

Both failures returned **no answer at all** rather than a confident wrong one.
After G9 last round, that is the better failure mode.

### The two failures share one mechanism, and it is a hole in the floor

```
HOLLOW — the output does not provide the computed result; β-penalised
walk: hollow satisfier verdict — re-running with suppressSatisfierShapes
walk: no pick — missing shapes [llm_completion_dispatch] have no producer
      or constructible payload; terminating walk
```

The hollow detector works: it caught a partial result and refused it. The
**recovery** is what fails. Re-running with `suppressSatisfierShapes` removes the
only producer of the needed shape, so the walk finds no pick and terminates —
and the universal tool fallback never engages.

That fallback is not dead: earlier the same day, a hollow verdict on a different
goal fell through to `execution_path=universal_tool_fallback` and answered
correctly. So engagement is **conditional**, and the condition is exactly the case
where suppression empties the producer set.

This bears directly on the stated floor — parity with a ReAct-style agent on any
arbitrary goal. Here the floor is unreachable precisely when it is most needed:
after the preferred path has been judged hollow.

r3-06 sharpens it. Target inference routed *"What is (1234 × 5678) − 4321?"* to
`llm_completion_dispatch` at confidence 0.7 — not `shellResult`, which would have
computed it trivially. When that satisfier came back hollow and was suppressed,
nothing remained. A goal a pocket calculator answers failed twice, not for lack of
capability but because the recovery path suppressed its way into an empty
producer set.

---

## Status

**Cleared:** `activity-api` recovered from `failed`; container healthy again.
**Not cleared:** the restart churn continues (mitigation blocked by permission);
the `c9faf50d` regression is live, narrower than previously reported, and its
forward-fix is specified but not dispatched.

**Newly established this round:**
1. The spoke's only reachable trace store is an out-of-role vessel, because the
   hub's store times out and no relay is configured — so the inventory-correct
   remedy (mask it) would blind the learning loop.
2. My earlier regression example was wrong; the real blast radius is counting
   goals carrying a registry token, measured at 7/7 by execution.
3. The gap behind `c9faf50d` was never filed, so a correction will not be
   re-demanded — unlike the earlier re-landing case.
4. Hollow recovery can suppress the only producer and strand the walk, with the
   universal tool fallback not engaging.

**Capability across three rounds, all scored by answer:** 9/9, 7/8, 6/8 —
22 of 25, with 21 of those on the first trial.
