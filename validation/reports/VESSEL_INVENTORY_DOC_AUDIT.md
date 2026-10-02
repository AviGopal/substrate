# Auditing the documented setup and vessel-inventory management surface

Every claim below was checked against the repo inventory, the shipped scripts,
and a live fleet (`substrate-live`, default topology, no selection env set).
Read-only probes throughout: no `vessel-ctl apply` was run against a running
fleet, because `apply` mutates enable/mask symlinks.

The method rule: **read the layer that consumes the artifact.** A doc sentence
about a role group is checked against `vessels.inventory.json`, not against
another doc sentence; a doc sentence about a command is checked by running it.

---

## Where the instructions live

| Document | Covers |
|---|---|
| `docs/SUBSTRATE.md` § *Topology selection* | roles, role groups, the selection env and its precedence |
| `docs/SUBSTRATE.md` § *Where the inventory lives* | the three inventory copies; propagation vs application |
| `docs/SUBSTRATE.md` § *Managing a running fleet: `vessel-ctl`* | the twelve verbs |
| `docs/SUBSTRATE.md` § *`drift` and `apply`* | reporting and closing selection drift |
| `docs/SUBSTRATE.md` § *Recovering a fleet you masked* | the mask-recovery lever |
| `docs/operations/CONFIGURATION_SURFACE.md` | the full selection precedence chain |
| `README.md`, `docs/FEDERATION.md`, `docs/HUMAN_SURFACE.md` | `vessel-ctl install` for manifest vessels |

---

## Verified accurate

| Claim | Check | Result |
|---|---|---|
| `hub` = store, control, api, transport, seed, infra, registry, models | `jq .roles.hub` | exact |
| `spoke` = compute, ui, seed, infra, registry | `jq .roles.spoke` | exact |
| "the 26 autonomy units" | `jq '[.vessels[]\|select(.role=="autonomy")]\|length'` | 26 |
| Neither `hub` nor `spoke` includes `autonomy` | set difference | correct |
| Inventory flags exactly 3 manifest units | `jq 'select(.manifest)'` | human-surface, federation-relay, federation-transport |
| `vessel-ctl`'s installable set is "one larger — also `metric-collector-vessel`" | `vessel-ctl list` vs `vessels.manifest.json` | 4 vs 3, exactly as described |
| The two files emit different forms (`<unit>.service` vs bare name) | both queries | correct |
| Ten named tools ship on `PATH` | `command -v` × 10 | 10/10 present |
| Twelve `vessel-ctl` verbs | `vessel-ctl` usage line | all twelve, `deregister` included |
| `status` prints `restarts=` beside the state | `vessel-ctl status` | present on every row |
| `drift` is read-only and prints three sections | ran it | three sections, `DRY_RUN=1` in the source |
| `drift` output is not truncated | source review | the `tail -20` was removed, with the measurement recorded |

---

## Inaccurate

### 1. `full` does not exclude `desktop`

> "`full` = every role except `desktop`" … "unset is a total no-op that masks
> nothing at all, `desktop` included, whereas `full` masks anything absent from
> the list."

`.roles.full` carries **all twelve** roles that any unit declares, `desktop`
among them:

```
$ jq -r '([.vessels[].role]|unique) - .roles.full | join(", ")'
(empty)
```

So `ENABLED_ROLES=full` masks nothing, and the contrast the passage draws
between `full` and unset does not exist. The nearby claim that "any
`ENABLED_ROLES` value masks them on an obsidian image" is wrong for `full` for
the same reason.

**How it happened:** the prose was written at `6d19c0a0`; `desktop` was added to
`.roles.full` a day later at `d63d64b6`, a commit that edited `docs/SUBSTRATE.md`
in the same change and left this sentence alone. Code moved, doc did not.

### 2. The Makefile does pass `PROFILE` and `ENABLED_EXTRA_VESSELS`

> "`PROFILE`, `ENABLED_EXTRA_VESSELS` — **never passed to `docker run` by the
> Makefile on ANY path**, including a fresh create — so `make up`/`recreate`
> cannot set them at all"

Both are passed on both run lanes (`Makefile:563-564`, `:635-636`). The remedy
column ("raw `docker run`, or `deploy-hub.sh`") is therefore misleading.

What remains true is the *other* half: neither name appears in
`LAUNCH_OVERRIDES` (`Makefile:242`), so supplying them to `make up` against a
**stopped** container is silently ignored. The row belongs in the doc's
"unguarded and silently dropped" class, not in "cannot set them at all".

### 3. The default selection is not a no-op

> "**Default (none of the three set) = every baked unit enabled = the full local
> substrate** (`apply-inventory.sh` is a no-op)."

`apply-inventory.sh` documents at length why the early `exit 0` on this branch
was a defect and was removed: the no-selection path now falls through to the
unmask and enable passes, so it actively clears masks left by a previous
selection and enables units added since image build.

`SUBSTRATE.md` says the corrected thing 700 lines later — "The bare `apply`
above is the default topology, and it now clears masks. It did not always" — so
the document contradicts itself, and the stale half is the one a reader meets
first.

### 4. The selection precedence list is incomplete

§ *Topology selection* lists `ENABLED_VESSELS` > `ENABLED_ROLES` >
`DISABLED_VESSELS`, and omits `PROFILE` (which outranks all three, fatally on an
unknown name) and `ENABLED_EXTRA_VESSELS` (additive, applied after roles).
`docs/operations/CONFIGURATION_SURFACE.md:107` carries the complete chain, so the
two documents in this repo describe the same mechanism differently.

---

## Code defects the audit exposed

### 5. The documented mask-recovery lever is defeated on the fleets that need it

The doc's recovery instruction, and its explicit rationale:

