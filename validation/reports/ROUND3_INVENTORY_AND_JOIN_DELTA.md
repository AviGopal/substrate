# Round three: what four clean-environment journeys found

The third pass over the inventory and the setup/join/manage surface. It does
**not** supersede [`ONE_SURFACE_AUDIT_DELTA.md`](./ONE_SURFACE_AUDIT_DELTA.md) —
that report's findings stand, and a chain of superseding documents is its own
kind of drift. This one cross-references it: what its "Still open" list looks
like now, and what is new.

Two things make this round different from the last. Everything was checked
against the **published image** `ghcr.io/avigopal/substrate:dev`, whose
`vessel-ctl` / `apply-llm-arms` / `apply-inventory` / `substrate-config` were
first confirmed byte-identical to HEAD — so a finding against the image is a
finding against HEAD, and the journeys tested what a person following the docs
today would actually pull. And three of the four journeys **launched real
fleets**: a hub+spoke pair, a hub+surface pair, and a single container exercised
verb by verb. The live half is where the important findings came from.

---

## 1. The headline: federation is one-directional

Two documents promise that a spoke needs no LLM key because it inherits the
hub's arms through discovery ([`FEDERATION.md`](../../docs/FEDERATION.md):165,
[`SUBSTRATE.md`](../../docs/SUBSTRATE.md):335). Measured on a live hub+spoke
pair, the outbound half works perfectly and the inbound half does not exist.

All nine spoke vessels registered into the hub and *refreshed* on a ~2-minute
heartbeat — not merely present, which a surviving record would also look like:

```
REFRESHED discovery-vessel@spoke-7c791e8f            05:14:53.807 -> 05:16:53.801
REFRESHED goal-host-vessel@spoke-7c791e8f            05:14:53.809 -> 05:16:53.803
… all nine, protocol: libp2p
```

The spoke resolving a hub-owned shape:

```
$ curl -s -X POST :26100/resolve -d '{"shape":"vesselCapability",
    "pointer":{"type":"vesselCapability","shape":"llmCompletion"}}'
{"content":{"shape":"llmCompletion","vessels":[],"found":false}}
```

The byte-identical query against the hub returns `found:true` with
`llm-resolver-vessel`, so that is a real negative and not a query-form artifact.
The spoke's discovery is configured correctly — `PEER_DISCOVERY_ENDPOINTS`,
`PEER_FANOUT_MODE=union`, `MAX_PEER_DEPTH=1` all present — and still returns
nothing.

**The filter is right; the registration is wrong.** Discovery keeps only
*dialable* peer rows: a non-empty `libp2p_multiaddr`, or an endpoint that is not
loopback. Every hub vessel fails both, because every hub vessel registers itself
as `http://127.0.0.1:<port>` with no multiaddr. `VESSEL_ADVERTISE_ENDPOINT` /
`SUBSTRATE_ADVERTISE_HOST` are named as the cure at `FEDERATION.md:80` — for the
spoke direction only, and that line is the sole occurrence of either name across
`docs/`, `README.md`, the Makefile and `gen-env.sh`. Neither is set on a hub.

This happens at the discovery layer, *before* anything about keys or models
matters. The docs now carry the measurement rather than the promise; the fix is
in `repos/discovery-vessel` and is out of scope for a docs-and-scripts round.

---

## 2. A masked fleet had no way back

The vessel-management journey found the worst defect of the round, and it was in
the verb this surface exists for.

`apply` with a narrower selection masks what it excludes. That is correct. The
documented recovery — a bare `vessel-ctl apply`, which the inventory header and
`drift` both call "every baked unit enabled" — did nothing:

```
$ docker exec r3-manage vessel-ctl apply
[apply-inventory] no ENABLED_ROLES/… set — all units enabled (default)
[apply] converging running state
{"ok":true,…,"note":"selection re-applied and running state converged"}

development-vessel  masked inactive     goal-host-vessel   masked inactive
local-tools-vessel  masked inactive     analysis-vessel    masked inactive
ribosome-vessel     masked inactive     … 58 units masked, 9 core vessels dead
```

