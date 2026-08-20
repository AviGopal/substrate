# Following the startup docs in a clean environment: what the system did instead

`docs/SUBSTRATE.md` describes how to build, run, and iterate against a local
substrate. This is the delta between what it says and what a clean-room run
actually does, measured by booting a second fleet from the documented commands
and probing every claim the launch path depends on.

## How this was measured

- **A real clean-room boot**, per the doc's own second-substrate recipe:
  `make -C scripts/substrate up LIVE_NAME=substrate-scratch PORT_OFFSET=6000`,
  on an offset range verified free beforehand. Torn down afterwards with the
  doc's teardown commands, which worked exactly as written.
- **Every other claim probed against the live system** — the registry, the
  Makefile, the compose file, the image itself — by 4 verification agents, each
  required to produce the command and its verbatim output. Every claimed defect
  then went to an independent agent whose instructions were to *refute* it and
  to default to "refuted" when unsure.

**21 defects claimed, 18 survived refutation, 3 were killed.** The three killed
are recorded at the end, because a defect that does not survive is a fact about
the doc being right.

Findings below are grouped by what they cost a reader. Line numbers are against
`docs/SUBSTRATE.md` at the time of measurement.

---

## 1. The one that destroys data

**`docker compose up -d` is the doc's headline container path (line 139), and
running it against an existing fleet silently discards all learning state.**

Compose prefixes volume names with the project, so the `substrate-workspace` /
`substrate-surreal` volumes declared in `docker-compose.yml` resolve to
`substrate_substrate-workspace` / `substrate_substrate-surreal`:

```
$ docker compose config | sed -n '/^volumes:/,/^[a-z]/p'
volumes:
  substrate-surreal:
    name: substrate_substrate-surreal
  substrate-workspace:
    name: substrate_substrate-workspace
```

The live fleet is started by the Makefile's `docker run` path and mounts the
**unprefixed** names. So compose does not adopt an existing fleet — it creates
empty volumes and starts a container that reports healthy with an empty
SurrealDB. On this machine those volumes hold **16.7 GB** of traces, posteriors,
and concept graph.

`docker-compose.yml` itself documents this in a fourteen-line warning
(lines 103–118), ending:

> Do not "just bring it up with compose" — that is the one action in this repo
> that silently discards all learning state while reporting success.

**`docs/SUBSTRATE.md` carries none of it.** Lines 143–147 say compose "mounts
the two named volumes" and stop. The warning exists, in the right repository, on
the right file — and not on the page an operator reads to start a container.

**Fix:** carry the compose-file warning into the doc beside the quickstart, and
state the adoption recipe (declare the volumes `external: true` under their
unprefixed names first).

---

## 2. The clean-room boot did not actually succeed

`make up` exited **`Error 1`**. The doctor reported four failures:

```
  PASS  datastore disk headroom 225315MB free (88% used)
  FAIL  surrealdb root auth FAILED — env SURREAL_PASS does not match the datastore root user
        likely cause: container recreate regenerated SURREAL_PASS against a warm datastore volume
  FAIL  activity-api authed probe returned HTTP 000
  FAIL  discovery registry stats unreadable
  FAIL  failed units: polkit-agent-helper.socket
[doctor] FAILURES detected
make: *** [Makefile:353: up] Error 1
```

Two things matter here, and the second is worse than the first.

**The container reported healthy anyway.** `docker inspect` said `healthy`, and
8 of 9 ports returned HTTP 200, because the container healthcheck probes only
`:8080/health`. A reader who checks the documented health signal — the doc points
at exactly this signal on line 145 — sees success while SurrealDB root auth is
broken. Health was green and the fleet was not usable.

**The doctor's stated cause cannot be true for this run.** It blames "a container
recreate against a **warm** datastore volume". Both volumes were created empty
seconds earlier by this same command; there was no warm volume. So the one
diagnostic line an operator gets on a failed first boot points at a scenario that
did not happen. Whatever breaks a *cold* start is unnamed.

**Fix:** the doc should say `up` gates on the doctor and can exit non-zero on a
first boot; and the doctor's SURREAL_PASS branch needs a cold-start case
distinct from the warm-volume one. The failure itself is a substrate defect worth
filing separately — it is not a documentation bug.

