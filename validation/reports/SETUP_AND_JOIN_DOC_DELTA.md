# Setup and join: what the docs promised, and what a clean environment did

Two journeys were executed against the published `:dev` image on a host that had
never run them — stand up a standalone substrate, and join it as a spoke — with
the documentation followed as written. Twelve agents audited the vessel
inventories and the setup surface in parallel.

**Coverage, stated exactly:** the audit reported **23** blocker/major findings;
**8** of them went through the adversarial verify pass, because the harness capped
that stage at eight. The remaining 15 are reported here as *unverified*, and
anything acted on below was additionally re-derived by hand against a running
fleet. Of the 8 verified, **none were refuted** — 1 confirmed outright and 7
returned "partial", meaning true but stated too broadly. That ratio is the reason
the unverified 15 are not simply assumed good: the failure mode in this batch was
overstatement, not fabrication, and overstatement survives a casual read.

The headline is not a doc defect. It is that **the documented clean-room command
failed on its first attempt, and following it end-to-end surfaced four live
defects that no amount of reading would have found** — including two that had been
"fixed" in a previous round and were still broken, and two more introduced by
those same fixes.

---

## What was verified working

These are promises the docs make that a clean environment actually honoured:

| Promise | Result |
|---|---|
| `make up LIVE_NAME=… PORT_OFFSET=…` stands up an isolated fleet | **PASS** — own volumes, own ports, `substrate-live` untouched |
| `up` refuses a stopped container when launch settings would be ignored | **PASS** — errors with the `recreate` instruction |
| `make show-key LIVE_NAME=…` returns the operator key | **PASS** |
| Point-and-go join: `DISCOVERY_ENDPOINT` alone infers the spoke role | **PASS** — `ENABLED_ROLES=spoke` derived with no explicit setting |
| A spoke authenticates to the hub with a hub-issued key | **PASS** — HTTP 200 |
| Doctor detects an LLM arm that is up but cannot complete | **PASS** — and said so precisely: *"credit/quota or key problem, not a code problem; /health cannot see it"* |
| Identity seeding on a fresh fleet | **PASS** — which settles a standing question, see below |

The last row matters beyond this run. `substrate-live` fails three doctor checks
from an unrecoverable identity keyspace, and it was an open question whether that
was a code/doc defect or corrupted state. A fresh fleet from the same image seeds
identity cleanly and authenticates. **It is that one volume, not the product.**

---

## The four defects the journeys found

### 1. Every LLM arm shipped twice, on the same port, and half crash-looped invisibly

The rendered-arm migration shipped **both** unit sets and called it a parallel
run. They are not parallel — they are duplicates on identical ports:
`llm-resolver-{opus,haiku,google}` (8221/8223/8225) against rendered
`llm-{opus,haiku,google}` (the same three). Exactly one of each pair wins the
bind; the loser dies `EADDRINUSE` and `Restart=on-failure` retries forever.

Measured on a fresh clean-room fleet: **`NRestarts=95` within 40 minutes**, two of
three arms looping, and *which* unit won differed per arm — a boot race, not a
fixed winner.

It stayed invisible because a unit in a restart loop reports `activating`, never
`failed`. `systemctl list-units --state=failed` is therefore empty and the
doctor's "no failed units" check **passes** while the fleet burns a process every
~25 seconds. That is the same signature as the one-shot-install crash-loop already
on record — the class recurred somewhere new, which is law 7's durability measure
failing rather than a fresh surprise.

Fixed: the entrypoint retires the static unit each rendered arm supersedes, matched
by id so `llm-resolver-vessel` (8220, the shared base resolver, not an arm) is left
alone. After the fix, `llm-opus` and `llm-haiku` are **both** active for the first
time, `NRestarts=0`, and readiness went from a permanent `NOT ready: 3 unit(s)
down` to `fleet ready`.

### 2. A typo'd vessel selection booted the FULL fleet instead of failing

`apply-inventory` exits 1 on an unrecognised `PROFILE`/`ENABLED_ROLES` token — a
guard added in the previous round precisely so a typo could not silently change
the fleet. `entrypoint.sh` then swallowed that exit into *"keeping all units"*.

`ENABLED_ROLES=spok` did not yield a spoke minus a typo. It yielded a full node
running the LLM arms, the autonomy timers, and the trace store the operator had
deliberately excluded — **the exact outcome the guard exists to prevent, defeated
one layer above the guard.**

Fixed: fail-open is now reserved for the case where nothing was asked for (a bare
`docker run`, where "run everything" *is* the intent). If any selection knob is
set and applying it fails, the boot aborts and prints the offending values.

