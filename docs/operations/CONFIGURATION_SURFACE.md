# The configuration surface — channels, precedence, and what can be verified

Configuration is the one region of this system with **no learning loop**. Environment is
frozen at process start, invisible to traces and to the walk, so no activity selects over it
and no posterior grades it. Every other class of defect eventually surfaces as a
`reached:false` and gets weighted down by the loop. A configuration defect waits for a human
to look directly at it.

That is the reason this document exists, and the reason its central claim is not a list of
variables but a **method**: what channel delivers a value, what beats what, and which
assertions can be re-measured rather than believed.

Everything here is reproducible with `scripts/substrate/config-surface-probe.sh`. Where a
number appears, the command that produced it appears beside it. Numbers drift; the prior
hand-written audit's findings went stale in *both* directions within days — one defect fixed,
one still live, nothing reporting either.

---

## 1. There is one funnel, and four channels through it

Every vessel unit carries `EnvironmentFile=/etc/substrate/env`. **No unit carries
`PassEnvironment`.** systemd is PID 1 and does not export its own environment to the units it
spawns, so:

> A variable `gen-env.sh` does not emit is invisible to every vessel, no matter how it was
> passed.

`gen-env.sh` is therefore an **allowlist**, and it is the layer at which "did my value
arrive?" is a meaningful question. Comparing launch lanes at the `docker run` layer compares
*intentions*; comparing at gen-env's output compares what a vessel can actually read.

```bash
# what a standalone boot emits
docker run --rm -e ANTHROPIC_API_KEY=… --entrypoint bash <image> \
  -c 'gen-env >/dev/null 2>&1; grep -cE "^[A-Z_]" /etc/substrate/env'
```

| # | Channel | Written by | Delivered by | Visible to `substrate-config`? |
|---|---|---|---|---|
| 1 | `/etc/substrate/env` | `gen-env.sh` (`cat >`, **truncating**) | `EnvironmentFile=` in every unit | yes, with provenance |
| 2 | unit `Environment=` lines | baked into the image | the unit itself | **no** |
| 3 | `.service.d/*.conf` drop-ins | baked into the image | applied after the main unit | **no** |
| 4 | side files | `render-llm-arms.sh`, `gen-env.sh` | a second `EnvironmentFile=` | **no** |

Channel 4 has two members with different lifetimes: `/etc/substrate/llm-<arm>.env` (per-arm
model pin, regenerated every boot) and `/workspace/.substrate-secrets` (**the only durable
container-side config** — `/etc/substrate` is not on a volume).

### Channels 2 and 3 are a blind spot, not an override

Both are invisible to the tooling built to answer "did my `-e` win?" — `substrate-config`
reads channel 1 and its provenance sidecar, and cannot see the other three. Names appearing
*only* in channel 2 have no operator delivery path and no provenance record at all.

```bash
# names set by unit files; how many appear in no other channel
docker run --rm --entrypoint bash <image> -c \
  'grep -h "^Environment=" /usr/lib/systemd/system/*.service | sed -E "s/^Environment=//; s/=.*//" | sort -u'
```

Measured: **52 names in channel 2, of which 48 appear nowhere else.** They are behavioural
knobs frozen into the image — `SURGICAL_SCAN_CAP`, `TASK_GENERATION_ENABLED`,
`OPERATOR_GOAL_GEN`, `EMIT_GAPS`, `RECOVER_CAP`, `OBSIDIAN_LEARN_MODE` — Tier-1 settings
(§3) stuck in a tier that has no delivery path.

**On collision, channel 1 wins.** systemd applies `Environment=` first and `EnvironmentFile=`
afterwards, *regardless of line order in the unit*. This is easy to get backwards by reading
the file top-to-bottom; verify it rather than reason about it:

```bash
# two marker units, opposite orders; both must report from_envfile
printf 'X=from_envfile\n' > /tmp/t.env
# unit A: EnvironmentFile= then Environment=X=from_inline
# unit B: Environment=X=from_inline then EnvironmentFile=
systemctl start ordA ordB && journalctl -u ordA -u ordB -o cat | grep RESULT
```