---

## 3. The human surface is absent from the operator doc

`human-surface-vessel` is the only vessel a human is meant to talk to. Searching
the whole document:

```
grep -n "18310" docs/SUBSTRATE.md   -> no match
grep -n "8310"  docs/SUBSTRATE.md   -> no match
grep -n "18080" docs/SUBSTRATE.md   -> 10 matches   (positive control: the grep works)
```

It is missing in four distinct places:

| Line | What it says | What is true |
|---|---|---|
| 152–159 | "the equivalent raw invocation" — publishes 8 ports | compose publishes **9**; `-p 18310:8310` is absent |
| 682 | run-live serves "18080/18090/18100/18210/18250/18260/18270" (7) | `run-live` publishes **9**; 18101 and 18310 both omitted |
| 472–482 | 10 vessels have a `restart-<vessel>` target | there are **11**; `restart-human-surface-vessel` is omitted |
| 29 | manifest vessels are "**i.e. the federation units**" | `human-surface-vessel` is `"manifest": true` as well |

The last one has a consequence the doc never states. On the clean-room boot the
port was published and **nothing was listening**:

```
$ curl -o /dev/null -w "%{http_code}" http://localhost:24310/health
000
$ docker exec substrate-scratch systemctl is-enabled human-surface-vessel
disabled
```

Manifest vessels are not baked-enabled, so a default boot leaves the human
surface installed-but-off. The documented install fixes it —

```
$ docker exec substrate-scratch vessel-ctl install human-surface-vessel
{"ok":true,"action":"installed","vessel":"human-surface-vessel","active":"active",...}
$ curl -o /dev/null -w "%{http_code}" http://localhost:24310/health
200
```

— but nothing in the launch path tells a reader to run it. Follow the doc
exactly and you get a fleet whose human surface is unreachable, with a published
port suggesting otherwise.

*(Note: that `vessel-ctl` call printed `"container":"substrate-live"` while
running inside `substrate-scratch`. It acted on the correct container — scratch
went active, and `substrate-live` was not running at the time — so the field is
a cosmetic mislabel, not a misrouted action. Worth fixing; not a doc defect.)*

---

## 4. The published image is not the image the doc describes

The doc (line 163) presents two GHCR tags: `:dev` = "fleet only ... Obsidian
runs as a host peer", and `:obsidian` = fleet + in-container Obsidian.

Both halves are wrong.

**`:obsidian` does not exist.** The documented pull dead-ends with
`MANIFEST_UNKNOWN`; the tag list enumerates all 250 tags with no `Link` header,
so this is not a pagination artifact.

**`:dev` *is* the obsidian build.** Inspecting the published image:

```
$ docker run --rm --entrypoint sh ghcr.io/avigopal/substrate:nightly \
    -c 'test -d /usr/share/novnc && echo OBSIDIAN || echo base'
OBSIDIAN
```

The cause is in CI. `Dockerfile.substrate` ends with
`FROM base AS substrate-obsidian` (line 371), and the build step in
`.github/workflows/build-substrate-image.yml` passes `context`, `file`, `push`
and `tags` — but **no `target:`** — so buildkit builds the last stage. The
Makefile's local build gets this right and says why:

```
# --target base is load-bearing: without it docker builds the LAST stage
	    --target base \
```

So every image CI has ever published carries Xvfb, x11vnc, fluxbox, novnc and
websockify that the doc says are only in a separate flavour. `:obsidian` 404s
because it is redundant — `:dev` already is it.

**Fix:** this is a CI defect, not just a doc defect. Add `target: base` to the
workflow (and a second tagged build if `:obsidian` should exist), then correct
lines 163–165. Until CI is fixed, the doc should describe what is actually
published.

---

## 5. The image is public; the doc says private, four times

Lines **80, 138, 165, 673** all assert the image is private and that pulling
needs `docker login ghcr.io` with `read:packages`.

An anonymous pull works. The discriminating control matters, because the GHCR
token endpoint hands out a token regardless:

