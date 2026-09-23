# Prior setup audits — durability ledger

Authored by a read-only investigator on 2026-09-22 against HEAD `9f7ed3ec`, then
spot-checked by the change author. Rows marked **✓** were re-checked by hand; three rows
were corrected (see *Corrections*). Every source path is under `validation/`.

**Sources.** CSA `findings/config-surface-audit.md` (08-09→08-21) · BR3
`reports/BRINGUP_THREE_PATHS.md` (08-18) · SDD `reports/SUBSTRATE_DOC_DELTA.md` (08-19) ·
UXM/UXR `reports/SETUP_UX_MAP.md`/`SETUP_UX_REMAP.md`, SJD
`reports/SETUP_AND_JOIN_DOC_DELTA.md`, OSA `reports/ONE_SURFACE_AUDIT_DELTA.md` (08-20) ·
R3 `reports/ROUND3_INVENTORY_AND_JOIN_DELTA.md`, DLV
`reports/DOCUMENTED_LIFECYCLE_VERIFICATION.md` (08-21) · CB
`reports/coldboot-proof-2026-09-19/` · CLA `reports/container-lifecycle-audit-2026-09-21/` ·
CMP `reports/lifecycle-audit-fixes-2026-09-22/CAMPAIGN.md`, SYZ
`reports/syzygy-local-bringup-2026-09-22/REPORT.md`, SPB
`reports/setup-path-bifurcation-audit-2026-09-22/REPORT.md` · FILM
`demo2/bringup/review*/FILM_REVIEW.md`.

## How every prior audit was run