Four names collide (`WORKSPACE_ROOT`, `MITOSIS_DIRECT_PUSH`, `MITOSIS_RUNTIME_DIR`,
`MITOSIS_PUSH_CLONE_DIR`) and resolve to the operator's value.

Channel 3 is the exception that *does* override, because drop-ins are applied after the main
unit. It is also the least visible, and it carries live behavioural decisions: peer endpoints,
route preferences, and boredom pacing overrides of 240×–300× the in-code default.

---

## 2. Precedence, end to end

```
  docker run -e   >   shell env at compose time   >   repo .env   >   compose ":-" default
      └── these four are indistinguishable to gen-env: they are just "the run environment"
   >  /workspace/.substrate-secrets      (per-field grep — never sourced, so an operator
   >  gen-env generated (openssl)         value cannot be clobbered by the persisted one)
   >  gen-env hardcoded literal
  ─────────── resolution ends; the value is written to /etc/substrate/env ───────────
   >  unit Environment=
   >  EnvironmentFile=/etc/substrate/env          (beats Environment=, see §1)
   >  EnvironmentFile=-/etc/substrate/llm-<id>.env (later file wins → per-arm pin)
   >  .service.d/*.conf Environment=              (applied last, beats everything)
   >  post-boot mutation (seed-identity.ts rewrites METABOB_API_KEY in both files)
   >  in-code default
```

Three sub-chains deviate:

- **Vessel selection**: `PROFILE` > `ENABLED_VESSELS` > `ENABLED_ROLES`, then
  `+ ENABLED_EXTRA_VESSELS`, then `− DISABLED_VESSELS`. Emitted conditionally — an unset
  selection stays absent, and `apply-inventory` reads absence as "keep everything".
- **Endpoints** insert a derivation tier: explicit env > **spoke auto-derivation** from the
  discovery host (scheme + port-offset arithmetic) > alias chain > loopback literal.
- **`.env` only reaches the container for names listed in compose's `environment:` block.**
  An unlisted name in `.env` is a no-op regardless of the value.

### Persistence is two halves

A `persisted_secret` **read** without a matching **write** leaves the value in the file while
the next boot resolves to empty anyway; a write without a read does the same in reverse. Both
halves are required, and the probe checks for the mismatch:

```
   PHANTOM (gen-env reads it from .substrate-secrets; nothing writes it):
```

**Known limit, shared by all ~20 persisted names:** `${VAR:-…}` cannot distinguish *unset*
from *explicitly emptied*, so `-e VAR=` does not clear a persisted value. Clearing one means
editing `/workspace/.substrate-secrets`. The Makefile solved this for provider keys with
`RECREATE_CARRY_PRESENT` (carry by presence, not by value); the same treatment has not been
applied inside gen-env.

---

## 3. Two tiers — the distinction that decides what can become a shape

**Tier 0 — bootstrap.** Irreducibly three things: *who am I* (credential), *where is the
network* (one endpoint), *where does my data live* (volume, ports). Frozen by nature, must
fail closed, cannot be graded.

**Tier 1 — behavioural.** Everything else. Under law 1 these should be shaped impulses read
at use time, observable in the trace of the execution that consumed them. Today they are env,
which is why the surface is as large as it is: **the size of the config surface is a direct
measure of unfinished derivation and unfinished shaping.**

What determines whether a Tier-1 variable *can* move:

| Read site | Consequence | Shape candidate? |
|---|---|---|
| Column-0 `const` (module load) | frozen for the process lifetime; needs a restart | not without refactoring |
| Inside a function body | re-evaluated per call | **yes** |
| `import.meta.env.VITE_*` | inlined at bundle time; needs a rebuild | no |

Every `SURREALDB_*` read is module-load, so the database contract cannot change without
restarting the fleet. The precedents to follow already exist in-tree: `trace-retention.ts`
takes `env` as an injectable parameter, and `gap-lifecycle-scan.ts` reads at call time *and
documents why*.