### 3. A spoke silently joined the WRONG substrate

The join derivation kept only the *host* from `DISCOVERY_ENDPOINT` and hardcoded
`:18100`/`:18080`/`:18101`, discarding the port. Measured:
`DISCOVERY_ENDPOINT=http://172.17.0.1:23100` produced
`HUB_DISCOVERY_URL=http://172.17.0.1:18100` — **a different substrate on the same
host.** All three endpoints pointed at the wrong fleet, with a key that fleet had
never issued, which would surface later as an inexplicable 401.

This also falsifies the doc's explicit claim that the endpoint and the key are
"the only required inputs" and everything else is derived.

The fix had to land in **two** layers. The first attempt patched `gen-env.sh` and
changed nothing on the documented path, because the Makefile pre-derives these and
bakes them into `docker run -e` while blanking `DISCOVERY_ENDPOINT` — so gen-env's
derivation never executes for `make up`. Both now recover the offset from the
discovery port (`offset = port - 18100`, applied to the siblings), with ports below
the block (a proxy on 443, a tunnel on 8443) treated as *not* offset arithmetic.

Verified across five endpoint shapes at the layer that emits the `docker run`.

### 4. `/bootstrap` answers 200 when there is nothing to join

`federation-transport-vessel` self-derives its relay from
`${HUB_DISCOVERY_URL}/bootstrap`. A **standalone** substrate answers that route
with `HTTP 200` and an empty body:

```json
{"relay_multiaddrs":[],"identity_endpoint":"http://127.0.0.1:8101","discovery_endpoint":""}
```

So "the hub is reachable" and "the hub can be joined" are indistinguishable from
the outside — both `200`. The spoke instead crash-loops (17 restarts, reported
`activating`, invisible to the failed-unit check) with
`set RELAY_MULTIADDR or point BOOTSTRAP_URL/HUB_DISCOVERY_URL at a discovery
serving /bootstrap` — **naming variables the operator has already set correctly.**
Note the loopback `identity_endpoint`: a remote spoke following it resolves itself.

Not fixed — standing up a real relay is a hub deployment, not a doc change.
Documented instead, with the pre-flight check that distinguishes the two cases
(`curl -s <hub>/bootstrap | jq '.relay_multiaddrs | length'`).

---

## Documentation delta applied

| File | Change |
|---|---|
| `docs/SUBSTRATE.md` | Role enumeration corrected — was missing `models`, `registry`, `desktop`; `hub`/`spoke` group lines were missing `registry` and `models` |
| `docs/SUBSTRATE.md` | Why `models` is separate from `compute`, and why `desktop` is in no group (build-stage gated, not role gated) |
| `docs/SUBSTRATE.md` | Warning: neither `hub` nor `spoke` includes `autonomy`, so a federated pair runs **zero** self-development |
| `docs/SUBSTRATE.md` | `PORT_OFFSET` example changed `20000` → `5000`, with the ephemeral-range hazard explained |
| `docs/SUBSTRATE.md` | `LAUNCH_OVERRIDES` table — what is *actually* guarded vs silently dropped |
| `docs/SUBSTRATE.md` | Join section: port-preserving derivation, and the `/bootstrap` pre-flight check |
| `README.md` | The image is **public**, not private — three unnecessary `docker login` steps removed |
| `README.md` | Raw `docker run` publishes nine ports, not eight (`18310`, the human surface, was missing) |
| `Dockerfile.substrate` | `substrate-config` now ships in the image |
| `gen-env.sh` / `substrate-config.sh` | Provenance corrected (below) |

### `PORT_OFFSET=20000` is a booby trap

The doc's own example lands all nine ports inside the Linux ephemeral range
(`/proc/sys/net/ipv4/ip_local_port_range` = `32768 60999`). The kernel hands those
out to ordinary outbound connections, so a clean-room boot fails at random with
`bind: address already in use` **on a port nothing is listening on** — a transient
outbound socket held it for the moment Docker tried to bind.

This is not theoretical. It is what happened on the first attempt to follow the
documented command, and by the time the port was inspected the "conflicting"
process no longer existed.

---

## Two defects in the previous round's own instrumentation

Both were found by agents auditing work this author had done, and both are the
same mistake as the defects above.

**`substrate-config` was documented as `docker exec <container> substrate-config`
while living only in the host checkout.** It was never `COPY`ed into the image, so
every copy of that instruction was unrunnable. It had been reported as "working"
because it was run from the host repo — authored at the host layer, documented as
a container command.