And `drift`, whose entire job is answering "is this fleet running what it
should?", issued a **clean all-clear at that same moment**.

Every other exit was closed too: `start` refuses a masked unit, `restart`
refuses it and advises "unmask it deliberately" — and there is no `unmask` verb.

The cause was one `exit 0`. The no-selection branch returned early on the
reasoning that "want everything" needs no work. It needs two kinds: clearing
masks left by a *previous* selection, and enabling units added after the image
was built. Both passes sat past that exit, so the one selection that should be
able to restore anything was the only one that could not.

Fixed by falling through instead of exiting. Proven at the consuming layer, with
masks planted in a real container:

```
$ ln -sf /dev/null /etc/systemd/system/{goal-host-vessel,development-vessel}.service
OLD baked script, default lane:  0 "would unmask" lines
NEW script,        default lane:  DRY-RUN would unmask: development-vessel.service
                                  DRY-RUN would unmask: goal-host-vessel.service
```

The same edit closes a second finding: 13 timers plus
`development-vessel-seed.service` exist in `/lib/systemd/system`, appear in no
`*.target.wants` in the image, and are reported by `apply-inventory` as
`(was never enabled — new unit)` under `ENABLED_ROLES=full`. They were enabled on
no default-topology container, because the enable pass was behind the same exit.
Patching the Dockerfile bake-list would have fixed the instance; this fixes the
class, which is what a unit added tomorrow needs.

---

## 3. `drift` was under-reporting by 19 of 21

Deterministically reproduced from a spoke-masked fleet:

```
predicted=2   apply-logged-unmasked=21   actually-unmasked=21
```

`vessel-ctl drift` piped the dry run through `tail -20`. The truncation was
biased in the worst possible direction: unmask lines cluster early in inventory
order, disable lines dominate the tail — so the preview systematically dropped
the *restorative* half, with no "…N more" marker. The two it showed were exactly
the last two lines of the untruncated 73-line report.

`apply`'s converge block had the same shape (`| head -40`) against a doc promising
that "an apply that prints no action lines is a genuine no-op rather than a silent
failure". Both pipes are gone.

---

## 4. `make -n up` printed the operator's real credentials

```
$ make -n up | grep -oE '(sk-ant-[A-Za-z0-9_-]+|gho_[A-Za-z0-9]+)'
LEAK len=108 prefix=sk-ant-      # the operator's real Anthropic key
LEAK len=108 prefix=sk-ant-
LEAK len=40                      # a host GitHub OAuth token
```

Round two mentioned this only inside its *Refuted* section, as the explanation
for a false-positive committed-key report. It was never carried onto the open
list, so it survived.

**The obvious fix does not work.** `@`-prefixing the recipe lines changes
nothing, because `make -n` prints `@`-prefixed lines too — I applied it, re-ran
the probe, and still got three hits. The value has to stop being interpolated
into the recipe *text* at all. Every secret is now `export`ed and passed as a
bare `-e VAR`, which docker reads from the recipe's environment:

```
before: -e ANTHROPIC_API_KEY="$(ANTHROPIC_API_KEY)"     # value lands in the recipe text
after:  -e ANTHROPIC_API_KEY                            # value never appears
```

41 sites converted, plus the two provider-key guards that interpolated the value
into a shell test. Verified both directions — no leak on any of `up`, `run`,
`run-detach`, `run-live`, `run-live-obsidian`, `recreate`, and a scratch harness
confirming the value is still *delivered*, including the empty case:

```
--- default (config fallback) ---   ANTHROPIC=[from-config-fallback]
--- command-line override ---       ANTHROPIC=[cli-supplied-value]
--- recipe text under -n ---        docker run --rm -e ANTHROPIC_API_KEY …   (no value)
```

