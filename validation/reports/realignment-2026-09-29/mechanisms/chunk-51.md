# Mechanisms chunk 51 — area: conversation-vessel (Apr/May UI/product layer)

Input: `classes/_mech_chunks/51.json` — one item, source `raw/git-super-1.md` (lines 47, 59-60, 514).
Verified 2026-09-29 against the super-repo, the on-disk working trees, and substrate-live.

## Dedupe

The single item is really six repositories that were dropped together in one commit. They are
one mechanism class, "the pre-substrate product/UI layer", so they get one verdict each on a shared row:

| repo | last commit (on-disk tree) | remote | state |
|---|---|---|---|
| conversation-vessel | b250011 2026-05-22 | MetabobProject/conversation-vessel | clean, pushed |
| workbench | e045a2d 2026-05-24 | MetabobProject/workbench | clean, pushed |
| react-renderer | 8ccf842 2026-04-30 | MetabobProject/react-renderer | clean, pushed |
| terminal | b777ee1 2026-04-30 | MetabobProject/terminal | clean, pushed |
| metabob-cloud-dashboard | 3f5e35e 2026-08-17 (one commit after the drop) | MetabobProject/metabob-cloud-dashboard | clean, pushed |
| user-vessel | 4f71df7 2026-05-28 | MetabobProject/user-vessel | clean, pushed |

`minibob` and `deployment` went out in the same commit but belong to other chunks. Minibob carried the ReAct-parity measurement (git-super-1 line 512).

## Drop event

`b49942df` (2026-06-26), "chore(repo): drop 8 non-substrate submodules": gitlinks and `.gitmodules`
entries were removed, the paths were gitignored, and the working trees were kept on disk under `repos/`.
Submodules went from 26 to 18. The live `/workspace/git/vessels/` in substrate-live has the 19
container vessels. It has none of these six. No systemd unit in substrate-live matches
conversation|workbench|dashboard|user-vessel|renderer|terminal.

## Verdicts

| name | verdict | used_now | evidence | availability / archive |
|---|---|---|---|---|
| conversation-vessel | fossil | no | No live clone, no unit, no import in `/workspace/git/vessels/*/src`. Its conversation surface was superseded by the metabob-mcp cockpit (agent) and the Obsidian/human-surface vessels (human). | Archived as its GitHub remote (clean, pushed) plus the gitignored tree at `repos/conversation-vessel`. |
| workbench (trajectory editor) | fossil | no | Nothing references it live. Its last work (e045a2d) moved hooks onto the `thompson_posterior` impulse path, which is now served by activity-api. | GitHub remote `MetabobProject/workbench`. |
| react-renderer | fossil | no | No live reference. Rendering moved to stateful-ui-vessel and the human surface. | GitHub remote. |
| terminal | fossil | no | No live reference. Its CLI role is covered by metabob-mcp and `substrate-connect`. | GitHub remote. |
| metabob-cloud-dashboard | keep-specific (outside the substrate) | unknown | It got a commit after the drop (3f5e35e 2026-08-17, "a 5s poll on an O(table) query saturated the production database"), so a production deployment outside this container was still being maintained. The substrate does not use it. | Not a substrate mechanism. It lives in its own remote. Do not re-add it as a submodule (law 11: it belongs where the product's data lives). |
| user-vessel | **broken dependency (fossil still called)** | yes, and it fails | The user-vessel client in live identity-vessel is still enabled by default: `identity-vessel/src/services/config.ts:124-126` has `USER_VESSEL_ENABLED` defaulting to true and the endpoint defaulting to `http://user-vessel.activity-system.svc.cluster.local:8080`, a Kubernetes DNS name. `resolvers/auth.ts` calls `enrichWithAccountId` on auth resolve. The journal shows **378 `[UserVesselClient] user-vessel unreachable` warnings in the last 24h** (latest Sep 29 05:21). Each miss costs up to 1s (`USER_VESSEL_TIMEOUT_MS` 1000). A 5-minute per-user TTL caches the hits, and it degrades gracefully to deriving from `org_id`. `activity-api/src/cli/migrate-org-to-account.ts:54` pins the same dead URL. | The repo is a fossil (GitHub remote). The live call site is the finding. Either gate the enrichment on discovery resolving a `userContext`-shaped producer (route by shape, not a pinned k8s host), or default it off in the substrate profiles. This is the same class as the "writer that PINS a peer cannot learn the peer was replaced" memory finding (:8270 escalations, 2026-09-22). File it as a gap against `repos/identity-vessel/src/services/config.ts`. |

## Class note

Five of the six are true fossils. The drop was clean: everything is pushed, the trees are preserved, and there are no live readers. Nothing
here needs reviving. The recurring failure is not the UI layer. It is a **pinned peer address outliving
the peer**. The drop commit removed the repo but not its callers, and nothing detected the orphaned
caller for three months, even though it logs a warning every few minutes. A dropped-submodule check should grep
the live clones for the dropped name and its default endpoint, and it should be an activity (law 6). A detector
for log warnings that recur at a steady rate, and that turns them into gap demand, would have caught it without an operator.
