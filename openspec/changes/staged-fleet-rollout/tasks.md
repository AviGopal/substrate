## 1. Channel as an install input (deployment lane)

- [ ] 1.1 Add `SUBSTRATE_UPDATE_CHANNEL` (`canary` | `fleet` | `hold`, default `fleet`) to the manifest's install inputs, and carry it in the installer.
- [ ] 1.2 Make gen-env render it into `/etc/substrate/env` and refuse an unknown value, naming the three.
- [ ] 1.3 Add `channel`, `channel_head` and `behind` to `substrate-status --json` and its text output.
- [ ] 1.4 Add a README § Installation usage row: change a node's channel with one `.env` line plus the install command.

## 2. Mirror from the channel's ref (pull-sync; coordinator)

- [ ] 2.1 Make `pull-sync` keep push clones on `dev` (unchanged), and mirror `/vessels` from `origin/<channel ref>` instead of the clone's working tree.
- [ ] 2.2 Under `hold`, fetch, report `behind`, and mirror nothing.
- [ ] 2.3 Make the test gate run against the revision being mirrored, not the clone's HEAD.

## 3. Promotion activity (development-vessel; landing path)

- [ ] 3.1 Add a `fleet_promotion` activity: settle window → levels → cross-node known-answer goal → failure-class comparison.
- [ ] 3.2 On pass: fast-forward `fleet` in dependency order, then write a trace naming the revisions and the evidence.
- [ ] 3.3 On fail: file a gap naming the revision and the failing check, and leave `fleet` where it is.
- [ ] 3.4 Store the settle window and the failure-class tolerance as tuning parameters, not env.

## 4. One-time setup (needs the user's approval: outward git action)

- [ ] 4.1 Create a `fleet` branch at the current `dev` head in the super-repo and every vessel repository.
- [ ] 4.2 Choose the first canaries. Proposed: one spoke and node 1; the hub stays on `fleet`.

## 5. Verification

- [ ] 5.1 Positive control: a harmless landing on `dev` reaches the canaries, is promoted, and then reaches `fleet` nodes.
- [ ] 5.2 Negative control: a landing that fails a check (for example, one that breaks a status level on purpose, on a canary only) is refused, files a gap, and never reaches `fleet` nodes.
- [ ] 5.3 Run `hold` on the hub during a drain: the hub's running revision stays fixed and `behind` grows.