**It also reported the opposite of the truth about every generated secret.**
`gen-env` attributed only two names, and `substrate-config` read an absent entry as
proof of a hardcoded literal. So on a brand-new fleet, `JWT_SECRET`,
`API_KEY_SECRET` and `METABOB_API_KEY` all reported **`hardcoded`** — alarming
exactly where calm was warranted, on the one question the tool exists to answer.

Two fleets running the *same image ID* were compared to settle it: `JWT_SECRET`,
`API_KEY_SECRET`, `SURREAL_PASS` and `FED_SUBSTRATE_ID` all differ, and a differing
value cannot have come from a shared image, so they are genuinely generated. That
is **four of five**, not five — `METABOB_API_KEY` *is* byte-identical across the
two, because it is the hub-issued join credential handed to the spoke with `-e`,
which the spoke's own provenance correctly records as `env`. The shared value is
by design; stating it as five would have been the same overclaim in the opposite
direction.

`gen-env` now records each mint, absence is reported as `unrecorded` rather than
answered, and the "a 'hardcoded' source means…" footer prints **only when a
hardcoded row is actually on screen** — unconditionally it re-created the very
alarm the fix removed. Both branches verified in-container: with no hardcoded row
the footer is absent; under `ALLOW_INSECURE_API_KEY_SECRET=1` on an existing
datastore, `API_KEY_SECRET` correctly renders `hardcoded  dev-se…` *with* the
warning — the one case where it is the literal truth and the operator most needs
to see it.

---

## The vessel inventories: what the audit found

The inventory exists in **three** places, and the runtime-authoritative one is the
volume: repo → image (`/usr/local/share/substrate/`) → volume
(`/workspace/substrate/fleet/`). `entrypoint.sh` seeds the volume copy from the
image *only if it is absent*, so a fleet booted before an inventory change keeps
its old copy.

**The premise that nothing reconciles it was refuted.** `substrate-pull-sync`
converges the fleet files from git, and it demonstrably works: both UI spokes'
volume copies are *newer* than their images and already carry the `models` role
split. The real gap is one step later — **nothing re-runs `apply-inventory` after
convergence**, and it only executes pre-systemd at boot. So an inventory fix
propagates and then sits inert until the container restarts. That is precisely why
the two UI spokes still run keyless arms today.

Coverage, measured against the shipped unit set:

- **`metric-collector-vessel.service` is the one shipped unit absent from the
  inventory entirely** — and it is defined *twice*, as a static unit and as a
  manifest vessel. Nothing selects or masks it by role.
- **`federation-relay.service` names a file that does not exist**, correctly: it
  is `manifest: true` and rendered on demand by `vessel-ctl`. Not a dead entry, but
  it means `hub` including role `transport` does **not** give you a relay.
- **Rendered units are structurally invisible to the inventory.** `llm-opus`,
  `llm-haiku`, `llm-google` are created after `apply-inventory` runs, under names
  the inventory never contains. They are governed only by the entrypoint's own
  gate — which is why defect 1 above went unnoticed for so long.
- **Role `desktop` in no group is correct**, not an omission. My first
  explanation of *why* was wrong, and refuted: I claimed the units exist only in
  the `substrate-obsidian` stage, having grepped `/etc/systemd/system`. Static
  units live in **`/lib/systemd/system`**, where all three are present in the base
  image. What the obsidian stage adds is the payload and the `systemctl enable`.
  Wrong directory, right conclusion — the eighth instance of the layer mistake
  below, committed while checking the others. Because they *are* inventory-named,
  any `ENABLED_ROLES` value masks them, and the Makefile sets
  `ENABLED_ROLES=spoke` automatically whenever `DISCOVERY_ENDPOINT` is passed, so
  a federated obsidian fleet loses its desktop silently.
- **Neither `hub` nor `spoke` includes `autonomy`** — all 26 units, confirmed
  against the live spoke's masks. `deploy-hub.sh` compensates with an explicit
  `ENABLED_EXTRA_VESSELS` list, but per its own comment that list is a snapshot of
  what one hub happened to be running, recovered from units unmasked *by hand
  inside the container*. It restores six compute services and zero autonomy timers.
  **But "no self-development at all" was too strong and was refuted.**
  `boredom-vessel` carries role `compute`, so it runs on a spoke — and it did:
  `raw_gaps=4 admitted=4`, then a reserved and dispatched gap-drain goal, no
  operator involved. A federated pair loses the *scheduled* autonomy surface, not
  condition-driven work generation. The verifier rested that refutation on
  execution evidence from `journalctl`, explicitly declining to count a timer in
  `active (waiting)` as proof anything ran — scheduled is not executed.