```
$ docker --config /tmp/emptydockercfg manifest inspect ghcr.io/avigopal/substrate:dev
{ "schemaVersion": 2, "mediaType": "application/vnd.oci.image.index.v1+json", ... }
   (/tmp/emptydockercfg/config.json is `{}` — no auths, no credential helper)

$ # anonymous layer blob — real image bytes, no login
HTTP 206 bytes=2048
/tmp/layerchunk: gzip compressed data, was "rootfs.tar"

$ # same anonymous flow, other repos — the token is NOT blanket-permissive
avigopal/substrate:dev                    -> 200
avigopal/substrate:latest                 -> 404   (repo readable, tag absent)
avigopal/definitely-not-a-real-pkg-xyz    -> 403
homebrew/core                             -> 403
```

The cost is a reader without a GitHub PAT concluding the documented path is
closed to them. `.github/workflows/build-substrate-image.yml` line 7 carries the
same stale claim in a comment.

---

## 6. Smaller, still load-bearing

**`PORT_OFFSET` does not shift every port (line 274).** The clean-room section
says it shifts "every published host port", unqualified, and the adjacent
Obsidian block presents `run-live-obsidian` as the same fleet. That target
hardcodes all nine of its ports and ignores `PORT_OFFSET` entirely:

```
$ make -n run-live-obsidian LIVE_NAME=substrate-scratch PORT_OFFSET=20000 | grep -E '^\s+-p '
    -p 18080:8080 ... -p 18270:8270 -p 16080:6080
```

Two clean-room fleets started that way collide on every port. (`run-live` itself
offsets correctly — verified on the real boot: all 9 ports landed on 24xxx.)

**`up` silently ignores a changed `PORT_OFFSET` on a stopped container
(line 240).** The Makefile guards against launch settings being ignored on
resume, but `LAUNCH_OVERRIDES` (Makefile:182) does not include `PORT_OFFSET`, so
`make up LIVE_NAME=… PORT_OFFSET=<new>` against a stopped container just
`docker start`s it on the **old** mappings. Port mappings are immutable Docker
config — exactly the class the guard exists for.

**The offset arithmetic is wrong (line 317).** "The container maps internal
ports to host ports with an 18000 offset" — the offset is **+10000**
(`8xxx` → `18xxx`). The mapping is uniform; the number is not.

**The trace-check curl omits auth (line 509).** Shown headerless; the endpoint
requires an `Authorization` header, so the documented command returns an auth
error rather than the trace it promises.

---

## Refuted — the doc was right

Recorded because a survived refutation is evidence, and these three would
otherwise look like unfixed findings:

- **Line 79** — "published by CI on every push to `dev`". Path-filtered, so a
  docs-only push publishes nothing. Judged aspirational-but-fair, not a defect.
- **Line 82** — "A Docker Hub mirror *may* exist". The hedge is satisfied: it
  exists and is anonymously pullable. (It is materially stale, and it does carry
  an `obsidian` tag that GHCR lacks — worth a follow-up, not a correction.)
- **Line 139** — whether `docker compose up -d` works *on this machine*. Time-
  dependent and environment-specific; not a property of the doc.

---

## What to change, in order

1. **Carry the compose volume-prefix warning into the doc** (§1) — the only
   finding that destroys data.
2. **Add `target: base` to the image workflow** (§4) — a CI defect; every
   published image is currently the wrong stage.
3. **Correct the four private-image claims** at 80, 138, 165, 673, and the CI
   comment (§5).
4. **Give the human surface a place in the doc** (§3): add `-p 18310:8310` to
   the raw invocation, add 18101 + 18310 to line 682, add
   `restart-human-surface-vessel` to the target list, and say that manifest
   vessels need `vessel-ctl install` before they serve.
5. **Say that `up` gates on the doctor** and can fail a first boot (§2); fix the
   doctor's cold-start diagnosis separately.
6. Qualify `PORT_OFFSET` (§6), add `PORT_OFFSET` to `LAUNCH_OVERRIDES`, fix the
   +10000 arithmetic, and show the auth header on the trace curl.

Items 2 and 6b are code changes, not doc edits. The rest are the doc catching up
to a system that moved.