---

## 4. Scale, and what the measurement cannot see

| Dimension | Count | How |
|---|---|---|
| Names emitted into `/etc/substrate/env` | **72–80 — conditional, not a constant** | `grep -cE '^[A-Z_]' /etc/substrate/env` after a boot. **Emission depends on what you supplied** (an absent provider key emits no arm), so this is a range and the command cannot reproduce a single number. A fixed count was carried here once and disagreed with `config-surface-baseline.txt` in the same repo. |
| Names offered by `run-live` / `run-live-obsidian` / compose | 45 / 45 / 40 | `config-surface-probe.sh` |
| Distinct names read across vessels and packages | ~451 | dot + bracket + helper forms, `sort -u` |
| Names in unit `Environment=` lines | 52 (48 unique to that channel) | §1 |
| `.service.d` drop-in files | 34 total, 10 carrying `Environment=` | `grep -l Environment= …/*.service.d/*.conf` |
| Names documented in `.env.example` | 50 (2 uncommented) | `grep -oE '^#? ?[A-Z_][A-Z0-9_]*=' … \| sort -u` |
| `_ENV_SUPPLIED` provenance snapshot | 33 | `gen-env.sh` |

**The scanner's own blind spots**, stated because a count presented without them invites
false conclusions:

- `process.env["FOO"]` bracket form is dominant in six vessels. **A dot-only grep misses
  roughly 40% of the fleet.**
- Helper forms — `parseEnvInt('NAME', …)`, `envOr("NAME", …)` — are invisible to both. The
  `TRACE_*` family is read exclusively this way.
- `concept-db` calls `parseEnvInt(key, …)` with a **caller-supplied** key. Those reads cannot
  be statically enumerated by any scanner.
- Shell consumers (`scripts/substrate/*.sh`, the tick scripts) are a separate population.
  Several names that look unread by vessels are read by scripts.

Consequence: the honest statement is "N names are read *by the forms this scan covers*". A
name absent from a scan is not evidence of a name absent from the system — the same
distinction as "a zero read through a filter measures the filter".

---

## 5. Default drift — the failure mode of a point-and-go join

This is the most consequential category, because a default only applies when a variable is
*unset*, which is exactly the state "point at a hub and go" depends on.

| Variable | Distinct defaults | Worst pair |
|---|---|---|
| `SURREALDB_URL` | 5 | `localhost:8000` vs a Kubernetes service DNS name vs `ws://…` |
| `SURREALDB_PASSWORD` | 4 | **`changeme` vs `root`** — two vessels reaching the same database with different default credentials. The originally-cited pair (activity-api vs relevance-sink) has since been repaired; `relevance-sink-vessel/src/index.ts` now defaults to `changeme`. The class is still live — e.g. `development-vessel/src/resolvers/orphaned-org-write-scan.ts` defaults to `root`. **Re-derive the instances before citing them; do not quote this row as current.** |
| `DISCOVERY_ENDPOINT` | 4 | `discovery-vessel:8080` (wrong port for this fleet) and `localhost:8765` (a port used nowhere else) |
| `ACTIVITY_API_ENDPOINT` | 4 | includes activity-api pointing at its **own** wrong port |
| `GOAL_HOST_VESSEL_ENDPOINT` | 2 | `:8210` in 12 sites; `:8090` — the dev-vessel port — in one |
| `FED_HEALTH_PORT` | 2 | `8401` in three consumers, `8402` in the server itself |

Adjacent hazards of the same kind:

- **Alias sprawl** — 11 distinct names are used for the same API key across vessel source
  (`grep -rhoE '(METABOB_API_KEY|API_KEY|…)' repos/*/src | sort -u`), plus multiple aliases
  each for the activity, discovery, identity and dev-vessel endpoints. gen-env emits 5 of the
  key aliases, so `?? process.env["API_KEY"]` and `?? DEV_VESSEL_API_KEY` fallbacks are
  **dead in-container** — they can only fire outside systemd.