**Related, and worse, because it persists.** A UI-only spoke launches with
`ANTHROPIC_API_KEY=""` deliberately. `make recreate` refilled it from the
operator's `~/.metabob/config.json` and the real key landed in the spoke's
*persisted* `.substrate-secrets` — `len=0` before the recreate, `len=108` after.
`RECREATE_CARRY` skips empty values, so a deliberate blank was indistinguishable
from "not set" and the fallback won. Provider keys are now carried by **presence**
rather than by value, so an explicitly-empty key survives a recreate.

> ⚠ **The operator's Anthropic key reached terminal output during this audit**,
> before the fix landed. The surface journey captured it into a log, scrubbed all
> four session logs, and destroyed the holding volume — but it was exposed, and
> **it should be rotated.** The same applies to the `gho_` GitHub token.

---

## 5. Standing up a hub was undocumented, and `roles=hub` is not enough

The join journey's spoke half worked exactly as written — two inputs, every
documented derivation holding. The hub half had no documented path at all
outside `deploy-hub.sh` over SSH to a VM, and took four undocumented steps.

`ENABLED_ROLES=hub` boots a container that answers `/health` everywhere and
serves an empty `/bootstrap` — which, by this documentation's own pre-flight
test, means "not a hub". The relay is a **manifest** vessel, so it is never
baked or auto-installed. Then:

- **`PUBLIC_IP` had to be set by hand.** The relay hard-exits without it under
  `Restart=always`, so it fails as a permanent crash-loop reporting
  `NRestarts=5 ActiveState=activating` — never `failed`, invisible to any
  `--state=failed` check. `PUBLIC_IP` appears in no launch documentation and the
  Makefile passes it on no lane.
- **`/bootstrap` stayed empty with the relay healthy.** The chain is *designed*
  to be automatic and one link has no producer: `vessels.manifest.json:42` gives
  `federation-relay` a `post_install` hook that greps `RELAY_MULTIADDR=` out of
  `/workspace/fed-relay.log`. The unit is `StandardOutput=journal` and **nothing
  writes that file** — the only reference to it in the tree is the line that
  reads it. The hook loops 20×1s and exits silently, so `vessel-ctl install`
  reports `ok:true`.
- **Discovery had to be restarted**, because nothing else re-reads the env.

All four steps are now documented in `FEDERATION.md` § *A hub that is not on a
VM*, with the `relay_multiaddrs | length` check that distinguishes a hub from a
container that looks exactly like one. The `post_install` hook reading a file
nothing writes is a real defect left open — it needs the relay's stdout captured
or the hook rewritten against the journal.

