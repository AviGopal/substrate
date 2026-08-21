# Verifying the documented setup and management path against a live fleet

Every claim below was executed against a running substrate, on the image CI
publishes, and the command that produced each result is given. Where a documented
step failed, the defect was fixed and the step re-run — the table records the
state after that, and the fixes are listed at the end.

The method rule throughout: **read the layer that consumes the artifact.** A unit
that reports `active` is not a unit that is working, a green verdict is not a
correct diff, and a check whose result cannot differ from its absence proves
nothing.

---

## 1. Setup — the documented first-run path

| Documented claim | Command | Result |
|---|---|---|
| One command brings up a fleet | `make -C scripts/substrate up` | container healthy |
| `healthy` ≠ ready; gate on the key | `until docker exec substrate-live substrate-key whoami \| grep -q '"valid": *true'` | passes verbatim |
| Nine ports are published | `docker port substrate-live` | 9 distinct container ports |
| The port table names the right vessel per port | `curl :180{80,90},:181{00,01},:18210,:18250,:18260,:18270/health` | all `200` |
| `:18310` answers only after an explicit install | `curl :18310/health` | `000` before |
| …and the remedy is `vessel-ctl install` | `docker exec substrate-live vessel-ctl install human-surface-vessel` | `200` after |
| Compose is an equivalent lane | `docker compose config` | same image, same container name, 9 published ports, same two named volumes |

**Caveat worth keeping:** a `curl` count of `docker port` output double-counts,
because each mapping is listed for IPv4 and IPv6. The nine-port claim is correct;
counting lines rather than distinct container ports says eighteen.

---

## 2. Management — the documented operational surface

| Documented claim | Command | Result |
|---|---|---|
| Health is one command | `substrate-doctor` | `all checks PASS` |
| Readiness is queryable | `substrate-ready --once` | `fleet ready` |
| Provenance answers "did my `-e` win?" | `substrate-config ANTHROPIC_API_KEY` | `env` — correctly attributed |
| Drift is reportable | `vessel-ctl apply` then `vessel-ctl drift` | `identical` once image and volume converged |
| Selection re-applies at runtime | `vessel-ctl apply` | converged; skipped units correctly re-skipped, not looped |
| Vessel source edits are gated | pipe a `repos/<v>/src/**` path to the edit-gate hook | `permissionDecision: deny` with routing instruction |
| …with a conscious bypass | same, `SUBSTRATE_ALLOW_DIRECT_EDIT=1` | allowed |

**Two ways to test the gate wrongly**, both of which I hit before getting a true
reading: the hook signals denial as **JSON on stdout**, not via exit code, so
reading `$?` always shows `0`; and `SUBSTRATE_ALLOW_DIRECT_EDIT` is an ordinary
environment variable, so once exported for a one-off it silently disables the gate
for the rest of the session. A gate that passed and a gate that was switched off
look identical. Filed as `gap-direct-edit-override-persists-beyond-the-one-off`.

---

## 3. Lifecycle — stop, start, recreate

| Documented claim | Command | Result |
|---|---|---|
| Stop drains rather than kills | `make -C scripts/substrate stop` | reports in-flight count, drains, retains volumes |
| Stop/start preserves state | `make stop` → `make up` | identity valid, **18,135 traces** |
| Recreate preserves named volumes | `make recreate` | identity valid, **18,135 traces** |
| Recreate destroys a manifest install | `systemctl is-active human-surface-vessel` | `inactive / disabled`, `:18310` → `000` — exactly as `HUMAN_SURFACE.md` states |
| …and reinstall restores it | `vessel-ctl install human-surface-vessel` | `200` |