- **Port collision** — `metric-collector-vessel` defaults `PORT` to `8280`, the same as
  light-dispatch. Only a channel-2 `Environment=PORT=8300` keeps them apart; run either
  outside systemd and they clash.
- **Weak secret literals** — one `dev-secret-change-in-production` string serves both
  `JWT_SECRET` and `API_KEY_SECRET` across five identity-vessel files, plus an `HMAC_SECRET`
  equivalent. The insecure-value gate exists for `API_KEY_SECRET` **only**.

Each row is a decision about which default is correct, not a mechanical edit.

---

## 6. Re-deriving this document

```bash
scripts/substrate/config-surface-probe.sh              # report; exit 1 on drift
scripts/substrate/config-surface-probe.sh --baseline   # accept the current state
PROBE_USE_IMAGE=1 scripts/substrate/config-surface-probe.sh   # measure the published image
```

By default the probe runs the **worktree's** `gen-env.sh` — a pre-commit check. It costs no
LLM tokens and writes no traces, so unlike `substrate-doctor`'s arm check (which POSTs a real
completion to every arm) and `--smoke` (which writes a real execution trace), it is safe to
run in a loop.

What it reports, and why each exists:

| Section | Catches |
|---|---|
| `DROPPED` | a lane passes a name gen-env never emits — delivered to nothing |
| `HARDCODED` | the name is emitted but your value was replaced by a literal |
| cross-lane differential | two lanes that claim to launch the same thing and do not |
| `UNOFFERED` | `.env.example` documents the name and this lane never passes it — the axis the other rows cannot reach, because every one of them starts from what a lane *already* passes. Both autonomy kill switches hid here |
| `MANGLED` | the name is emitted and the value still carries the sentinel marker, but is not byte-identical to what was supplied — a value CORRUPTED in transit. Scoped to names documented as JSON, because gen-env legitimately *derives* many values and an unscoped byte-comparison reports nine false positives |
| `PHANTOM` | a persisted read with no matching write |

Sentinels for names documented as JSON are **JSON**, quotes included. They were all
alphanumeric, which made the probe structurally unable to observe a quoting defect — and
one was live: values were emitted with a raw `NAME="${VAR}"` wrap and no escaping, so a
documented JSON value reached its consumer as invalid JSON and was swallowed by a warning.
A probe that only supplies easy inputs measures how the system handles easy inputs.

**A probe that cannot run must say so, never produce a number.** Three ways this one lied
before it was trusted, each now guarded in the script:

1. A swallowed daemon-side `mounts denied` reported every lane as emitting **zero** names — a
   harness failure wearing the costume of the most alarming possible finding. stderr is now
   kept and an empty emission set is a fatal error, because gen-env either fails closed
   (writing nothing *and* exiting non-zero) or writes ~72 names. Zero with a clean exit is
   impossible.
2. The sentinel check counted the probe's own abstentions — the provider key and nine
   endpoints it deliberately does not fake — as discarded values. Ten false positives, all
   plausible. It now judges only names that actually carried a sentinel.
3. It executed the image's baked `gen-env` while grepping the worktree's, comparing two
   revisions and attributing the difference to the substrate.

The third is the general form and the one worth carrying: **when a check reads one artifact
and exercises another, its findings describe the gap between them, not the system.**

---

## 7. Why a script and not a pasted command

A check nothing invokes cannot be trusted when it passes, because it is never observed
failing. The hand-written audit this supersedes
(`validation/findings/config-surface-audit.md`) was a `docker run` pasted into prose; its
`VLLM_*` finding was fixed and its advertise-variable finding stayed live, and nothing
reported either.

The remaining step, unbuilt: this probe is a script, so it is still only as good as the habit
of running it. Under law 2 the check belongs to an **activity** the loop can grade — at which
point the configuration surface finally acquires the feedback the first paragraph says it
lacks.