**Addressing, which no doc mentions.** `DISCOVERY_ENDPOINT` must be reachable
*from inside the spoke container*. Every example writes `http://<hub-host>:18100`;
on a single host that is neither `localhost` (the spoke's own loopback) nor
obvious. The natural first attempt produces a spoke that boots, looks healthy,
and is joined to nothing.

---

## 6. Smaller live findings

- **`status` hid exactly the units you must act on.** After `apply` masked seven
  vessels the fleet view went 43 → 25 lines and they vanished — no `masked` row,
  no count — while the doc's instruction after an apply is "Confirm with
  `vessel-ctl status`". `status <name>` showed the masked row all along, proving
  a filter rather than a vocabulary gap. The same filter dropped `static` units,
  and the comment justifying it ("a substrate vessel … is enabled or disabled,
  never static") was measured false: `self-recovery`, `autonomy-metrics` and
  `light-dispatch-healthcheck` are static because they are timer-triggered — and
  they are the liveness watchdogs, armed, firing, and invisible. Both now print;
  Debian's statics are excluded by inventory membership instead of by state.
- **`deregister <typo>` still faked success** — the last verb doing so.
  `{"ok":true,"action":"deregistered"}`, exit 0, against a positive control on
  the same fleet where the real name emitted a removal line and the typo emitted
  none. Two causes: no existence check, and `|| true` swallowing the exit status.
- **The LLM arms hold a pre-seed placeholder key for the life of the container.**
  `reseed-restart.sh` picks its restart targets from the inventory, and the
  rendered arms are deliberately not in it — so they never get the key identity
  minted. Measured: `llm-haiku` `METABOB_API_KEY len=31`, `llm-resolver-vessel`
  `len=160`; 20 of 40 discovery heartbeats answered 401, while the arms reported
  `active enabled restarts=0` and `substrate-doctor` PASSed "no failed units".
  These are the arms a spoke is documented to inherit. The sweep now covers them
  by glob, which is how they exist.
- **`make vessel-ctl <anything>` silently succeeded.** `vessel-ctl` has no
  `enable` verb, but make never got that far: the built-in `%: %.sh` rule matched
  `vessel-ctl.sh`, copied it, and exited 0. Deleting the passthrough absorber is
  **not** sufficient — the bare form still succeeds. `.SUFFIXES:` is what closes
  it. Same class as round two's `.PHONY` finding, reached by a different path.
- **`vessel-ctl`'s own usage text was wrong** in three ways at once: bash's
  `${1:?}` prefix noise, the source filename rather than the installed one, and
  a verb list missing `start`/`stop` — the two verbs the docs prescribe for
  recovery.
- **`gen-env.sh` violates an invariant stated four lines above the violation.**
  A comment inside the unquoted `env` heredoc contains backticks; both spans
  execute at generation time, so every boot emits
  `gen-env: line 447: docker: command not found` and writes the comment mangled.
- **The compose lane could deliver the insecure escape hatch but not the
  remedy.** `gen-env` fails closed on an existing datastore with no
  `API_KEY_SECRET` and names it in the error — the one variable compose did not
  forward. It forwarded `ALLOW_INSECURE_API_KEY_SECRET`, which leaves keys
  forgeable.
- **A surface does not survive `make recreate`.** `ui/dist` lives on the volume
  and survives; the unit file and the `HOST=0.0.0.0` drop-in live in
  `/etc/systemd/system` and do not. The port then answers nothing, and re-running
  the launcher refuses on the existing container name.
- **`ui-only-up.sh` told readers to set the wrong key.** Its no-hub error
  suggests `.metabob.endpoint` — the trace store, which the fallback then uses
  *verbatim, port and all*, with only a scheme check. It also advertised a 120s
  poll for a loop that is up to ~440s, and explained `401` while leaving
  `HTTP 000` (a connect failure) to read as a federation failure.

---

## 7. The prior "Still open" list

| Round-2 item | Status | Evidence |
|---|---|---|
| `development-vessel-seed` fails 49/119 templates; `make up` exits 2 | **Complicated, not closed.** On this round's boots the unit reported `skipped`, and `make up` exited 2 for a *different* reason: no key supplied → silent fallback to `~/.metabob/config.json` → doctor `FAIL … 401 API key is invalid`. A second first-boot failure mode, distinct from the known one. | `bootstrap-seeder` was separately in a genuine restart loop, NRestarts 3→8→10→**25** over ~13 min, reporting `activating`, never `failed` — 3 shipped templates rejected 400 by the API that receives them. |
| Validation harness crashes, 118/125 scenarios | **Still open.** Not re-run. | — |
| `vessel-ctl install` of the surface does not survive a recreate | **Confirmed and documented.** | Unit + drop-in absent after recreate; host `/health = 000`. |
| `org_id` is not a join discriminator | **Still open; a re-report was refuted.** The collision could not be re-proved here, because a spoke with no identity-vessel necessarily resolves `whoami` on the hub, where identical values are *expected*. | `organizations:substrate` is a fixed literal, not a generated id like the adjacent `users:em1awtbb51ohzoavxw67` — so `FEDERATION.md:57`'s "generated per identity-vessel" is still doubtful. Settling it needs two independent identity-vessels. |
| `make up` injects the operator's key into a spoke | **Confirmed live, extended, partially fixed.** Both `ANTHROPIC_API_KEY` (len=108) and `GITHUB_TOKEN` (len=40) were in the spoke's PID 1 and in every vessel's environ, and the provider key was *persisted* to the volume. The `recreate` half is fixed; the `up` half still forwards by design. | Pass `ANTHROPIC_API_KEY=` explicitly for a genuinely keyless spoke; now documented. |

---

## 8. Refuted

Ten candidates did not survive verification. The load-bearing ones:

- **`.gitmodules` relative URLs break clones.** False. In a clone whose origin is
  the documented GitHub URL, git resolves the relative URL to the absolute HTTPS
  form before applying either documented `insteadOf` rewrite. The failure was
  entirely an artifact of cloning from a *local path*, which no doc prescribes.
- **A committed Anthropic key** (carried from round two): still false. The
  committed values are placeholders; the real exposure is the Makefile expansion,
  fixed in §4.
- **The hub's discovery erased itself from its own registry.** As framed it
  describes a mechanism that does not exist — there is no self-registration path
  in `discovery-vessel` to fail, so a missing row is the designed state.
- **Neither doc names the fleet inventory path.** False for `SUBSTRATE.md`, which
  has a whole section with all three paths. True only of `HUMAN_SURFACE.md`.
- **The keyless-spoke design is defeated by a manual `systemctl start
  llm-haiku`.** That is documented behaviour, quoted verbatim in the doc it was
  said to contradict.
- **Four positive confirmations reported as findings** — `DRY_RUN` touching
  nothing, the surface serving a real hashed bundle, arms rendered-but-disabled
  under `spoke`, secrets persisting across stop/start. These are the documented
  behaviour confirming itself. Listing them beside real defects inflates a report.

I also had to withdraw a claim of my own mid-round: I wrote into `HUMAN_SURFACE.md`
that `git submodule update --init` exits 0 when clones fail, then built a test to
confirm it and found the test invalid — it had no gitlink in the index, so it
measured "nothing to do" rather than a failed clone. The exit-code claim is
unsettled, so the doc now states only what is checkable: verify with
`git submodule status`, not with the exit code.

---

## 9. Unverifiable, and what would settle it

- Whether `apply` pulled `activity-api`/`surrealdb`/`concept-db`/`valkey` in as
  `Requires=` dependencies — they ended `active` with fresh MainPIDs while apply
  printed no `started` line for them. Output was ~12 lines, well under the old
  `head -40`, so truncation is not the explanation. Needs a role switch with a
  MainPID table and `systemctl list-dependencies --reverse`.
- Whether `status`'s roster is a function of past applies (43 lines at boot, 54
  after an apply, same container and image). Both units in question have
  `[Install]` sections, so the state filter does not explain it; the plausible
  mechanism is that `list-units --all` shows only *loaded* units and
  `apply-inventory`'s sweep loads them.
- Whether `bootstrap-seeder`'s three rejected templates are a seeder bug or an
  API contract change. The rejection text — "the composition declares a
  precondition it produces itself" — is specific enough to settle quickly with
  the template bodies in hand.

---

## 10. What this round earned

Round two's lesson was about *where* to test: exercise the branch where the guard
is set, not the default everything runs under. This round earned a sharper one,
and it cost the most time.

**Several findings were correct and their proposed fixes were wrong.** The
`bootstrap-seeder` guard would have permanently suppressed the hub seeding a
spoke is supposed to do. Deleting the `VC_ARGS` absorber leaves the built-in
`%: %.sh` rule to silently succeed anyway. `Dockerfile.substrate:443` turned out
to be a different build stage, so "the default topology runs the desktop" was
false for the image that actually ships. The `PORT_OFFSET=20000` doc already
contained the warning I was about to add — the defect was a self-contradiction,
not an omission. And `@`-prefixing the leaking recipes did nothing at all,
because `make -n` prints `@` lines: I applied that fix, re-ran the probe, and
found the leak still there.

Every one of those would have gone in green.

The rule: **verify the fix at the same rigour as the finding.** Before proposing
it, name what it breaks — run the branch it changes, check which build stage it
lands in, re-run the probe that found the defect and confirm it now comes back
clean. A confirmed defect earns nothing if the repair is confabulated at the last
step, and the confidence from having proved the defect is exactly what makes that
last step feel like it needs no proof.