All of them ran on one host, under rootless Podman behind the docker CLI, with the image
already local, `~/.metabob/config.json` and `gh auth token` present, and — from September
— their own drivers (`auditlib.py`, hand-written compose files, hand-picked
`ENABLED_VESSELS`) rather than the documented commands. No audit ran on a second machine,
exercised `make up`'s build branch (the host has no `bun`), connected the MCP cockpit, or
reached a goal on a fresh volume (every terminal dispatch in CLA and its 26/26 rerun was
`reached:false`; CB's self-development clause failed both runs). Commit `37b18ec0`
("align setup/teardown instructions with audited behavior") then edited the docs to match
the harness. Detail: SPB §1.

## Headline

55 deduplicated defects: **22 hold, 14 partial, 17 never fixed, 2 regressed.** Latency
is bimodal — ~1 day from the audit that forced a fix, ~11 days from first detection,
17 rows still open (the oldest since 08-09). **No fix in the ledger was verified
off-host or on a pulled image.**

## Ledger

H holds · P partial · N never fixed · R regressed.

| # | Defect | Sources | HEAD evidence | St | Class |
|---|---|---|---|---|---|
|1|human-surface unit pins `HOST=127.0.0.1`; host 18310 dead on pull lanes ✓|BR3:900 R3:267 SYZ:85 SPB|`units/human-surface-vessel.service:10` (since 08-07); workarounds only in `ui-only-up.sh:352,532` and a Syzygy drop-in|N|fix-outside-artifact|
|2|surface unpublished / unbuilt (503 `ui_not_built`)|SDD:105 DLV:23 CLA:144|`Dockerfile.substrate:309`|H|readiness≠usability|
|3|every LLM arm shipped twice on one port|CSA:171 SJD:48|`entrypoint.sh:176`|H|name collision|
|4|crash-looping unit reads `activating`, never `failed`|CSA SJD DLV(939) R3 FILM|detector `substrate-ready.sh:76-107`, but run fail-open by `make up` (`Makefile:457 \|\| true`)|P|fail-open|
|5|keyless-arm guard passed on every host|CSA:208 UXR:14|`render-llm-arms.sh:86`|H|verified one layer up|
|6|rendered arms ignored role selection|CSA:187 OSA:35|inventory roles|H|name collision|
|7|entrypoint swallowed apply-inventory fatal|CSA:252 SJD:73|`entrypoint.sh:43-50`|H|fail-open|
|8|spoke derivation hardcoded ports, joined wrong fleet|CSA:102 SJD:88|gen-env; **still two implementations** (Makefile:197-233 + gen-env)|H|lane-drift|
|9|`HUB_DISCOVERY_URL` alone → half-spoke|CSA:342 OSA:101|role still inferred from `DISCOVERY_ENDPOINT` only|P|doc-code drift|
|10|spoke without hub key minted a random key, booted green|UXM:104|gen-env refusal|H|fail-open|
|11|LLM-key guard: gen-env demoted to warning (09-15) but make still refuses ✓|CSA:324 UXM|`Makefile:357,392,569,651` refuse; README:112-113 says gen-env refuses|P|lane-drift|
|12|compose `:?` made keyless spoke impossible|CSA:364|`docker-compose.yml:37`|H|lane-drift|
|13|compose healthcheck healthy-while-unusable ✓|CSA:154 SDD:84|discovery-only probe; SUBSTRATE.md:316 describes a different one|P|readiness≠usability|
|14|compose project-prefixed volumes started empty|SDD:29 CSA:760|named volumes fixed; SUBSTRATE.md:341 stale ✓|P|volume collision|
|15|CI published the obsidian stage|SDD:156|`build-substrate-image.yml:185`|H|provenance|
|16|docs said the image/vessels are private|SDD:197|SUBSTRATE.md:235 still "may be private"|P|doc-code drift|
|17|image revision unknowable ✓|CSA:288 CLA:15 SPB|no `LABEL`; workflow sets none|N|provenance|
|18|`make up` never pulls; build needs host bun ✓|BR3:985 SPB|`Makefile:441`|N|staleness|
|19|ambient credentials injected into every container ✓|OSA:135 R3:171|`Makefile:96-99,128`|P|ambient credential|
|20|make echoed live secrets|SJD:302 OSA:112|bare `-e`|H|ambient credential|
|21|README says make reads root `.env` ✓|SPB|README:505; no `include`|N|doc-code drift|
|22|`recreate` dropped launch identity|UXM:110 BR3|`RECREATE_CARRY`|H|silent discard|
|23|`PORT_OFFSET` missing from overrides|SDD:242|`Makefile:273`|H|silent discard|
|24|`make up` on a running container ignores new settings|CSA F21 BR3|`Makefile:443-444`|N|fail-open|
|25|`run-live-obsidian` ignores `PORT_OFFSET`|SDD:229|`Makefile:707-715`|N|lane-drift|
|26|published port lists disagree|SDD:120 SJD:143 CSA|deploy-remote 7, deploy-hub-pull 4|P|lane-drift|
|27|stop grace SIGKILLs a 240s drain ✓|DLV:64 SPB|make 300s; compose 30s|P|lane-drift|
|28|deleted make targets exited 0|OSA:21 R3:249|`.SUFFIXES:`|H|fail-open|
|29|vessel-ctl verbs faked success|OSA R3 BR3 CLA|fixed across 4 commits|H|fail-open|
|30|`metric-collector-vessel` absent from inventory|CSA:204 SJD CLA SYZ|0 hits in inventory|N|unit governance|
|31|relay `/bootstrap` 200-with-nothing; manifest greps a log nothing writes|SJD:109 R3 CLA|`vessels.manifest.json:53`|P|federation liveness|
|32|transport healthy with 0 reservations / `NO_RESERVATION`|BR3 CLA SYZ|gate never driven by a real join; recurred 09-22|P|federation liveness|
|33|hub advertises loopback|CSA:80 R3:20|advertise vars never emitted|P|federation liveness|
|34|baked peering drop-in hardcoded a dead IP|BR3|fixed|H|fix-outside-artifact|
|35|deploy-remote writes peering into a regenerated file, no 18101, one provider|CSA SPB|`deploy-remote.sh:71-87`|N|fix-outside-artifact|
|36|deploy-hub-pull hub has no goal-host ✓|CSA F42 BR3 SPB|live Syzygy hub goal-host `active` but `disabled`|N|lane-drift|
|37|`ENABLED_EXTRA_VESSELS` not persisted|CSA F43|gen-env:1017|H|silent discard|
|38|per-vessel keys only logged → cold-boot 401|BR3 CB|`seed-identity.ts:347`; ~70s window remains|H|boot ordering|
|39|rendered arms kept placeholder key|R3:241|`reseed-restart.sh:66`|H|boot ordering|
|40|dev-seed uploads race identity-seeder (401) ✓|OSA R3 SPB|fix **uncommitted** in working tree|N|boot ordering|
|41|trace writes 500 on a fresh datastore|CLA:149|migrations fixed; "~22 unparseable migrations skipped" open|H|fail-open|
|42|installed unit lost on recreate|OSA R3 DLV CLA|`entrypoint.sh:59-72`|H|silent discard|
|43|no cockpit path: configure-local hardcodes `:18080` + default name; no MCP install doc ✓|BR3 SPB|`configure-local.sh:16`, `Makefile:458`|N|warm-state masking|
|44|dead knobs (`FEDERATION_SIGNING_SECRET`, `SUBSTRATE_BIND_HOST`, `HUB_API_KEY`, `PEER_MULTIADDR`)|CSA BR3 SPB|no reader / no forwarder|N|doc-code drift|
|45|declared provider var reaches nothing|CSA F1 UXM|`VLLM_*` fixed; class recurred for `<VENDOR>_API_KEY` — fix is **another session's uncommitted working-tree gen-env**, not HEAD ✓|R|silent discard|
|46|`MITOSIS_DIRECT_PUSH` (default on) undocumented|UXM:96|compose:62; `.env.example:195`|H|doc-code drift|
|47|trace-retention literals discard operator value|UXM CSA|discard now logged|P|silent discard|
|48|heredoc backticks ran docker every boot|CSA R3|fixed|H|boot noise|
|49|`org_id` is not a join discriminator|OSA R3 CLA|FEDERATION.md:73 unchanged|N|doc-code drift|
|50|`SURREALDB_URL` defaults to loopback on a spoke|BR3|gen-env:816|N|lane-drift|
|51|~200 junk files tracked at repo root ✓|SPB|182 top-level entries|N|hygiene|
|52|8 lanes, ≥8 "canonical" claims, 20 contradictions ✓|SPB|`SUBSTRATE.md:208`|N|lane-drift|
|53|hot-patched units revert; `/etc` shadows `/usr/lib`|DLV:108 SJD:266|documented only|P|fix-outside-artifact|
|54|make readiness gate is fail-open ✓|SPB|`Makefile:457`|N|fail-open|
|55|`37b18ec0` added a false README claim ✓|—|README:181-186 "serves out-of-box" (contradicts row 1)|R|doc-code drift|

## Corrections applied by the author

- **Row 55.** The investigator said `37b18ec0` wrote *two* false claims. `git blame`
  shows README:112-113 ("gen-env refuses to boot") dates from `a600a8b9` (08-22), when it
  was true; it went stale when `61655ab1` (09-15) demoted the gate. `37b18ec0` (09-22)
  wrote one false claim ("serves out-of-box").
- **Row 45.** The recurrence fix exists only in an uncommitted working-tree change by
  another session; HEAD still has the defect.
- **Row 36.** Upgraded from code-read to measured: the live Syzygy hub
  (`ENABLED_ROLES=hub`, no extras) runs goal-host `active` but `disabled` — started by
  hand, lost on reboot.

## Class summary

| Class | Rows | H/P/N/R |
|---|---|---|
| lane-drift | 9 | 2/3/4/0 |
| fail-open / silent success | 8 | 5/1/2/0 |
| silent discard | 7 | 5/1/0/1 |
| doc-code drift | 7 | 1/2/3/1 |
| fix-outside-artifact | 4 | 1/1/2/0 |
| federation liveness | 3 | 0/3/0/0 |
| boot ordering | 3 | 2/0/1/0 |
| provenance / staleness | 3 | 1/0/2/0 |
| name / volume collision | 3 | 2/1/0/0 |
| readiness ≠ usability | 2 | 1/1/0/0 |
| ambient credential | 2 | 1/1/0/0 |
| other | 4 | 1/0/3/0 |

Warm-state masking is the secondary class on rows 18, 19, 40, 43 and on every audit's
green verdict.

**Recurred ≥3 audits:** invisible crash loop (5 audits, up to 1,404 restarts with zero
gaps filed); "healthy while joined to nothing" (6 audits, each fix gating a different
signal); human-surface unreachable (7 audits — packaging fixed, the loopback pin never);
port/knob lists re-declared per lane (5); declared knob reaches nothing (5, recurring);
durable membership across recreate (4, 33 days); dev-seed 401 race (4); ambient
credentials (3); image provenance (3); `metric-collector` outside inventory (3).

## Structural causes of the top five classes

1. **Lane-drift** — eight launchers each re-declare ports, knobs, healthcheck and stop
   grace, so every fix lands in one lane.
2. **Fail-open** — checks default to pass when they cannot run (`|| true`, early
   `exit 0`, clean `ExecCondition` skips, restart loops reported as `activating`).
3. **Fix-outside-artifact** — repairs live where they were verified (drop-ins, hot
   patches, overlays, uncommitted units), not in the image a newcomer pulls.
4. **Warm-state masking** — persisted secrets, `~/.metabob`, a local tag and warm volumes
   hide the failures a fresh host hits first.
5. **Doc-code drift** — docs are aligned to what a harness observed, so they inherit the
   harness's overlays rather than the shipped artifact's behavior.