> ```bash
> docker exec -e ENABLED_ROLES=full <container> vessel-ctl apply
> ```
> **The selection is injected through `docker exec -e`.** It is not persisted in
> `/etc/substrate/env`, so a bare `apply` uses whatever the container was created
> with — which is why the `-e` form is the in-place lever.

`vessel-ctl.sh:394` runs:

```sh
set -a; . /etc/substrate/env 2>/dev/null || true; set +a
/usr/local/bin/apply-inventory
```

Sourcing **overwrites** the injected value. And the premise is false for the
case that matters: `gen-env.sh:754` writes `ENABLED_ROLES=` into
`/etc/substrate/env` whenever it is set, and `gen-env.sh:410` sets it to `spoke`
on every spoke. Measured, both branches of the 2×2, with the caller's exact
idiom:

```
env file has NO ENABLED_ROLES line   -> apply-inventory sees ENABLED_ROLES=full   (lever works)
env file has ENABLED_ROLES=spoke     -> apply-inventory sees ENABLED_ROLES=spoke  (lever defeated)
```

Applying a narrow selection is what masks units in the first place, so the fleet
needing recovery is precisely the fleet whose env file pins the narrow
selection. The widening `apply` then re-applies the *narrow* selection and
reports success. The doc's own history records the previous version of this same
failure — "58 units masked, 9 core vessels dead, `{"ok":true}` returned" — and
the replacement lever has the same shape of silence.

**Fixed**, rather than documented around: the doc stated the contract and the
code violated it, and nobody wants file-over-injection (with no injection the
file still wins, because there is nothing to re-export). `selection_override()`
captures the five selection names from the calling process and re-exports the
non-empty ones after the source, in both `apply` and `drift`; `drift` now prints
an `OVERRIDDEN for this run` line so the selection it reports is the one it would
apply.

Verified through the real code path — only the env-file *path* was redirected so
the quoting and re-export run verbatim:

```
file=spoke, no injection          -> compute infra registry seed ui          (file wins, unchanged)
file=spoke, -e ENABLED_ROLES=full -> api autonomy compute control desktop …  (injection wins)
file=spoke, -e spoke,autonomy     -> autonomy compute infra registry seed ui (multi-token survives)
file=spoke, -e DISABLED_VESSELS=… -> carried, 52 units would be disabled     (second var carried)
```

A first attempt to verify this reported `FATAL: unknown token(s): 'full'` — the
hand-written test did `export$_sel` on a shell *variable*, which word-splits
without quote removal, so the literal quotes reached `apply-inventory`. In the
script the same text is inside the command string the nested shell parses, so the
quotes are syntax. The defect was in the probe, not the fix.

Filed as `gap-vessel-ctl-apply-overrides-the-injected-selection`, now closable.

### 6. `drift` reports installed manifest vessels as ungoverned

On this fleet `drift` warns:

```
warn: 2 shipped unit(s) absent from the inventory — ungoverned by ENABLED_ROLES:
warn:   unmanaged: human-surface-vessel.service
warn:   unmanaged: metric-collector-vessel.service
```

`metric-collector-vessel.service` is a true positive — it is genuinely absent
from `vessels.inventory.json`. `human-surface-vessel.service` is **present**
(role `ui`, `manifest: true`), and the warning fires only because the comparison
baseline is `manageable_units()`, which filters `manifest:true` out
(`apply-inventory.sh:265-269`). Any installed manifest vessel is therefore
mislabelled as a packaging omission. The function's comment claims "0 false
positives", corpus-tested — the corpus evidently had no manifest vessel
installed.

Filed as `gap-drift-mislabels-installed-manifest-vessels-as-ungoverned`.

### 7. The docs checker reads role names as shape tokens

Running `docs_align_scan` over `docs/SUBSTRATE.md` returns 16 findings, and 14 of
them are the twelve **role** names plus the group alias `full`:

```
docs/SUBSTRATE.md:17: unknown shape token "store"
docs/SUBSTRATE.md:17: unknown shape token "control"
… (all twelve roles)
docs/SUBSTRATE.md:32: unknown shape token "full"
```

The doc is correct; the checker cannot tell a backticked role token from a
backticked impulse shape. This is the same class the resolver's own comments
were written to close — "a checker that fails on correct docs trains its readers
to ignore it, which is worse than no checker".

Filed as `gap-docs-checker-reads-role-names-as-shape-tokens`.

---

## Verifying the corrections

The four doc fixes were checked with the substrate's own checker, baseline
against edited, line numbers normalised because the edits shift them:

```
baseline (HEAD:docs/SUBSTRATE.md) : 16 findings
edited   (working tree)           : 16 findings
normalised diff                   : IDENTICAL — no finding added or removed
```

**The first attempt at this measured nothing.** Passing `corpus` as a bare array
returns `findings=0`, because `coerceCorpus` accepts `{documents:[…]}` or a JSON
string and falls through to an empty document list for anything else — so the
scan reported a clean doc while scanning no document at all. The control caught
it: a copy carrying a dated status marker, a prose instance name and a
nonexistent script path *also* returned 0. With the corpus shaped correctly the
control returns 18 against the same file's 16, so the two extra findings are the
planted ones and the zero is no longer vacuous.

---

## Not a defect, but worth stating

`vessel-ctl status` on a default fleet shows **28 units `disabled`**, which reads
as a contradiction of "every baked unit enabled". All 28 are the `.service`
halves of timer pairs; their `.timer` units are enabled, and systemd pulls the
service when the timer fires. Verified by checking each disabled unit for a
sibling `.timer`: 28 of 28 have one. The documentation does not say this, and a
reader following it has no way to tell the expected 28 from a real outage.
