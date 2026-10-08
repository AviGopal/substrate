## 0. Resolve before building

- [ ] 0.1 Open question 1, P090 and P260 on a hub: measure whether any spoke reads them. Use the socket sample
      `hub-18080-sources.sh` uses, on 8090 and 8260. Fix the README table or the firewall, and file the
      discrepancy as a gap.
- [x] 0.2 Open question 2: ruled 2026-10-08, a fresh standalone defaults to `local`.

## 1. Exposure as one table

- [ ] 1.1 `scripts/substrate/exposure.json`: port, vessel, readers, profiles. A lint (glue test) fails when the
      README port table and this file disagree.
- [ ] 1.2 A pure function (`exposure-defaults.sh <profile>`) prints `<VESSEL>_PUBLISH_IP=127.0.0.1` for each
      `local` port. Its test covers every profile and pins the hub's local set (goal-host, stateful UI, human surface).

## 2. Defaults written at install

- [ ] 2.1 substrate-install.sh and deploy.sh write the derived defaults into a FRESH `.env` only. An
      operator-set variable always wins (test: set, unset, conflicting).
- [ ] 2.2 deploy.sh's `--accept-ports` preflight also names the profile default for any port that differs.

## 3. Hub source restriction as an install input

- [ ] 3.1 `HUB_SPOKE_SOURCES` (validated IPv4 list, the same validator as hub-firewall.sh). deploy.sh for a hub
      profile runs `hub-firewall.sh install-boot` with it; when it is unset, deploy.sh warns and installs nothing.
- [ ] 3.2 By effect on a throwaway hub (the network acceptance run): an unlisted source is refused on 18080
      while 18100 answers, and a listed source is admitted.

## 4. Detection without an operator

- [ ] 4.1 substrate-status reports `exposure_drift` (actual publish set vs exposure.json for the profile), and
      on a hub the firewall unit state and admitted-source count. Must-fail test: a 0.0.0.0 publish of a port
      that is `local` for the profile reads as drift.

## 5. Live hub (with the user, after review)

- [ ] 5.1 Once 0423842 is live on the hub and verified by effect (a POST carrying only X-Internal-Api-Key is
      refused), set `HUB_SPOKE_SOURCES` deliberately and redeploy the hub with `--accept-ports` to apply the
      `local` defaults. This is a quiet-gated recreate with the retention hold, so /etc runtime state is re-checked after it.
