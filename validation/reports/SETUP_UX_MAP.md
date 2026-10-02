# The setup surface: a map, and where it fails an operator

Mapping the configuration UX of the substrate container — what an operator can
set, what the system actually reads, and the gap between them. Four agents
surveyed the surface against the running system; every finding below carries the
file:line or command that produced it. **48 findings: 21 cause silently-wrong
behaviour, 8 block a newcomer.**

This is a proposal. Nothing here is applied.

---

## The one-sentence problem

The substrate has five configuration layers and no operator-visible model of
which one wins, so the dominant failure is not "misconfigured" but
**"configured correctly, silently discarded, no error."**

---

## 1. The map

```
  [A] Operator input        docker -e  /  compose environment:  /  make VAR=…
          │
          ▼
  [B] gen-env resolution    scripts/substrate/gen-env.sh
          │   per var:  operator input → persisted secret → generated → hardcoded
          │   writes /etc/substrate/env            ← the runtime authority
          │   writes /workspace/.substrate-secrets ← the survival store (20 keys)
          ▼
  [C] Inventory selection   apply-inventory.sh + vessels.inventory.json
          │   PROFILE > ENABLED_VESSELS > ENABLED_ROLES > DISABLED_VESSELS
          │   decides which units exist at all
          ▼
  [D] Unit env              53 units × EnvironmentFile=/etc/substrate/env
          ▼
  [E] Process               the vessel reads process.env
```

### The four mechanics that explain nearly every defect

**(i) There are two consumption planes, and only one sees container env.**
Pre-systemd (`entrypoint.sh` and what it invokes) reads container env directly —
this is why `LLM_ARMS` works without gen-env. Every *vessel* is on the systemd
plane: 53 units carry `EnvironmentFile=/etc/substrate/env` and **zero** carry
`PassEnvironment`, so they inherit nothing from the container.

> **The rule:** a variable that reaches the container but is not emitted by
> gen-env does not exist for any vessel.

**(ii) Persistence beats intent, silently.** `${VAR:-persisted}` treats an empty
string as unset, so a value already in `.substrate-secrets` cannot be cleared
through any supported input.

**(iii) The volume survives; the container config does not.** Secrets and
provider keys round-trip through the volume. Port mappings, `-e` topology
pointers, and role selection live in container config and are lost on recreate.

**(iv) The obvious diagnostic is structurally useless.** Comparing
`/proc/1/environ` against `/etc/substrate/env` cannot detect a lost value,
because the entrypoint sources the generated file into its own environment —
`/proc/1/environ` reports gen-env's *output* back as if it were the operator's
*input*.

---

## 2. Tiers — what an operator should actually see

`.env.example` currently mixes all four tiers in one flat list.

**TIER 1 — cannot start without deciding it. One variable.**
`ANTHROPIC_API_KEY` (or `OPENAI_API_KEY` + `OPENAI_BASE_URL` + `LLM_DEFAULT_MODEL`).
This is literally the only hard gate compose enforces.

**TIER 2 — required for a specific topology.** Grouped by topology, not alphabetised:
- *Spoke:* `ENABLED_ROLES=spoke`, `HUB_DISCOVERY_URL`, `DISCOVERY_ENDPOINT`, `METABOB_API_KEY`, `FED_SUBSTRATE_ID`
- *Second instance:* `PORT_OFFSET` + the nine host ports — including **`HUMAN_SURFACE_PORT`, which compose consumes and no example file lists**
- *Extra providers:* `OPENROUTER_API_KEY`, `CHUTES_API_KEY`, `GOOGLE_API_KEY`, `GROQ_API_KEY`, `MISTRAL_API_KEY`, `LLM_ARMS`
- *Public hub:* `PUBLIC_IP` **first** — the other five `*_PUBLIC_*` vars are inert without it
- *Vessel selection:* `PROFILE`, `ENABLED_VESSELS`, `DISABLED_VESSELS`, `ENABLED_EXTRA_VESSELS`, `DRY_RUN`
- *Safety switches, own block:* `MITOSIS_DIRECT_PUSH`, `ROUTE_EDIT_INTENT_TO_COMPOSE`

**TIER 3 — tuning most operators never touch.** Retention caps, embedding priors,
rate-limit allowlists, per-arm model overrides.

**TIER 0 — should not be operator-facing at all.** Generated internals
(`SURREAL_PASS`, `JWT_SECRET`, derived endpoints); `SUBSTRATE_BIND_HOST`, which
is **dead** — three write sites, zero readers; and `VLLM_*` *as currently wired*
(see A2).

---

## 3. The findings that matter most

### The safety switch nobody can see
`MITOSIS_DIRECT_PUSH=${MITOSIS_DIRECT_PUSH:-1}` (`gen-env.sh:367`) — the
substrate commits, **pushes to `origin/dev`**, and mirrors into the live runtime.
It is **on by default** and appears in no doc, no README, no compose file, no
`.env.example`, no Makefile. *(Verified: grep returns 0 in all five; positive
control `ANTHROPIC_API_KEY` returns 12/2/1/4/2.)* The one knob governing
autonomous code landing is invisible.

### A spoke that joins nothing, and reports success
Omit the hub-issued `METABOB_API_KEY` on a spoke join and `gen-env.sh:161-162`
falls through to `openssl rand`. The spoke boots **green** with a key the hub
never issued and fails hub auth later, with nothing at setup time saying so.
`.env.example` calls this var "REQUIRED… THIS is what joins the group."

