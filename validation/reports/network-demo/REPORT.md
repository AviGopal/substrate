# Network demo: bring-up, join, add/remove vessels, cross-substrate resolution

**Goal** (operator, 2026-09-15): demonstrate bringing containers onto the network,
adding/removing vessels, and a seamless networking experience with little to no config.

**Setup:** self-contained network (hub + spoke) from the published image
`ghcr.io/avigopal/substrate:dev` (built 2026-09-16T00:46Z), docker bridge, no published
ports, no production container touched. Torn down (containers + volumes) after; the
three `substrate-demo-*` containers still on the host are 3-week-old artifacts of
earlier work, not this demo's, and were left alone. Raw transcripts: `step*.txt`.

## What was demonstrated working

1. **Hub bring-up: 2 env vars** (`ENABLED_ROLES=hub` + a placeholder LLM key) →
   healthy fleet, registry with 7 vessels / 91 shapes.
2. **Spoke join: 2 env vars** (`METABOB_API_KEY` + `DISCOVERY_ENDPOINT`) → healthy,
   role inferred, hub endpoints derived, transport auto-enabled, federation id minted.
3. **Hub→spoke resolution over libp2p, zero endpoint config** — the hub resolved
   `memoryNote` (served only by the spoke's development-vessel): *"proxied to the
   owning vessel on the peer substrate over libp2p"* through the relay circuit
   (`step4`). The spoke's 8 vessel rows were mirrored to the hub automatically at
   transport start.
4. **Spoke→hub data plane with real payloads** — the spoke ran a goal whose entire
   template catalogue lives on the hub: templates recommended and fetched from the
   hub store, a 2-step chain executed, reach honestly graded false on a task-level
   failure. Contrast with the earlier dead-leg experiment (`launch-contract-gaps-proof`
   Exp C: "no template id") — the networking leg is what made the difference.
5. **Runtime vessel add — the star leg.** `vessel-ctl install human-surface-vessel`
   on the spoke: unit active immediately, shapes (`surfaceIntent`, `human_input`, …)
   in the local registry, and **mirrored to the hub autonomously** — the hub resolved
   `surfaceIntent` → `human-surface-vessel@spoke-52da0d98` over the spoke's libp2p
   facade with no operator action (`step5`, confirmed hours later).
6. **Runtime vessel remove.** `vessel-ctl uninstall human-surface-vessel`: local
   deregistration immediate, hub mirror withdrawn; capability resolves return
   `found:false` on **both** registries.

Add/remove hit the ideal contract exactly: one verb, zero config, network-wide
propagation in both directions.

## Scorecard: config actually required vs. the ideal

Ideal: hub = 1 credential; spoke = 1 credential + 1 anchor; everything else derived.

| Step | Ideal | Actually required | Verdict |
|---|---|---|---|
| Hub boot | 1 key | `ENABLED_ROLES=hub` + 1 key | ✅ close (role must be named) |
| Join credential | hub issues a key | **broken**: `SUBSTRATE_ADMIN_KEY` empty on role=hub AND the auto-generated bootstrap key fails identity's `mb-` prefix rule — `substrate-key issue`/`list` unusable out of the box; fell back to sharing the hub's bootstrap key | ❌ gap |
| Spoke join | key + anchor | key + `DISCOVERY_ENDPOINT` (+ deliberate `ANTHROPIC_API_KEY=` for the proven harvest hazard on the make lane) | ✅ contract holds |
| Relay (the reachability anchor) | part of the hub | **role=hub does not include it** (manifest unit). Runtime `vessel-ctl install federation-relay` worked, but then: relay demands `PUBLIC_IP` (refuses to boot; trivially derivable on a bridge); its multiaddr had to be hand-copied into `RELAY_MULTIADDR` **and discovery restarted** because discovery reads it from env frozen at process start — a live law-1 violation (the bootstrap route derives it at read time; the env route doesn't) | ❌ 3 interventions |
| Hub-side transport | part of the hub | role=hub doesn't self-anchor; needed `HUB_DISCOVERY_URL=http://localhost:8100` injected + `vessel-ctl install federation-transport-vessel`. `deploy-hub.sh:170` hardcodes exactly this — the knowledge lives in a script, not in the role | ❌ 2 interventions |
| Spoke transport self-heal | automatic | transport was dead while no relay existed and **did not retry into health** once the relay appeared; manual restart required | ⚠ gap |
| Cross-resolution hub→spoke | derived | zero config once both transports anchored | ✅ |
| Cross-resolution spoke→hub | derived | data plane rides the **join-derived direct endpoints** (works); registry *fan-out* to the hub returns `found:false` because hub vessels register loopback endpoints that peers filter as undialable — by-design pinning covers the real traffic, but capability queries mislead | ⚠ honest quirk |
| Add vessel | 1 verb | `vessel-ctl install <v>` — zero config, auto-propagation to the hub | ✅ ideal |
| Remove vessel | 1 verb | `vessel-ctl uninstall <v>` — zero config, both registries withdraw | ✅ ideal |

**Non-networking artifacts observed** (all explainable, none blocking): hub went
Docker-unhealthy over 4 idle hours from the placeholder-LLM arm crash-looping,
`development-vessel-seed` classified down on a hub (the seed/compute role coupling
documented in the inventory), and PAT-less `substrate-pull-sync`; recurring
`Failed to resolve SHA … 401` in goal-host; hub catalogue 404s for some
recommended template ids.

## Conclusion

The two halves of the user's target contract split cleanly:

- **Vessel add/remove and steady-state networking are already at the ideal**: one
  verb per operation, derivation everywhere, autonomous propagation over the relay
  circuit, clean withdrawal.
- **The distance from "little config" is concentrated entirely in hub-side
  federation bring-up**: five manual interventions (relay install, `PUBLIC_IP`,
  `RELAY_MULTIADDR` + discovery restart, `HUB_DISCOVERY_URL`, transport install),
  every one of which is knowledge that already exists in `deploy-hub.sh` or is
  derivable at runtime — plus broken key issuance, which is the one step that
  gates handing a join command to another person.

Concretely: make role=`hub` mean *complete* hub (relay + self-anchored transport in
the role group), let the relay derive `PUBLIC_IP` on non-public interfaces, have
discovery read the relay anchor at use time (it already does on the `/bootstrap`
path — the env read is the residue), let the spoke transport retry into health, and
fix key issuance (`SUBSTRATE_ADMIN_KEY` generation + prefix mismatch). Those six
changes take the observed bring-up from "two commands plus five expert
interventions" to the two commands the contract promises.