Two observability gaps make all of the above hard to see from the outside:

- **A drifted or frozen fleet definition is invisible to every operator command.**
  The doctor reads the inventory but never compares it against git. `substrate-live`'s
  `vessels.manifest.json` is frozen against the repo by a *whitespace-only*
  reformat, and the log line reports that as a deliberate local customisation.
- **The ungoverned-units detector never runs on the topology that has ungoverned
  units.** It is skipped on default (no-selection) boots — the exact case where
  everything is enabled — and false-positives on manifest vessels by construction.

None of these were changed in this round. Reclassifying roles on the strength of an
audit is how a wrong mint happens; `desktop` looked like an omission and was not.
They are recorded here so the next round starts from evidence rather than from the
same three re-derivations.

---

## A caveat on where these fixes are, versus where they run

Verification surfaced a distinction worth stating plainly, because it is the same
propagation trap this repo keeps paying for. **Every fix here is committed and
pushed, and CI has since rebuilt and published `:dev` from a commit after them.**
But at the moment the two test fleets were graded, neither was *executing* the
fixed `gen-env`: the clean room's good provenance file came from a one-shot manual
run that the in-container mirror later overwrote with the image's older copy. The
`provtest` container that validated the provenance fix across a first and second
boot was a separate throwaway carrying the patched script deliberately.

So the correct claim is: **fixed at source, verified by executing the fixed code in
a container, and now published** — not "observed working on a long-running fleet."
Those are different sentences and only the first two were earned at grading time.
Any fleet still running an older image continues to exhibit the old behaviour until
it is recreated; `substrate-live` still shows the duplicate `SURREAL_PASS` line,
including the bogus `provided` token no reader parses.

---

## Not fixed, and why

- **The identity keyspace in the `substrate-surreal` volume** remains
  unrecoverable through supported paths. This run *narrows* it: a fresh fleet from
  the same image seeds and authenticates cleanly, so it is corrupted state in that
  one volume, not a defect in the product or the docs. It still needs an operator
  decision — recover the keyspace, or accept a fresh identity namespace against the
  existing traces. The datastore holds ~17 GB of learning state and hand-editing
  the database is forbidden, so it is flagged rather than worked around.
- **The two live UI spokes still run three keyless LLM arms each.** The fix is
  landed and has even propagated into their volume inventories, but
  `apply-inventory` and the `ExecCondition` only take effect at boot, and those
  containers have been up since Aug 10 and Aug 14. The fix is present and inert;
  applying it requires a restart, which is an operator call.
- **`federation-relay`** is a manifest vessel and never baked-enabled, so no
  standalone fleet can be joined. Documented, not changed.
- **The Makefile prints a live `GITHUB_TOKEN` in plaintext** on every `make up`
  (it echoes the full `docker run`). That token should be rotated, and the echo
  should be masked. Flagged, not fixed — rotation is the operator's.

---

## The standing lesson, restated because it recurred four more times

Every defect in this round — and every defect in the previous one — came from
**verifying one parsing layer above where the artifact is consumed.**

- A regex checked in bash, read by systemd.
- A grep on stdout, where the source writes stderr.
- A role applied to unit names a later render step replaces.
- A guard that exits 1, called by a line that swallows it.
- A port derivation fixed in `gen-env`, on a path the Makefile bypasses.
- A `case` statement inside `$(shell …)`, silently truncated by Make's own
  paren parsing before the shell ever saw it.
- A free-port probe on `127.0.0.1`, for a bind Docker performs on `0.0.0.0`.
- A unit-file search in `/etc/systemd/system` for units that ship in
  `/lib/systemd/system` — committed *while writing this list*, and caught only
  because the doc edit it produced was sent for adversarial verification.

The last four were caught *during this session*, by testing rather than reading —
each had already been written, and three had already been believed correct.

The verification pass on these very doc edits returned **zero** verdicts of
"correct as written": one refuted claim, one refuted sub-claim, and the rest
downgraded to "true but stated more strongly than the evidence supports." Among
them, an asserted hazard that does not exist — the loopback `identity_endpoint` in
`/bootstrap`, which I described as something a remote spoke would follow to itself.
No spoke code reads it. Writing a plausible mechanism is not observing one.

A passing check one layer up is not weak evidence. **It is evidence about a
different system.**
