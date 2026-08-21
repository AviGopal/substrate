# The one-surface audit: what following the docs found

Twelve agents audited the vessel inventories and the setup surface, then followed
the setup, join and vessel-management journeys in a clean clone from origin,
reading only the documentation. The vessel-management surface had never been
audited before this run.

**This supersedes the UX assessment in `SETUP_UX_MAP.md`, `SETUP_UX_REMAP.md` and
`SETUP_AND_JOIN_DOC_DELTA.md`, all of which describe a two-surface world that no
longer exists.** Their journey findings still stand; their conclusions about
*where* an operator does things do not.

The result is uncomfortable and worth stating plainly: **the largest defects were
in work committed hours earlier in the same session**, and none of them would have
been found by reading. Every one required running the thing.

---

## The two that mattered most

### Deleting 63 Makefile targets left them silently succeeding

The targets were removed but their names stayed in `.PHONY`. A `.PHONY` name with
no recipe does not error — make prints `Nothing to be done` and **exits 0**.

So `make doctor`, `make ready`, `make health`, `make restart-<vessel>`,
`make install-vessel` all reported success while doing nothing. An operator
running `make doctor` against a broken fleet would see exit 0 and read it as a
pass.

That is strictly worse than the failure the deletion was meant to produce. A
command that is gone should say so. `.PHONY` now lists exactly the 19 real
targets; deleted names fail with `No rule to make target`.

### A SIGPIPE bug disabled every LLM arm under any explicit role selection

`apply-llm-arms` piped `apply-inventory` into `grep -q`. `grep -q` exits on its
first match, closing the pipe; the still-writing producer takes SIGPIPE; under
`set -o pipefail` the pipeline reports **failure even though the match
succeeded**. The `if !` branch therefore fired on success.

Measured with `ENABLED_ROLES=full` — a selection that *contains* `models` — all
three arms reported *"NOT enabled — role 'models' is not in this selection"*. A
hub would have run zero arms and every goal would have failed for want of a model.

It hid because the guard above that block skips it entirely when `ENABLED_ROLES`
is empty — and empty is the default topology everything gets tested on, including
the verification run that shipped it.

---

## The vessel surface had five blockers

It was new, and it went in unaudited. All five were mine.

| Defect | What actually happened |
|---|---|
| `apply` never converged the running state | It rewrote enable/mask symlinks, which on a live fleet changes nothing: a masked unit keeps running, an enabled one stays down until reboot. The verb whose whole purpose is closing that gap was doing half its job and reporting success. |
| `drift` was not read-only | `apply-inventory`'s unmask branch ignored `DRY_RUN`, so the command that exists to *report* the gap mutated the fleet on every run — and skipped `daemon-reload`, leaving `status` stale. |
| No `stop` / `start` verbs | After `apply` masked a running vessel, the surface could neither stop it nor recover it: masked units refuse `restart`. |
| `restart` faked success on a masked unit | A masked unit stays `active` — the old process is still there — so grading on `is-active` alone called a no-op a success. |
| `uninstall <typo>` faked success | `ok:true`, `action:"uninstalled"`, exit 0, for a vessel that exists nowhere. |

Plus `sync` refusing every baked vessel with *"not in manifest"* while the
section above it promised "any unit, baked or manifest".

All fixed and verified on a live fleet: masked units stopped and enabled ones
started on a switch to `spoke` with `RestartCount` still 0; mask count identical
before and after `drift`; typos refused by name; `restart` now compares MainPID
before and after, because an unchanged PID means the restart did not happen
however healthy the state string reads.

---

## Documentation defects

The command-existence audit did the inverted job — extract every command the docs
tell a reader to run, then check each against the layer that would run it. That
found twelve live references to dead targets, including:

- `substrate-key`'s own **on-error usage text** — what a reader sees at the moment
  they are already lost — advertising five make wrappers that no longer exist.
- The federation-id pin command, dead twice over: a make target that no-ops,
  passing a verb `vessel-ctl` does not have.
- `substrate-key list-keys` / `revoke-key` / `issue-jwt` in two docs, when the
  verbs are `list` / `revoke` / `jwt`.
- A recovery step pointing at `/scripts/substrate/gen-env.sh`, a path that does
  not exist inside a container.

Two warnings had become **the inverse of the truth** since the volumes were named:
`.env.example` and `docs/SUBSTRATE.md` both told readers compose would create
empty project-prefixed volumes and strand an existing fleet. Warning about the
opposite of what happens is worse than silence.

And the dangerous half of that same change: `.env.example`'s second-substrate
section listed a container name and nine ports but **not the volume names** — so a
second compose fleet mounted the *first* fleet's learning state.

### One I introduced and had to reverse

The README join recipe told readers **not** to set `DISCOVERY_ENDPOINT`. That
variable *is* the point-and-go trigger: `gen-env` infers `ENABLED_ROLES=spoke`
from it, derives the hub/store/identity endpoints, then rewrites it to the spoke's
own local registry. Measured — with `HUB_DISCOVERY_URL` alone, no role is inferred
and activity-api resolves to localhost: a standalone wearing hub-shaped variables.
The advice would have turned every compose-lane spoke into an isolated node.

---

## Refuted

One auditor reported a real Anthropic key committed in `.env.devbob.k8s.example`.
**False positive.** Both values are placeholders — the key is 26 characters where a
real one is ~108, and the token reads `ghp_you…`. What the agent actually saw was
the *Makefile expanding* the operator's real key from `~/.metabob/config.json`
into `make -n` output. That exposure path is real and shares a class with the
`GITHUB_TOKEN` the Makefile prints on every `make up`; the committed file is clean.

Recording this because the difference matters: one finding means rotate a
credential and scrub history, the other means stop echoing secrets in recipes.

---

## Still open

- **`development-vessel-seed` fails 49 of 119 templates**, making `make up` exit 2
  on a first boot. Distinct from the known `bootstrap-seeder` rejection, and not
  investigated here.
- **The documented validation harness crashes immediately** — 118 of 125 shipped
  scenarios lack a field the harness dereferences.
- **`vessel-ctl install` of the human surface does not survive a container
  recreate**, and the docs prescribe recreate without warning.
- **`org_id` is not a join discriminator** — two independently-seeded instances get
  the same one, so a documented join check false-positives on an isolated spoke.
- **`make up` injects the operator host's provider key into a spoke** the docs say
  needs none, making the keyless-spoke promise unexercisable on that lane.

---

## The lesson this round earned

Every headline defect was in code committed hours earlier, verified at the time,
and wrong anyway — because the verification ran the default path.

`ENABLED_ROLES` empty skips the arm check entirely. A fleet with nothing masked
never exercises `drift`'s unmask branch. A vessel that exists never exercises the
typo path. **The defaults are exactly the conditions under which the bugs are
invisible**, which is why a passing verification and a working system are
different claims.

The rule that generalises: when a guard is conditional, test the branch where the
condition is *set*, not the one everything happens to run under.
