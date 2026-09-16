# Validation run (post-fix), 2026-09-16 ~05:30-05:40Z — containers val-hub/val-spoke, image ghcr digest 23bbfa0a1b29 + worktree fixes copied in

hub launch env: ANTHROPIC_API_KEY=<placeholder>, ENABLED_ROLES=hub  (2 vars)
spoke launch env: METABOB_API_KEY=<hub mb- key>, DISCOVERY_ENDPOINT=http://172.17.0.9:8100, ANTHROPIC_API_KEY=  (2+1 vars)

== fix chain observed with ZERO interventions:
05:31:52 seeder minted mb- keys + SUBSTRATE_ADMIN_KEY; substrate-key list works (fixes 5/6: existing machinery verified)
05:32:15 hub transport starts DIRECT-ONLY (self-anchored via derived HUB_DISCOVERY_URL — fix 1)
05:33:03 relay derives PUBLIC_IP=172.17.0.9 from interface (fix 2), persists RELAY_MULTIADDR to /etc/substrate/env (fix 3a)
05:37:49 hub transport pollForAnchor ADOPTS the circuit, no restart (fix 4 verified)
~05:37   /bootstrap advertises the relay via registered-circuit fallback, discovery never restarted
05:38:50 spoke transport gets relay from /bootstrap first try, register 201, mirrors 8 rows
05:39    hub resolves memoryNote from spoke: 'proxied to the owning vessel on the peer substrate over libp2p'

Remaining known race: discovery process-env RELAY_MULTIADDR frozen at start (fix 3b) — self-heals via circuits in ~5min; permanent fix dispatched to the substrate (feature_compose on repos/discovery-vessel/src/index.ts, dispatch 6b9d3f46 after 6dea0523 was rejected on an llm-lane 400).