### `make recreate` destroys topology
`Makefile:182` declares `LAUNCH_OVERRIDES` with **15** names; the read-back at
`:398-412` restores **three**. Recreating a spoke keeps `ENABLED_ROLES=spoke`
(masking surrealdb and activity-api) while resetting `DISCOVERY_ENDPOINT` to
loopback: **no local trace store and no hub.**

### Documented, declared, discarded
`docker-compose.yml:53-60` declares four `VLLM_*` variables under a six-line
explanatory comment. `grep -n VLLM gen-env.sh` → nothing. The consumer reads
`process.env`, and systemd units inherit no container env. Configure a vLLM arm
the documented way and you get no arm and no error.

Same shape: `docs/SUBSTRATE.md:695-702` publishes a trace-retention table with a
Default column, stating the values are "bootstrap-read from the environment
because it bounds a destructive operation." `gen-env.sh:473,478,479` writes all
three as **unconditional literals with different values**. Both halves false —
the operator's value is discarded *and* the documented defaults are unreachable.

### The spoke/LLM question you raised
The doc says a spoke "inherits the hub's LLM arms, so its launch command needs no
local provider key" (`docs/SUBSTRATE.md:314`). True of the *launch command*. But
`roles.spoke` includes `compute`, and all four llm-resolver units **are** role
`compute` — so a spoke does enable the arms. They skip via `ExecCondition` only
when no key is in `/etc/substrate/env`. On both UI spokes here a key *is* present
(persisted from an earlier boot), so three arms run per spoke.

**The structural finding:** `compute` bundles the LLM arms with goal-host,
development-vessel, ribosome, local-tools and analysis. A spoke genuinely needs
those, so you cannot drop `compute` without gutting it. **There is no role that
separates "runs work" from "serves models."** That is the gap — not a
misconfiguration on either container.

---

## 4. Ranked fixes

### Band A — silently wrong behaviour
| # | Fix | Kind |
|---|---|---|
| A1 | Derive `recreate`'s read-back *from* `LAUNCH_OVERRIDES` so they cannot drift; restore the port offset from `.HostConfig.PortBindings` | code |
| A2 | Emit `VLLM_*` from gen-env — or delete the compose block. Not both ways | code |
| A3 | Presence-detect credentials (`${VAR+x}`) so a value can be revoked; log every field resolved from the store | code |
| A6 | Convert the retention literals to `${VAR:-…}` and correct the doc's Default column | code + doc |
| A7 | Stop `.substrate-secrets` being an `EnvironmentFile` for the 4 units where it wins over `/etc/substrate/env` | code |
| A8 | Forward `PUBLIC_IP` in compose; document that the `*_PUBLIC_*` overrides are inert without it | code + doc |

### Band B — blocks a newcomer
| # | Fix | Kind |
|---|---|---|
| B2 | **Move the LLM-key guard below the persisted-key fallback** (`gen-env.sh:41-44` runs 164 lines before `:205`). One-line move; kills a whole "it worked yesterday" class | code |
| B1 | Make `ANTHROPIC_API_KEY` non-fatal in compose so the spoke journey can start — **sequence after B2** | code |
| B3 | Kill the private-image claim in `README.md` (7 spots) and `.env.example`. **Already settled empirically:** anonymous pull works | doc |
| B4 | Validate config before `make up` builds | code |
| — | Document `PROFILE` (highest-precedence selection var, fatal on typo) and forward the selection family in compose | doc + code |

### The spoke/LLM decision — needs your call
Three options, none obviously right:
1. **Split the role.** Add `models` as a role, move the four llm-resolver units
   into it, make `full` include it and `spoke` not. Cleanest; touches every
   deployment's inventory.
2. **Per-container mask.** `DISABLED_VESSELS=llm-opus.service,…` on the two UI
   spokes. Targeted and reversible; does not fix the class.
3. **Document the current behaviour** and leave it — the arms are cheap
   (~450 MB, 3-12% CPU per spoke) and give the spoke a local fallback when the
   relay flaps, which it does hourly.

---

## 5. The one thing

**Ship `make show-config`, backed by an `/etc/substrate/env.provenance` file.**

For every variable: name, resolved value (secrets masked), and **which tier
supplied it** — `env` / `persisted` / `generated` / `derived` / `hardcoded`.

The criterion is class coverage, not the severity of any one bug. `recreate` is
the worst single defect, but it is one defect. Roughly eight findings share the
shape *"the operator's value was silently lost and nothing said so"* — `VLLM_*`
discarded, `TRACE_STORE_*` overwritten, `PUBLIC_IP` unforwardable, a revoked PAT
still live, the hub pointer dropped on recreate. Every one is invisible **by
construction**, because the only diagnostic an operator would reach for reports
gen-env's output back as their input.

It is also the cheapest structural fix available: gen-env **already tracks
provenance for one field** (`SURREAL_PASS_SOURCE`, `gen-env.sh:95-101`). The work
is generalising an existing pattern, not inventing a mechanism.

`grep -n "show-config\|print-env" Makefile` → nothing; positive control lists 60+
targets. Nothing in the system can answer *"did my value win, and if not, who
beat it?"* Answer that once and the surface starts auditing itself.