**The stop path was not compliant before this round.** `make stop` ran a bare
`docker stop`, whose default grace period is **10 seconds**, while goal-host
advertises `drain_ms: 240000` on `/health` and `surrealdb.service` declares no
`TimeoutStopSec` at all (inheriting systemd's 90s to flush RocksDB). `clean-live`
used `docker rm -f` — SIGKILL, no grace. Three deploy scripts did the same to a
possibly-live fleet. All now drain first.

---

## 4. Dispatch — the canonical loop

`POST /run-goal` → poll `/executions/<id>` → read `reached`.

Run twice, before and after the recreate. Both `reached=true`, and the verdict was
a **deterministic oracle** rather than an LLM judge:

```
deterministic:verified-registry-count — independently queried
http://127.0.0.1:8100/registry/stats.totalVessels=15
```

That figure matches an independent `curl` to the same endpoint. The distinction
matters: a recomputed fact is evidence, a fluent reach reason is prose.

**Edit-intent dispatch, five goals attempted:** 1 landed (verified by reading the
diff, not the verdict), 4 refused. Every refusal named a specific, checkable
reason — an inverted change, an unbalanced brace, a compose-capacity limit, and a
patch staged but never landed. No hollow completions and no false reaches. The
honesty machinery is sound; first-attempt draft quality on one-line edits is not.

---

## 5. Defects found and fixed

| Defect | Evidence it was real | Where |
|---|---|---|
| `make stop` SIGKILLed a 240s drain at 10s | `drain_ms: 240000` on `/health` vs docker's 10s default | `Makefile`, 3 deploy scripts, `SUBSTRATE.md` |
| Three desktop units crash-looped **939 times**, invisibly | a `Restart=` loop reports `activating`, never `failed` | `ExecCondition` guards on `novnc`, `obsidian-xorg`, `obsidian-desktop` |
| `bootstrap-seeder` crash-looped; 3 templates never minted | restart counter hit 10, systemd gave up | three lifecycle templates declared preconditions they produce themselves |
| `substrate-doctor` printed FAILURES with all 7 checks passing | skipped units counted as down; `development-vessel-seed` mis-roled | `substrate-ready.sh`, inventory |
| `relevance-sink` role `compute` while writing SurrealDB directly | `spoke` includes compute, excludes store → silent write failures | inventory |
| Two clients of one datastore with different default credentials | `changeme` vs `root` | `relevance-sink-vessel/src/index.ts` |
| `GOAL_HOST_VESSEL_ENDPOINT` defaulted to the dev-vessel port | 12 other sites use `:8210` | `gap-lifecycle-scan.ts` |

**A fix verified in a running container is not necessarily a fix.** The desktop
guards were confirmed working through real systemd, then wiped by the next
`make stop`/`up` — unit files live in `/usr/lib/systemd/system`, re-copied from the
image every boot, while `/vessels` and `/usr/local/bin` patches from the same
session survived. Three durability classes, one appearance, silent reversion. Now
documented in `SUBSTRATE.md` and re-verified against the published image.

---

## 6. Filed as gaps rather than fixed

Each is a decision about which behaviour is correct, not a mechanical edit:

- `gap-stale-runtime-tree-poisons-typecheck-gate` — the `/vessels` tree can be
  stale enough to fail its own verification gate, charging the failure to the
  draft. Five dispatches died this way before the environment was repaired.
- `gap-mitosis-cutover-stages-without-landing` — a typecheck-verified patch staged
  and never committed. Generation worked; landing failed.
- `gap-translating-trace-sink-retries-test-url-forever` — goal-host retries
  `https://activity.test` every ~10s in production, burying real errors.
- `gap-hot-patched-units-revert-on-restart-silently` — the durability classes above.
- `gap-direct-edit-override-persists-beyond-the-one-off` — the bypass leak.

---

## Final state

```
totalVessels 15 · totalShapes 387 · healthyCount 15
units with NRestarts>0: 0
failed units: 0
substrate-doctor: all checks PASS
execution traces: 18135
```

---

## 7. The autonomous demonstration, and what it took to get an honest one

Sections 1–4 are operator-executed. The condition also asks the substrate to
demonstrate this itself, which took six dispatches and produced two graded
verdicts — one false, one true. Both are in the oracle corpus.

**The false one.** `fd259bc3`, goal: *"Validate that the documentation correctly
describes how to set up and manage the substrate container."* Returned
`reached=true` on a 6,177-character **summary of SUBSTRATE.md**. It read the
document and described it; no command was run, no port probed, no documented
output compared to a real one. Graded `not_achieved` by hand and filed as
`gap-summarising-a-doc-grades-as-validating-it`.

The mechanism is worth keeping: the deterministic `hollow_walklog_capped` gate had
fired correctly on the *same goal* in an earlier dispatch and skipped the judge
outright — *"it cannot out-testify the walk's own log"*. On the
`universal-tool-fallback` path that gate does not fire, so the judge was free to
grade prose. Same goal, same hollow walk, opposite verdict, decided only by which
path produced the final artifact.

**The true one.** `024fc7b8`, goal: *"How many documents does the docs_align_tick
report say were scanned?"* — the same subject posed as a question with a
**recomputable** answer. The walk resolved `docs_align_tick`, reported
`docs_scanned: 63`, and carried the real `docsAlignTickReport` body as its basis.
Independently recomputed by resolving the shape directly: **63**. Graded
`achieved`.

The discriminator is not phrasing luck. A goal whose answer can be recomputed can
be checked; a goal whose answer is a judgement can only be narrated. That is why
the first four attempts failed and why this one is worth trusting.

### What the substrate says about its own docs

Running its checker over README, SUBSTRATE.md, FEDERATION.md and HUMAN_SURFACE.md:

```
docs scanned : 4
findings     : 0
verdict      : CLEAN
```

Zero is only meaningful because non-zero is still reachable: a control doc
carrying a dated status marker, a prose instance reference and a nonexistent
script path is caught on all three. Before the checker's own four bugs were fixed
it reported **40 findings on correct documentation** — a validator that fails on
correct docs trains its readers to ignore it.

### Still blocked, and filed rather than worked around

Four of six dispatches failed to a single reproducible defect,
`gap-inference-picks-shell-over-an-advertised-resolver`: goal-target inference
selects `shellResult` over `docs_align_tick` even though that shape *is*
advertised in the registry among 383 shapes, so the walk never reaches the
producer holding the answer. One dispatch resolved the shape correctly, then
appended `shellResult` for countability, ran the shape name as a shell command,
and the resulting error sank an otherwise-correct verdict.

The honest position: the docs are demonstrably correct by execution (sections 1–4)
and by the substrate's own checker (0 findings, control-verified). The substrate
can now reach a *recomputable* claim about them autonomously. It cannot yet reach
the open-ended "validate the docs" formulation, and that is a filed defect rather
than a phrasing to keep retrying until something goes green.
