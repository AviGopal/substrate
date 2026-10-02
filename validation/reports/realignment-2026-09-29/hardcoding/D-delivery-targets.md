# D — Delivery targets & retired-surface vocabulary (read-only census, 2026-10-01)

## Live facts
- obsidian-vessel: no systemd unit (it's an Obsidian plugin); obsidian-collaborate/intake/learn units inactive. discovery vesselCapability: obsidian:write_note = 0 producers, obsidian:note = 0, human_presentation = 0, goal_answer = 0.
- stateful-ui-vessel unit is ACTIVE (port 8270) and is the FIRST row discovery returns for uiPanel_write and uiQuestion.
- uiPanel_write rows (11): stateful-ui-vessel(:8270), development-vessel-local(host.containers.internal:18090), human-surface-vessel(:8310, absolute resolve_endpoint), development-vessel-compose2(:26090), and 7 federated rows all at http://127.0.0.1:8401 libp2p (/v2/impulses/resolve): human-surface@syzygy-local-inventory, @spoke-cfaaaa8d (+stateful-ui@spoke, dev-vessel-local@spoke), human-surface@syzygy-local-surface, human-surface@syzygy-hub, dev-vessel-local@syzygy-hub.
- Locality IS distinguishable: unsuffixed vesselId = this node; `@<node>` suffix + protocol libp2p = peer.
- registry_query MCP failed (localhost socket closed; cf. d67a7ed4 127.0.0.1 fix) — queried in-container instead.

## Inventory (repos/*/src, tests excluded)
### (i) delivery target chosen in code
goal-host-vessel:
- src/goal-note-title.ts:42 orderWriteSinks — appends 'obsidian:write_note' as unconditional tail sink.
- index.ts ~9618 isObsidianSurface = seed var obsidian_vessel_endpoint (only origin signal goal-host reads).
- index.ts ~11356 answerBody/goal_answer only `if (reached === true)`; ~11373 human_presentation in same reached branch.
- index.ts ~11419 bridgeNotes = isObsidianSurface || durableOutputRequested; shouldBridge requires reached===true.
- index.ts ~11502 concept-note bridge hardcodes obsidian:write_note.
- index.ts ~12736 fs-write terminal remapped to obsidian:write_note.
- index.ts ~15167 legacy shape list incl obsidian:write_note.
- index.ts ~16782 WHY note: every operator dispatch -> discovery obsidian:write_note vessels[0] -> Substrate/Dispatches/*.md. (also endpoint + asResolvePath() join — the 09-22 overshoot pattern; moot while 0 producers) [inference on URL validity]
- index.ts ~16899 operator_goal_unservable note -> obsidian:write_note.
- index.ts ~16939 authoring topology_hint prose prescribes obsidian:write_note/obsidian_verify_output for authored activities (keeps the vocabulary alive in new templates).
- goal-target-inference.ts WRITE_CLAUSE regexes include obsidian|vault nouns; :565 comment about LLM confabulating obsidian:write_note.
- in-walk endpointForShape (index.ts:7885): discovery order, target_vessel_id seed var overrides => stateful-ui first for uiPanel_write unless target_vessel_id given.
- 29 obsidian:write_note literal lines in index.ts, 4 in goal-note-title.ts, 1 in goal-target-inference.ts.
development-vessel writers of obsidian:write_note (7 files): author-producer, docs-decision-answer-scan, docs-decision-deliver, obsidian-deliver-assist, obsidian-reflect, obsidian-request-scan, project-plan. boredom-vessel/src/index.ts (2).
uiPanel_write writers: dev-vessel gap-to-feature.ts (escalations), ui-write-passthrough.ts; human-surface participation-journal.ts/store.ts.
activity-api routes/activities.ts:1240 /deliverable-shapes — learned vocabulary (keeps learned-composition-problem-detection-to-obsidian-write-note as a deliverable).
### (ii) legacy pins (:8270 / stateful-ui / react-renderer)
- :8270 literal in 10 dev-vessel files: config.ts, compute-state-signature, activity-create-variant, ui-write-passthrough (STATEFUL_UI_VESSEL_ENDPOINT default, now LAST fallback), author-composed-capability, docs-decision-deliver, docs-decision-answer-scan, solicitation-outcome-scan, seed/draft-gap-closing-activity, seed/draft-activity-from-pattern. (REALIGNMENT counted 9.)
- stateful-ui literals: dev-vessel 8 files (incl interactor-passthrough 5), goal-host goal-file-resolution.ts:125 (vessel list).
- stateful-ui-vessel + react-renderer repos still in tree; stateful-ui unit active; scripts/substrate/units/stateful-ui-vessel.service present. human-surface-stack acceptance #5 ("gone from tree, inventory, manifest, unit dir") unmet.
- workbench repo (repos/workbench, old React app) — a DIFFERENT thing from the "workbench" UI of human-surface; name collision.
### (iii) legitimate obsidian-vessel interop
- repos/obsidian-vessel/src (~30 files): the plugin's own resolvers; goal-dispatch-view.ts:762 sets ctx.obsidian_vessel_endpoint (origin/reply-to precedent).
- dev-vessel obsidian-* observation/learning resolvers (behavior-scan, learn-commands, execute-gated, command-gate, vessel-count, ui-screenshot, seeds observe-obsidian-events etc. ~15 files) — consumers of obsidian:* events; dormant while no vault connected.
- human-surface index.ts:238-242 serves obsidian:ui_view / obsidian:note compat aliases.

## Origin signals today
- human-surface UI TopBar.tsx:122 dispatches {goal, operator:"human-surface", tags:["surface:do-anything"]}; proxy.ts:654 forwards as goalDispatchAsync (may be federated to a peer goal-host). No reply-to / origin vessel id.
- goal-host DispatchRecord has operator, trigger, tags-derived fields; NOTHING in goal-host reads operator=="human-surface" or surface:* tags for delivery.
- Only origin channel honoured: seed var obsidian_vessel_endpoint (obsidian plugin). Existing generic seam: seed var target_vessel_id in endpointForShape.
- dev-vessel ui-write-passthrough (a7161d2f/65422a78, substrate-authored 09-29): ranks discovery rows, human-surface* first, pool record `humanAskRoute {prefer_vessel_ids}` overrides; :8270 last. Caveats: rank treats human-surface@peer equal to local; all federated rows share one URL (127.0.0.1:8401/...) so URL dedup collapses peers [inference: forward relies on body/route to pick peer]. humanAskRoute has no writer in src (pool record by hand).

## Prior attempts
- 1baab8f (07-07) bridge reached output -> obsidian+concept sinks; ANSWER-DELIVERY reach fix (07-07) gated on isObsidianSurface.
- 7721fe8 (07-28) Q/A goals to prose producer not obsidian:write_note — inference keeps re-inferring it via learned deliverable.
- 17efbee/1585215/c41f365 (08-06) orderWriteSinks: goal-own sink first, obsidian tail (route-around for dark vault; kept tail).
- 36f5390 (08-18) "the answer existed and the endpoint did not send it" — answerBody on goalWalkState.
- faa0afc (09-21) named-shape bind guard.
- dev-vessel a7161d2f/65422a78 (09-29) route uiPanel_write by shape + humanAskRoute; :8270 kept as fallback.
- openspec human-surface-stack: retire stateful-ui + react-renderer, not migrate (unmet); do-anything-surface (written for stateful-ui, superseded by human-surface); surface-render-contract (typed Answer/Content, fromAnswer adapter); surface-participation-loop (answers read by nothing; docs-decision answers read only from vault notes).
