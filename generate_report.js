#!/usr/bin/env bun
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const projectsDir = 'Substrate/Projects';
const reportFile = path_1.default.join(projectsDir, 'projectThreadScanReport.json');
const files = await new Promise((resolve, reject) => {
    Bun.$. / packages / evidence - aliasing - check / README.md
        . / packages / design - tokens / README.md
        . / packages / interaction - conformance / README.md
        . / packages / shape - dispatch - check / README.md
        . / packages / vessel - discovery - client / CHANGELOG.md
        . / packages / vessel - discovery - client / README.md
        . / packages / vessel - discovery - client / QUICK_START.md
        . / packages / vessel - discovery - client / IMPLEMENTATION_SUMMARY.md
        . / test_project_thread.md
        . / openspec / changes / 2026 - 6 - 16 - substrate - self - persistence - and - direct - push / proposal.md
        . / openspec / changes / 2026 - 6 - 16 - substrate - self - persistence - and - direct - push / tasks.md
        . / openspec / changes / 2026 - 7 - 18 - s2 - stability - ladder / proposal.md
        . / openspec / changes / 2026 - 6 - 14 - non - obsidian - trace - pattern - feeder / proposal.md
        . / openspec / changes / 2026 - 8 - 29 - cross - vessel - wiring - repair / proposal.md
        . / openspec / changes / 2026 - 5 - 30 - info - gain - bonus - on - success / proposal.md
        . / openspec / changes / 2026 - 6 - 14 - gap - scenario - class {
    } - dedup / proposal.md
        . / openspec / changes / archive / 2026 - 5 - 17 - stratified - goal - generator - harness / proposal.md
        . / openspec / changes / archive / 2026 - 5 - 17 - stratified - goal - generator - harness / specs / stratified - goal - generator / spec.md
        . / openspec / changes / archive / 2026 - 5 - 17 - stratified - goal - generator - harness / specs / multi - witness - verification / spec.md
        . / openspec / changes / archive / 2026 - 5 - 17 - stratified - goal - generator - harness / tasks.md
        . / openspec / changes / archive / 2026 - 5 - 17 - stratified - goal - generator - harness / design.md
        . / openspec / changes / archive / 2026 - 5 - 30 - autonomous - palette - write - resolvers / proposal.md
        . / openspec / changes / archive / 2026 - 5 - 30 - autonomous - palette - write - resolvers / tasks.md
        . / openspec / changes / archive / 2026 - 5 - 30 - substrate - gap - drafter - wiring / proposal.md
        . / openspec / changes / archive / 2026 - 5 - 30 - substrate - gap - drafter - wiring / tasks.md
        . / openspec / changes / 2026 - 7 - 19 - llm - arms - data - driven / proposal.md
        . / openspec / changes / 2026 - 6 - 4 - learning - rate - 4 - tier - restricted - bandit / proposal.md
        . / openspec / changes / 2026 - 6 - 4 - learning - rate - 4 - tier - restricted - bandit / tasks.md
        . / openspec / changes / 2026 - 6 - 24 - author - producer - validate - mint - parity / proposal.md
        . / openspec / changes / 2026 - 7 - 29 - thompson - posterior - time - decay / proposal.md
        . / openspec / changes / 2026 - 7 - 29 - thompson - posterior - time - decay / tasks.md
        . / openspec / changes / 2026 - 6 - 4 - learning - rate - 3 - background - trace - replay / proposal.md
        . / openspec / changes / 2026 - 6 - 4 - learning - rate - 3 - background - trace - replay / tasks.md
        . / openspec / changes / 2026 - 7 - 5 - code - locality - resolver / proposal.md
        . / openspec / changes / 2026 - 7 - 5 - code - locality - resolver / tasks.md
        . / openspec / changes / 2026 - 7 - 5 - code - locality - resolver / agent - prompt.md
        . / openspec / changes / 2026 - 7 - 5 - code - locality - resolver / design.md
        . / openspec / changes / human - surface - stack / VALIDATION - 3.;
    md
        . / openspec / changes / human - surface - stack / proposal.md
        . / openspec / changes / human - surface - stack / render - learning.md
        . / openspec / changes / human - surface - stack / BUILD - REPORT.md
        . / openspec / changes / human - surface - stack / federation.md
        . / openspec / changes / human - surface - stack / drafts / README.md
        . / openspec / changes / human - surface - stack / design.md
        . / openspec / changes / human - surface - stack / VALIDATION - 2.;
    md
        . / openspec / changes / 2026 - 5 - 31 - display - failure - mode - extensions / proposal.md
        . / openspec / changes / 2026 - 5 - 31 - display - failure - mode - extensions / tasks.md
        . / openspec / changes / 2026 - 5 - 22 - failure - mode - autonomous - loop / proposal.md
        . / openspec / changes / 2026 - 5 - 22 - failure - mode - autonomous - loop / specs / draft - gap - closing - activity / spec.md
        . / openspec / changes / 2026 - 5 - 22 - failure - mode - autonomous - loop / tasks.md
        . / openspec / changes / 2026 - 5 - 22 - failure - mode - autonomous - loop / design.md
        . / openspec / changes / 2026 - 5 - 30 - vessel - resolve - contract - conformance / proposal.md
        . / openspec / changes / 2026 - 5 - 23 - substrate - explicit - vessels / proposal.md
        . / openspec / changes / 2026 - 5 - 23 - substrate - explicit - vessels / specs / vessel - daemon - toolkit / spec.md
        . / openspec / changes / 2026 - 5 - 23 - substrate - explicit - vessels / specs / substrate - explicit - vessels / spec.md
        . / openspec / changes / 2026 - 5 - 23 - substrate - explicit - vessels / tasks.md
        . / openspec / changes / 2026 - 5 - 23 - substrate - explicit - vessels / findings / validation.md
        . / openspec / changes / 2026 - 5 - 23 - substrate - explicit - vessels / findings / audit.md
        . / openspec / changes / 2026 - 5 - 23 - substrate - explicit - vessels / design.md
        . / openspec / changes / 2026 - 6 - 1 - closed - loop - learning - and - verification / proposal.md
        . / openspec / changes / 2026 - 6 - 1 - closed - loop - learning - and - verification / specs / closed - loop - learning / spec.md
        . / openspec / changes / 2026 - 6 - 1 - closed - loop - learning - and - verification / tasks.md
        . / openspec / changes / 2026 - 5 - 23 - vessel - federation / proposal.md
        . / openspec / changes / 2026 - 5 - 23 - vessel - federation / specs / vessel - federation / spec.md
        . / openspec / changes / 2026 - 5 - 23 - vessel - federation / tasks.md
        . / openspec / changes / 2026 - 5 - 23 - vessel - federation / design.md
        . / openspec / changes / 2026 - 6 - 25 - semantic - cutover - verification - gate / proposal.md
        . / openspec / changes / 2026 - 5 - 21 - development - vessel / proposal.md
        . / openspec / changes / 2026 - 5 - 21 - development - vessel / specs / development - vessel / spec.md
        . / openspec / changes / 2026 - 5 - 21 - development - vessel / tasks.md
        . / openspec / changes / 2026 - 5 - 21 - development - vessel / design.md
        . / openspec / changes / 2026 - 8 - 26 - consequence - verdict - into - credit / proposal.md
        . / openspec / changes / 2026 - 6 - 25 - substrate - root - rename - and - repo - hygiene / proposal.md
        . / openspec / changes / 2026 - 6 - 25 - substrate - root - rename - and - repo - hygiene / tasks.md
        . / openspec / changes / 2026 - 6 - 14 - learning - rate - acceleration - and - detector - recursion / proposal.md
        . / openspec / changes / 2026 - 6 - 14 - learning - rate - acceleration - and - detector - recursion / specs / value - of - information - selection / spec.md
        . / openspec / changes / 2026 - 6 - 14 - learning - rate - acceleration - and - detector - recursion / specs / stability - ;
    while (-growing / spec.md
        . / openspec / changes / 2026 - 6 - 14 - learning - rate - acceleration - and - detector - recursion / specs / autonomous - detector - authoring / spec.md
        . / openspec / changes / 2026 - 6 - 14 - learning - rate - acceleration - and - detector - recursion / tasks.md
        . / openspec / changes / 2026 - 6 - 14 - learning - rate - acceleration - and - detector - recursion / design.md
        . / openspec / changes / 2026 - 7 - 5 - distributed - spoke - development / proposal.md
        . / openspec / changes / 2026 - 7 - 5 - distributed - spoke - development / tasks.md
        . / openspec / changes / 2026 - 7 - 5 - distributed - spoke - development / design.md
        . / openspec / changes / 2026 - 6 - 1 - concept - db - supersession - and - chunker - hygiene / proposal.md
        . / openspec / changes / 2026 - 6 - 1 - concept - db - supersession - and - chunker - hygiene / tasks.md
        . / openspec / changes / 2026 - 4 - 29 - surrealdb - rl - layer / proposal.md
        . / openspec / changes / 2026 - 4 - 29 - surrealdb - rl - layer / specs / surrealdb - rl - layer / spec.md
        . / openspec / changes / 2026 - 4 - 29 - surrealdb - rl - layer / tasks.md
        . / openspec / changes / 2026 - 4 - 29 - surrealdb - rl - layer / design.md
        . / openspec / changes / 2026 - 6 - 14 - system - authored - activity - promotion - loop / proposal.md
        . / openspec / changes / 2026 - 5 - 23 - substrate - self - replacement - pipeline / proposal.md
        . / openspec / changes / 2026 - 5 - 23 - substrate - self - replacement - pipeline / specs / substrate - self - replacement - pipeline / spec.md
        . / openspec / changes / 2026 - 5 - 23 - substrate - self - replacement - pipeline / tasks.md
        . / openspec / changes / 2026 - 5 - 23 - substrate - self - replacement - pipeline / design.md
        . / openspec / changes / 2026 - 5 - 17 - state - space - signature - thompson - keying / proposal.md
        . / openspec / changes / 2026 - 5 - 17 - state - space - signature - thompson - keying / specs / state - space - signature / spec.md
        . / openspec / changes / 2026 - 5 - 17 - state - space - signature - thompson - keying / tasks.md
        . / openspec / changes / 2026 - 5 - 17 - state - space - signature - thompson - keying / design.md
        . / openspec / changes / 2026 - 7 - 8 - substrate - self - managed - db - reconciliation / proposal.md
        . / openspec / changes / 2026 - 7 - 8 - substrate - self - managed - db - reconciliation / tasks.md
        . / openspec / changes / 2026 - 7 - 8 - substrate - self - managed - db - reconciliation / VERIFY.md
        . / openspec / changes / 2026 - 7 - 8 - substrate - self - managed - db - reconciliation / design.md
        . / openspec / changes / 2026 - 5 - 23 - cost - weighted - posteriors / proposal.md
        . / openspec / changes / 2026 - 5 - 23 - cost - weighted - posteriors / specs / cost - weighted - posteriors / spec.md
        . / openspec / changes / 2026 - 5 - 23 - cost - weighted - posteriors / tasks.md
        . / openspec / changes / 2026 - 7 - 19 - vessel - duplicate - genres / proposal.md
        . / openspec / changes / 2026 - 7 - 19 - vessel - duplicate - genres / tasks.md
        . / openspec / changes / 2026 - 7 - 19 - vessel - duplicate - genres / design.md
        . / openspec / changes / 2026 - 6 - 25 - cross - signature - reputation - penalty / proposal.md
        . / openspec / changes / 2026 - 5 - 31 - list - endpoint - task - count - from - content / proposal.md
        . / openspec / changes / obsidian - legibility - surface / proposal.md
        . / openspec / changes / 2026 - 7 - 4 - single - transport - story / proposal.md
        . / openspec / changes / 2026 - 5 - 30 - obsidian - vessel - concept - db - frontend / proposal.md
        . / openspec / changes / 2026 - 5 - 30 - obsidian - vessel - concept - db - frontend / tasks.md
        . / openspec / changes / 2026 - 5 - 23 - topology - discovery - loop / proposal.md
        . / openspec / changes / 2026 - 5 - 23 - topology - discovery - loop / specs / topology - discovery / spec.md
        . / openspec / changes / 2026 - 5 - 23 - topology - discovery - loop / tasks.md
        . / openspec / changes / 2026 - 5 - 23 - topology - discovery - loop / findings / dev.md
        . / openspec / changes / 2026 - 5 - 23 - topology - discovery - loop / design.md
        . / openspec / changes / 2026 - 5 - 23 - intervention - tracking / proposal.md
        . / openspec / changes / 2026 - 5 - 23 - intervention - tracking / specs / intervention - tracking / spec.md
        . / openspec / changes / 2026 - 5 - 23 - intervention - tracking / tasks.md
        . / openspec / changes / 2026 - 5 - 23 - intervention - tracking / design.md
        . / openspec / changes / 2026 - 4 - 26 - impulse - activity - loop / blocker - analysis - 2026 - 4 - 28.)
        md
            . / openspec / changes / 2026 - 4 - 26 - impulse - activity - loop / proposal.md
            . / openspec / changes / 2026 - 4 - 26 - impulse - activity - loop / specs / composition - chain - credit - propagation / spec.md
            . / openspec / changes / 2026 - 4 - 26 - impulse - activity - loop / specs / activity - api - connection - pooling / spec.md
            . / openspec / changes / 2026 - 4 - 26 - impulse - activity - loop / specs / failure - mode - stratified - updates / spec.md
            . / openspec / changes / 2026 - 4 - 26 - impulse - activity - loop / specs / activity - reuse - validation - harness / spec.md
            . / openspec / changes / 2026 - 4 - 26 - impulse - activity - loop / specs / tags - fts - index / spec.md
            . / openspec / changes / 2026 - 4 - 26 - impulse - activity - loop / specs / federation - security - hardening / spec.md
            . / openspec / changes / 2026 - 4 - 26 - impulse - activity - loop / tasks.md
            . / openspec / changes / 2026 - 4 - 26 - impulse - activity - loop / findings / dev.md
            . / openspec / changes / 2026 - 4 - 26 - impulse - activity - loop / findings / validation - 2026 - 5 - 24.;
    md
        . / openspec / changes / 2026 - 4 - 26 - impulse - activity - loop / findings / validation - 2026 - 5 - 25.;
    md
        . / openspec / changes / 2026 - 4 - 26 - impulse - activity - loop / design.md
        . / openspec / changes / 2026 - 6 - 14 - merge - gate - computes - convergent - validity / proposal.md
        . / openspec / changes / 2026 - 5 - 27 - neutral - emitter - lifecycle - bus / proposal.md
        . / openspec / changes / 2026 - 5 - 27 - neutral - emitter - lifecycle - bus / specs / vessel - registration - events / spec.md
        . / openspec / changes / 2026 - 5 - 27 - neutral - emitter - lifecycle - bus / specs / proxy - resolver - reactive - registration / spec.md
        . / openspec / changes / 2026 - 5 - 27 - neutral - emitter - lifecycle - bus / specs / lifecycle - events - bridge / spec.md
        . / openspec / changes / 2026 - 5 - 27 - neutral - emitter - lifecycle - bus / tasks.md
        . / openspec / changes / 2026 - 5 - 27 - neutral - emitter - lifecycle - bus / design.md
        . / openspec / changes / 2026 - 8 - 26 - large - file - edit - capability / proposal.md
        . / openspec / changes / 2026 - 6 - 25 - goal - target - shape - inference / proposal.md
        . / openspec / changes / 2026 - 9 - 12 - host - independent - federation - join / proposal.md
        . / openspec / changes / 2026 - 6 - 4 - drop - drafter - source - type - filter / proposal.md
        . / openspec / changes / 2026 - 6 - 4 - drop - drafter - source - type - filter / tasks.md
        . / openspec / changes / 2026 - 5 - 30 - doc - ingestion - and - concept - management / proposal.md
        . / openspec / changes / 2026 - 5 - 30 - doc - ingestion - and - concept - management / tasks.md
        . / openspec / changes / 2026 - 5 - 23 - substrate - identity - resolution / proposal.md
        . / openspec / changes / 2026 - 5 - 23 - substrate - identity - resolution / specs / substrate - identity - resolution / spec.md
        . / openspec / changes / 2026 - 5 - 23 - substrate - identity - resolution / tasks.md
        . / openspec / changes / 2026 - 5 - 23 - substrate - identity - resolution / design.md
        . / openspec / changes / 2026 - 6 - 4 - learning - rate - 8 - hierarchical - signature - clustering / proposal.md
        . / openspec / changes / 2026 - 6 - 4 - learning - rate - 8 - hierarchical - signature - clustering / tasks.md
        . / openspec / changes / 2026 - 8 - 27 - live - recipe - rescues - failed - partner / proposal.md
        . / openspec / changes / 2026 - 5 - 18 - forge - goal - completion - test / proposal.md
        . / openspec / changes / 2026 - 5 - 18 - forge - goal - completion - test / specs / forge - goal - completion - test / spec.md
        . / openspec / changes / 2026 - 5 - 18 - forge - goal - completion - test / tasks.md
        . / openspec / changes / 2026 - 5 - 18 - forge - goal - completion - test / design.md
        . / openspec / changes / 2026 - 8 - 14 - sound - close - oracle - reland / proposal.md
        . / openspec / changes / 2026 - 7 - 19 - relay - findability - replication / proposal.md
        . / openspec / changes / 2026 - 6 - 1 - substrate - as - git - author / proposal.md
        . / openspec / changes / 2026 - 6 - 1 - substrate - as - git - author / specs / substrate - git - author / spec.md
        . / openspec / changes / 2026 - 6 - 1 - substrate - as - git - author / tasks.md
        . / openspec / changes / 2026 - 6 - 1 - substrate - as - git - author / findings / 2026 - 6 - 1 - noncanonical - paths - clarification.md
        . / openspec / changes / 2026 - 5 - 30 - draft - spec - from - gap - template / proposal.md
        . / openspec / changes / 2026 - 5 - 30 - draft - spec - from - gap - template / tasks.md
        . / openspec / changes / 2026 - 6 - 4 - learning - rate - 7 - successor - features / proposal.md
        . / openspec / changes / 2026 - 6 - 4 - learning - rate - 7 - successor - features / tasks.md
        . / openspec / changes / ;
    do
        -anything - surface / proposal.md
            . / openspec / changes / ;
    while ();
    do
        -anything - surface / design.md
            . / openspec / changes / 2026 - 5 - 28 - concept - bridge - observer / proposal.md
            . / openspec / changes / 2026 - 5 - 28 - concept - bridge - observer / specs / concept - bridge - observer / spec.md
            . / openspec / changes / 2026 - 5 - 28 - concept - bridge - observer / tasks.md
            . / openspec / changes / 2026 - 5 - 28 - concept - bridge - observer / design.md
            . / openspec / changes / 2026 - 7 - 19 - obsidian - pebkac - config / proposal.md
            . / openspec / changes / 2026 - 5 - 30 - vessel - binary - redeploy - on - source - drift / proposal.md
            . / openspec / changes / 2026 - 5 - 30 - vessel - binary - redeploy - on - source - drift / tasks.md
            . / openspec / changes / 2026 - 5 - 18 - chain - credit - ancestor - signature - fix / proposal.md
            . / openspec / changes / 2026 - 5 - 18 - chain - credit - ancestor - signature - fix / tasks.md
            . / openspec / changes / 2026 - 5 - 18 - chain - credit - ancestor - signature - fix / design.md
            . / openspec / changes / 2026 - 5 - 19 - ias - executor - as - canonical - host / proposal.md
            . / openspec / changes / 2026 - 5 - 19 - ias - executor - as - canonical - host / specs / goal - host / spec.md
            . / openspec / changes / 2026 - 5 - 19 - ias - executor - as - canonical - host / tasks.md
            . / openspec / changes / 2026 - 5 - 19 - ias - executor - as - canonical - host / design.md
            . / openspec / changes / 2026 - 6 - 1 - substrate - permissive - activity - authoring / proposal.md
            . / openspec / changes / 2026 - 6 - 1 - substrate - permissive - activity - authoring / specs / substrate - activity - authoring / spec.md
            . / openspec / changes / 2026 - 6 - 1 - substrate - permissive - activity - authoring / tasks.md
            . / openspec / changes / 2026 - 6 - 16 - substrate - namespace - and - compose - migration / proposal.md
            . / openspec / changes / 2026 - 6 - 16 - substrate - namespace - and - compose - migration / tasks.md
            . / openspec / changes / 2026 - 6 - 23 - demand - driven - orphan - capability - detection / proposal.md
            . / openspec / changes / 2026 - 6 - 23 - demand - driven - orphan - capability - detection / tasks.md
            . / openspec / changes / 2026 - 6 - 23 - demand - driven - orphan - capability - detection / findings / verify - 2026 - 6 - 24.;
    while (md
        . / openspec / changes / 2026 - 6 - 23 - demand - driven - orphan - capability - detection / design.md
        . / openspec / changes / 2026 - 5 - 31 - substrate - self - audit - meta / proposal.md
        . / openspec / changes / 2026 - 5 - 31 - substrate - self - audit - meta / tasks.md
        . / openspec / changes / 2026 - 6 - 4 - learning - rate - 1 - embedding - conditioned - posterior / proposal.md
        . / openspec / changes / 2026 - 6 - 4 - learning - rate - 1 - embedding - conditioned - posterior / tasks.md
        . / openspec / changes / 2026 - 5 - 31 - substrate - fleet - federation / proposal.md
        . / openspec / changes / 2026 - 5 - 31 - substrate - fleet - federation / specs / vessel - pubkey - identity / spec.md
        . / openspec / changes / 2026 - 5 - 31 - substrate - fleet - federation / specs / observe - detect - resolve / spec.md
        . / openspec / changes / 2026 - 5 - 31 - substrate - fleet - federation / specs / two - sided - traces / spec.md
        . / openspec / changes / 2026 - 5 - 31 - substrate - fleet - federation / specs / substrate - image - artifact / spec.md
        . / openspec / changes / 2026 - 5 - 31 - substrate - fleet - federation / specs / federated - discovery / spec.md
        . / openspec / changes / 2026 - 5 - 31 - substrate - fleet - federation / tasks.md
        . / openspec / changes / 2026 - 5 - 31 - substrate - fleet - federation / design.md
        . / openspec / changes / 2026 - 7 - 15 - vessel - maintenance - parity - gate / proposal.md
        . / openspec / changes / 2026 - 7 - 15 - vessel - maintenance - parity - gate / tasks.md
        . / openspec / changes / 2026 - 7 - 15 - vessel - maintenance - parity - gate / design.md
        . / openspec / changes / 2026 - 5 - 23 - llm - resolver - model - mab / proposal.md
        . / openspec / changes / 2026 - 5 - 23 - llm - resolver - model - mab / specs / llm - resolver - model - mab / spec.md
        . / openspec / changes / 2026 - 5 - 23 - llm - resolver - model - mab / tasks.md
        . / openspec / changes / 2026 - 8 - 28 - escalation - disposition - executor / proposal.md
        . / openspec / changes / 2026 - 4 - 26 - security - hardening - findings / proposal.md
        . / openspec / changes / 2026 - 4 - 26 - security - hardening - findings / specs / security - hardening / spec.md
        . / openspec / changes / 2026 - 4 - 26 - security - hardening - findings / tasks.md
        . / openspec / changes / 2026 - 4 - 26 - security - hardening - findings / design.md
        . / openspec / changes / 2026 - 8 - 26 - reuse - before - mint - crossfamily - dedup / proposal.md
        . / openspec / changes / 2026 - 5 - 23 - substrate - self - deployment / proposal.md
        . / openspec / changes / 2026 - 5 - 23 - substrate - self - deployment / specs / substrate - self - deployment / spec.md
        . / openspec / changes / 2026 - 5 - 23 - substrate - self - deployment / tasks.md
        . / openspec / changes / 2026 - 6 - 3 - pre - lift - bootstrap - and - architecture - aware - loop / proposal.md
        . / openspec / changes / 2026 - 6 - 3 - pre - lift - bootstrap - and - architecture - aware - loop / tasks.md
        . / openspec / changes / 2026 - 6 - 3 - pre - lift - bootstrap - and - architecture - aware - loop / findings / stage - 0 - and - 1 - empirical - verdicts.md
        . / openspec / changes / 2026 - 6 - 3 - pre - lift - bootstrap - and - architecture - aware - loop / design.md
        . / openspec / changes / 2026 - 6 - 1 - obsidian - observe - and - experiment / proposal.md
        . / openspec / changes / 2026 - 6 - 1 - obsidian - observe - and - experiment / specs / obsidian - observation - layer / spec.md
        . / openspec / changes / 2026 - 6 - 1 - obsidian - observe - and - experiment / tasks.md
        . / openspec / changes / 2026 - 5 - 17 - shape - dispatch - agreement / proposal.md
        . / openspec / changes / 2026 - 5 - 17 - shape - dispatch - agreement / tasks.md
        . / openspec / changes / 2026 - 5 - 17 - shape - dispatch - agreement / design.md
        . / openspec / changes / 2026 - 6 - 1 - concept - db - upkeep - loop / proposal.md
        . / openspec / changes / 2026 - 6 - 1 - concept - db - upkeep - loop / tasks.md
        . / openspec / changes / 2026 - 6 - 1 - concept - db - upkeep - loop / findings / 2026 - 6 - 3 - concept - usage - backfill - wired.md
        . / openspec / changes / 2026 - 7 - 1 - shape - action - evidence - closure - proof / proposal.md
        . / openspec / changes / 2026 - 7 - 1 - shape - action - evidence - closure - proof / tasks.md
        . / openspec / changes / 2026 - 7 - 1 - shape - action - evidence - closure - proof / design.md
        . / openspec / changes / 2026 - 5 - 18 - test - audit - loop / proposal.md
        . / openspec / changes / 2026 - 5 - 18 - test - audit - loop / specs / test - audit - loop / spec.md
        . / openspec / changes / 2026 - 5 - 18 - test - audit - loop / tasks.md
        . / openspec / changes / 2026 - 5 - 18 - test - audit - loop / design.md
        . / openspec / changes / 2026 - 5 - 23 - single - container - substrate / tasks.md
        . / openspec / changes / 2026 - 5 - 23 - single - container - substrate / design.md
        . / openspec / changes / 2026 - 5 - 31 - goal - host - oom - bounded - concurrency / proposal.md
        . / openspec / changes / 2026 - 5 - 31 - goal - host - oom - bounded - concurrency / tasks.md
        . / openspec / changes / 2026 - 8 - 17 - invoke - interface - deploy - reach - check - activity / proposal.md
        . / openspec / changes / 2026 - 8 - 17 - invoke - interface - deploy - reach - check - activity / tasks.md
        . / openspec / changes / 2026 - 5 - 23 - harness - as - lifecycle - participant / proposal.md
        . / openspec / changes / 2026 - 5 - 23 - harness - as - lifecycle - participant / specs / harness - lifecycle / spec.md
        . / openspec / changes / 2026 - 5 - 23 - harness - as - lifecycle - participant / tasks.md
        . / openspec / changes / 2026 - 5 - 23 - harness - as - lifecycle - participant / design.md
        . / openspec / changes / 2026 - 6 - 4 - learning - rate - 6 - td - lambda - credit / proposal.md
        . / openspec / changes / 2026 - 6 - 4 - learning - rate - 6 - td - lambda - credit / tasks.md
        . / openspec / changes / 2026 - 7 - 9 - restore - contiguous - shape - flow / proposal.md
        . / openspec / changes / 2026 - 7 - 9 - restore - contiguous - shape - flow / VERIFY - 2026 - 7 - 9 - contiguous - shape - flow.md
        . / openspec / changes / 2026 - 7 - 9 - restore - contiguous - shape - flow / specs / contiguous - shape - flow / spec.md
        . / openspec / changes / 2026 - 7 - 9 - restore - contiguous - shape - flow / tasks.md
        . / openspec / changes / 2026 - 7 - 9 - restore - contiguous - shape - flow / design.md
        . / Deep);
    Cap;
    deepcap - c7e1.md
        . / node_modules / .bun - cache / uuidv7;
    .1;
    /CHANGELOG.md
        . / node_modules / .bun - cache / uuidv7;
    .1;
    /README.md
        . / node_modules / .bun - cache /  / typescript - linux - x64;
    .2;
    /README.md
        . / node_modules / .bun - cache / typescript;
    .2;
    /vendor/vscode - jsonrpc / README.md
        . / node_modules / .bun - cache / typescript;
    .2;
    /README.md
        . / node_modules / .bun - cache / surrealdb;
    .8;
    /README.md
        . / validation / reports / HUMAN_SURFACE_INTERACTION_AUDIT.md
        . / validation / reports / BLOCKER_CLEARANCE_2026 - 8 - 16.;
    md
        . / validation / reports / CONDITIONED_DIFFERENTIATION.md
        . / validation / reports / SUBSTRATE_DOC_DELTA.md
        . / validation / reports / SELECTION_SEAM_ROOT_CAUSE_2026 - 8 - 22.;
    md
        . / validation / reports / PREREG_adaptation_intervention_2026 - 9 - 6..md
        . / validation / reports / RECTIFICATION_AND_DEMONSTRATION.md
        . / validation / reports / SETUP_UX_MAP.md
        . / validation / reports / AUTONOMY_DEMONSTRABILITY_2026 - 8 - 22.;
    md
        . / validation / reports / BRINGUP_THREE_PATHS.md
        . / validation / reports / AUDIT_EXPECTATIONS_2026 - 8 - 22.;
    md
        . / validation / reports / README_FIRST_READER_AUDIT.md
        . / validation / reports / LEARNING_ARCHITECTURE_REVIEW.md
        . / validation / reports / BUILT_BUT_NOT_RESOLVED.md
        . / validation / reports / PRODUCER_INDEX_CANNOT_SEE_ACTIVITIES_2026 - 9 - 8;
    md
        . / validation / reports / COMPOSITION_LEARNING_ARCHITECTURE_2026 - 8 - 21.;
    md
        . / validation / reports / COMPOSITION_LEARNING_STATE_2026 - 8 - 20.;
    md
        . / validation / reports / ROUND3_INVENTORY_AND_JOIN_DELTA.md
        . / validation / reports / NEEDLE_MOVERS_2026 - 8 - 22.;
    md
        . / validation / reports / ONE_SURFACE_AUDIT_DELTA.md
        . / validation / reports / VESSEL_INVENTORY_DOC_AUDIT.md
        . / validation / reports / LEARNING_AUDIT_ROUND2.md
        . / validation / reports / SEAM_PROBE_BASELINE_2026 - 8 - 21.;
    md
        . / validation / reports / STEP_COUNT_CALIBRATION.md
        . / validation / reports / B1_B3_REAL_FIXES_READY_2026 - 8 - 24.;
    md
        . / validation / reports / PROCESS_MEANT_VS_ACTUAL.md
        . / validation / reports / COMPOSITION_WIRING_AUDIT.md
        . / validation / reports / SEAM_MAP_2026 - 8 - 21.;
    md
        . / validation / reports / substrate - technical - investigation / ADDENDUM - 2026 - 9 - 10 - operational - evidence.md
        . / validation / reports / COMPOSITIONALITY_STATE.md
        . / validation / reports / LEARNING_DB_ARCHITECTURE_AUDIT_2026 - 8 - 22.;
    md
        . / validation / reports / ESCAPE_VALVE_CAUSAL_CHAIN_2026 - 8 - 29.;
    md
        . / validation / reports / README_INSTRUCTION_AUDIT.md
        . / validation / reports / SETUP_UX_REMAP.md
        . / validation / reports / SELF_DEVELOPMENT_WIRING_AUDIT.md
        . / validation / reports / PREREG_endpoint_shape_recovery_2026 - 9 - 6..md
        . / validation / reports / LEARNING_MECHANISM_AUDIT.md
        . / validation / reports / SEAM_CLOSURE_2026 - 8 - 22.;
    md
        . / validation / reports / LOOP_CLOSURE_VALIDATION.md
        . / validation / reports / PREREG_gap_admission_grounding_2026 - 9 - 6..md
        . / validation / reports / COMPLEXITY_LADDER_AND_GAP_RESOLUTION.md
        . / validation / reports / GAP_POOL_TRIAGE.md
        . / validation / reports / WIRING_CORRECTION_METHOD_2026 - 8 - 29.;
    md
        . / validation / reports / SETUP_AND_JOIN_DOC_DELTA.md
        . / validation / reports / HUMAN_GOALS_BATTERY.md
        . / validation / reports / POSTERIOR_DIVERGENCE.md
        . / validation / reports / LEARNING_MECHANISM_AUDIT_RUN2.md
        . / validation / reports / DOCUMENTED_LIFECYCLE_VERIFICATION.md
        . / validation / reports / PROCESS_MAP_2026 - 8 - 24.;
    md
        . / validation / reports / ARCHITECTURE_FALSIFICATION_2026 - 8 - 29.;
    md
        . / validation / reports / arithmetic - outcome - repair - 2026 - 9 - 11 / REPORT.md
        . / validation / reports / SEAM_INVENTORY_2026 - 8 - 21.;
    md
        . / validation / reports / launch - contract - gaps - proof / REPORT.md
        . / validation / reports / network - demo / REPORT.md
        . / validation / reports / network - demo / VALIDATION - POST - FIX.md
        . / validation / reports / WORKING_SYSTEM_EXPECTATIONS_2026 - 9 - 2..md
        . / validation / reports / INTERACTABLE_HORIZON_2026 - 9 - 6..md
        . / validation / investigations / 2026 - 5 - 25;
    T08 - 58 - 34 - investigation - 8..md
        . / validation / investigations / 2026 - 5 - 28;
    T09 - 45 - 0;
    Z - investigation - 37..md
        . / validation / investigations / 2026 - 5 - 27;
    T08 - 36 - 14;
    Z - investigation - 40..md
        . / validation / investigations / 2026 - 5 - 26;
    T17 - 30 - 0;
    Z - investigation - 20..md
        . / validation / investigations / 2026 - 5 - 25;
    T17 - 0 - 0;
    Z - investigation - 18..md
        . / validation / investigations / 2026 - 5 - 29;
    T02 - 30 - 0;
    Z - investigation - 54..md
        . / validation / investigations / 2026 - 5 - 29;
    T20 - 30 - 0;
    Z - investigation - 57..md
        . / validation / investigations / 2026 - 5 - 30;
    T11 - 0 - 0;
    Z - investigation - 83;
    md
        . / validation / investigations / 2026 - 5 - 25;
    T11 - 16 - 28;
    Z - investigation - 16..md
        . / validation / investigations / 2026 - 5 - 27;
    T08 - 41 - 9;
    Z - investigation - 41..md
        . / validation / investigations / 2026 - 5 - 26;
    T09 - 25 - 10;
    Z - investigation - 26..md
        . / validation / investigations / 2026 - 5 - 25;
    T07 - 2 - 7 - investigation - 7..md
        . / validation / investigations / 2026 - 5 - 24;
    T09 - 36 - 31 - investigation - 8;
    md
        . / validation / investigations / 2026 - 5 - 27;
    T23 - 50 - 0;
    Z - investigation - 28..md
        . / validation / investigations / 2026 - 5 - 28;
    T11 - 45 - 0;
    Z - investigation - 42..md
        . / validation / investigations / 2026 - 5 - 25;
    T11 - 53 - 3;
    Z - investigation - 18..md
        . / validation / investigations / 2026 - 5 - 28;
    T09 - 10 - 0;
    Z - investigation - 34..md
        . / validation / investigations / 2026 - 5 - 26;
    T08 - 54 - 17;
    Z - investigation - 25..md
        . / validation / investigations / 2026 - 5 - 26;
    T17 - 19 - 56;
    Z - investigation - 39;
    md
        . / validation / investigations / 2026 - 5 - 25;
    T10 - 38 - 48;
    Z - investigation - 19;
    md
        . / validation / investigations / 2026 - 5 - 28;
    T00 - 30 - 0;
    Z - investigation - 30..md
        . / validation / investigations / 2026 - 5 - 24;
    T03 - 22 - 13 - investigation - 2..md
        . / validation / investigations / 2026 - 5 - 28;
    T00 - 55 - 0;
    Z - investigation - 31..md
        . / validation / investigations / 2026 - 5 - 26;
    T22 - 49 - 44;
    Z - investigation - 35..md
        . / validation / investigations / 2026 - 5 - 30;
    T09 - 0 - 0;
    Z - investigation - 78;
    md
        . / validation / investigations / 2026 - 5 - 23;
    T23 - 15 - 1 - investigation - 2..md
        . / validation / investigations / 2026 - 5 - 25;
    T15 - 5 - 0;
    Z - investigation - 17..md
        . / validation / investigations / 2026 - 5 - 27;
    T17 - 15 - 8;
    Z - investigation - 46..md
        . / validation / investigations / 2026 - 5 - 27;
    T09 - 40 - 0;
    Z - investigation - 44..md
        . / validation / investigations / 2026 - 5 - 26;
    T17 - 45 - 0;
    Z - investigation - 21..md
        . / validation / investigations / 2026 - 5 - 23;
    T23 - 12 - 41 - investigation - 1..md
        . / validation / investigations / 2026 - 5 - 27;
    T22 - 55 - 0;
    Z - investigation - 26..md
        . / validation / investigations / 2026 - 5 - 26;
    T18 - 15 - 0;
    Z - investigation - 22..md
        . / validation / investigations / 2026 - 5 - 27;
    T03 - 1 - 58;
    Z - investigation - 38..md
        . / validation / investigations / 2026 - 5 - 28;
    T02 - 0 - 0;
    Z - investigation - 39;
    md
        . / validation / investigations / 2026 - 5 - 26;
    T16 - 44 - 53;
    Z - investigation - 38;
    md
        . / validation / investigations / 2026 - 5 - 24;
    T03 - 58 - 12 - investigation - 3..md
        . / validation / investigations / 2026 - 5 - 28;
    T02 - 55 - 0;
    Z - investigation - 33..md
        . / validation / investigations / 2026 - 5 - 26;
    T00 - 5 - 57;
    Z - investigation - 23..md
        . / validation / investigations / 2026 - 5 - 26;
    T21 - 4 - 24;
    Z - investigation - 34..md
        . / validation / investigations / 2026 - 5 - 27;
    T09 - 55 - 0;
    Z - investigation - 28;
    md
        . / validation / investigations / 2026 - 5 - 27;
    T09 - 30 - 0;
    Z - investigation - 23..md
        . / validation / investigations / 2026 - 5 - 28;
    T12 - 0 - 0;
    Z - investigation - 43..md
        . / validation / investigations / 2026 - 5 - 27;
    T23 - 6 - 32;
    Z - investigation - 59;
    md
        . / validation / investigations / 2026 - 5 - 27;
    T09 - 25 - 0;
    Z - investigation - 43..md
        . / validation / investigations / 2026 - 5 - 24;
    T05 - 37 - 11 - investigation - 5..md
        . / validation / investigations / 2026 - 5 - 26;
    T16 - 0 - 5;
    Z - investigation - 29..md
        . / validation / investigations / 2026 - 5 - 24;
    T23 - 50 - 3 - investigation - 11..md
        . / validation / investigations / 2026 - 5 - 25;
    T06 - 48 - 38 - investigation - 6..md
        . / validation / investigations / 2026 - 5 - 27;
    T22 - 30 - 0;
    Z - investigation - 25..md
        . / validation / investigations / 2026 - 5 - 27;
    T09 - 43 - 57;
    Z - investigation - 42..md
        . / validation / investigations / 2026 - 5 - 26;
    T07 - 39 - 22;
    Z - investigation - 29;
    md
        . / validation / investigations / 2026 - 5 - 28;
    T03 - 56 - 7;
    Z - investigation - 53..md
        . / validation / investigations / 2026 - 5 - 28;
    T05 - 3 - 6;
    Z - investigation - 54..md
        . / validation / investigations / 2026 - 5 - 29;
    T20 - 45 - 0;
    Z - investigation - 58..md
        . / validation / investigations / 2026 - 5 - 24;
    T04 - 58 - 14 - investigation - 4..md
        . / validation / investigations / 2026 - 5 - 25;
    T10 - 29 - 42;
    Z - investigation - 18;
    md
        . / validation / investigations / 2026 - 5 - 25;
    T11 - 30 - 0;
    Z - investigation - 16..md
        . / validation / investigations / 2026 - 5 - 28;
    T09 - 25 - 0;
    Z - investigation - 35..md
        . / validation / investigations / 2026 - 5 - 30;
    T09 - 15 - 0;
    Z - investigation - 82;
    md
        . / validation / investigations / 2026 - 5 - 25;
    T02 - 51 - 9 - investigation - 3..md
        . / validation / investigations / 2026 - 5 - 25;
    T08 - 52 - 35 - investigation - 9;
    md
        . / validation / investigations / 2026 - 5 - 27;
    T09 - 15 - 0;
    Z - investigation - 42..md
        . / validation / investigations / 2026 - 5 - 24;
    T08 - 21 - 5 - investigation - 7..md
        . / validation / investigations / 2026 - 5 - 27;
    T00 - 6 - 32;
    Z - investigation - 37..md
        . / validation / investigations / 2026 - 5 - 25;
    T10 - 32 - 0;
    Z - investigation - 18;
    md
        . / validation / investigations / 2026 - 5 - 28;
    T11 - 10 - 0;
    Z - investigation - 40..md
        . / validation / investigations / 2026 - 5 - 24;
    T02 - 28 - 30 - investigation - 1..md
        . / validation / investigations / 2026 - 5 - 28;
    T09 - 55 - 0;
    Z - investigation - 38..md
        . / validation / investigations / 2026 - 5 - 27;
    T10 - 0 - 0;
    Z - investigation - 45..md
        . / validation / investigations / 2026 - 5 - 25;
    T10 - 13 - 47;
    Z - investigation - 14..md
        . / validation / investigations / 2026 - 5 - 27;
    T07 - 15 - 54;
    Z - investigation - 48;
    md
        . / validation / investigations / 2026 - 5 - 26;
    T16 - 15 - 46;
    Z - investigation - 31..md
        . / validation / investigations / 2026 - 5 - 28;
    T01 - 25 - 0;
    Z - investigation - 38;
    md
        . / validation / investigations / 2026 - 5 - 23;
    T23 - 32 - 45 - investigation - 3..md
        . / validation / investigations / 2026 - 5 - 23;
    T23 - 49 - 8 - investigation - 4..md
        . / validation / investigations / 2026 - 5 - 25;
    T10 - 53 - 0;
    Z - investigation - 19;
    md
        . / validation / investigations / 2026 - 5 - 26;
    T08 - 13 - 9;
    Z - investigation - 24..md
        . / validation / investigations / 2026 - 5 - 28;
    T03 - 7 - 7;
    Z - investigation - 52..md
        . / validation / investigations / 2026 - 5 - 25;
    T09 - 42 - 37 - investigation - 12..md
        . / validation / investigations / 2026 - 5 - 28;
    T02 - 35 - 0;
    Z - investigation - 51..md
        . / validation / investigations / 2026 - 5 - 29;
    T00 - 15 - 0;
    Z - investigation - 50..md
        . / validation / investigations / 2026 - 5 - 28;
    T10 - 5 - 0;
    Z - investigation - 39..md
        . / validation / investigations / 2026 - 5 - 27;
    T12 - 45 - 2;
    Z - investigation - 45..md
        . / validation / investigations / 2026 - 5 - 24;
    T07 - 0 - 44 - investigation - 6..md
        . / validation / investigations / 2026 - 5 - 27;
    T08 - 30 - 0;
    Z - investigation - 49;
    md
        . / validation / investigations / 2026 - 5 - 27;
    T08 - 45 - 0;
    Z - investigation - 40..md
        . / validation / investigations / 2026 - 5 - 24;
    T21 - 19 - 18 - investigation - 10..md
        . / validation / investigations / 2026 - 5 - 28;
    T00 - 15 - 32;
    Z - investigation - 48..md
        . / validation / investigations / 2026 - 5 - 24;
    T16 - 21 - 17 - investigation - 9;
    md
        . / validation / investigations / 2026 - 5 - 25;
    T08 - 43 - 8 - investigation - 8;
    md
        . / validation / investigations / 2026 - 5 - 30;
    T09 - 38 - 0;
    Z - investigation - 84;
    md
        . / validation / investigations / 2026 - 5 - 25;
    T09 - 10 - 48 - investigation - 9..md
        . / validation / investigations / 2026 - 5 - 25;
    T09 - 59 - 6;
    Z - investigation - 13..md
        . / validation / investigations / 2026 - 5 - 25;
    T11 - 34 - 8;
    Z - investigation - 17..md
        . / validation / investigations / 2026 - 5 - 26;
    T23 - 20 - 0;
    Z - investigation - 28;
    md
        . / validation / investigations / 2026 - 5 - 24;
    T20 - 26 - 32 - investigation - 9..md
        . / validation / investigations / 2026 - 5 - 24;
    T17 - 24 - 17 - investigation - 8..md
        . / validation / investigations / 2026 - 5 - 28;
    T11 - 30 - 0;
    Z - investigation - 41..md
        . / validation / investigations / 2026 - 5 - 30;
    T08 - 45 - 0;
    Z - investigation - 63..md
        . / validation / investigations / 2026 - 5 - 26;
    T17 - 12 - 0;
    Z - investigation - 19..md
        . / validation / investigations / 2026 - 5 - 27;
    T22 - 30 - 38;
    Z - investigation - 58;
    md
        . / validation / investigations / 2026 - 5 - 25;
    T15 - 43 - 24;
    Z - investigation - 21..md
        . / validation / investigations / 2026 - 5 - 25 - self - development - routing - analysis.md
        . / validation / investigations / 2026 - 5 - 26;
    T17 - 27 - 13;
    Z - investigation - 32..md
        . / validation / investigations / 2026 - 5 - 30;
    T07 - 30 - 0;
    Z - investigation - 60..md
        . / validation / investigations / 2026 - 5 - 30;
    T10 - 30 - 0;
    Z - investigation - 80;
    md
        . / validation / investigations / 2026 - 5 - 27;
    T22 - 27 - 28;
    Z - investigation - 47..md
        . / validation / investigations / README.md
        . / validation / investigations / 2026 - 5 - 27;
    T04 - 6 - 54;
    Z - investigation - 39..md
        . / validation / investigations / 2026 - 5 - 26;
    T23 - 24 - 54;
    Z - investigation - 36..md
        . / validation / investigations / 2026 - 5 - 28;
    T20 - 0 - 0;
    Z - investigation - 59;
    md
        . / validation / investigations / 2026 - 5 - 28;
    T02 - 22 - 57;
    Z - investigation - 50..md
        . / validation / investigations / 2026 - 5 - 25;
    T06 - 3 - 29 - investigation - 4..md
        . / validation / investigations / 2026 - 5 - 28;
    T09 - 35 - 0;
    Z - investigation - 36..md
        . / validation / investigations / 2026 - 5 - 30;
    T09 - 6 - 0;
    Z - investigation - 81;
    md
        . / validation / investigations / 2026 - 5 - 25;
    T01 - 39 - 9 - investigation - 2..md
        . / validation / investigations / 2026 - 5 - 30;
    T09 - 30 - 0;
    Z - investigation - 79;
    md
        . / validation / investigations / 2026 - 5 - 26;
    T18 - 45 - 0;
    Z - investigation - 23..md
        . / validation / investigations / 2026 - 5 - 28;
    T10 - 50 - 0;
    Z - investigation - 49;
    md
        . / validation / investigations / 2026 - 5 - 26;
    T10 - 1 - 14;
    Z - investigation - 27..md
        . / validation / investigations / 2026 - 5 - 28;
    T01 - 10 - 51;
    Z - investigation - 49..md
        . / validation / investigations / 2026 - 5 - 26;
    T23 - 25 - 0;
    Z - investigation - 29;
    md
        . / validation / investigations / 2026 - 5 - 28;
    T12 - 30 - 0;
    Z - investigation - 44..md
        . / validation / investigations / 2026 - 5 - 28;
    T10 - 25 - 0;
    Z - investigation - 48;
    md
        . / validation / investigations / 2026 - 5 - 25;
    T22 - 6 - 0;
    Z - investigation - 22..md
        . / validation / investigations / 2026 - 5 - 30;
    T07 - 0 - 0;
    Z - investigation - 59..md
        . / validation / investigations / 2026 - 5 - 27;
    T10 - 35 - 5;
    Z - investigation - 43..md
        . / validation / investigations / 2026 - 5 - 28;
    T13 - 10 - 0;
    Z - investigation - 46..md
        . / validation / investigations / 2026 - 5 - 27;
    T11 - 25 - 0;
    Z - investigation - 29;
    md
        . / validation / investigations / 2026 - 5 - 26;
    T16 - 2 - 14;
    Z - investigation - 30..md
        . / validation / investigations / 2026 - 5 - 28;
    T19 - 30 - 0;
    Z - investigation - 58;
    md
        . / validation / investigations / 2026 - 5 - 25;
    T12 - 29 - 57;
    Z - investigation - 20..md
        . / validation / investigations / 2026 - 5 - 28;
    T20 - 15 - 0;
    Z - investigation - 48..md
        . / validation / investigations / 2026 - 5 - 25;
    T09 - 18 - 16 - investigation - 10..md
        . / validation / investigations / 2026 - 5 - 30;
    T08 - 0 - 0;
    Z - investigation - 61..md
        . / validation / investigations / 2026 - 5 - 28;
    T02 - 30 - 0;
    Z - investigation - 32..md
        . / validation / investigations / 2026 - 5 - 27;
    T23 - 25 - 0;
    Z - investigation - 27..md
        . / validation / investigations / 2026 - 5 - 29;
    T20 - 15 - 0;
    Z - investigation - 56..md
        . / validation / investigations / 2026 - 5 - 27;
    T11 - 18 - 17;
    Z - investigation - 44..md
        . / validation / investigations / 2026 - 5 - 25;
    T10 - 17 - 5;
    Z - investigation - 15..md
        . / validation / investigations / 2026 - 5 - 25;
    T00 - 34 - 24 - investigation - 1..md
        . / validation / investigations / 2026 - 5 - 26;
    T19 - 51 - 9;
    Z - investigation - 33..md
        . / validation / investigations / 2026 - 5 - 27;
    T12 - 50 - 0;
    Z - investigation - 24..md
        . / validation / investigations / 2026 - 5 - 25;
    T12 - 1 - 47;
    Z - investigation - 19..md
        . / validation / investigations / 2026 - 5 - 28;
    T17 - 0 - 0;
    Z - investigation - 47..md
        . / validation / investigations / 2026 - 5 - 26;
    T05 - 6 - 1;
    Z - investigation - 28;
    md
        . / validation / investigations / 2026 - 5 - 26;
    T13 - 58 - 11;
    Z - investigation - 28..md
        . / validation / investigations / 2026 - 5 - 28;
    T12 - 40 - 0;
    Z - investigation - 45..md
        . / validation / investigations / 2026 - 5 - 28;
    T00 - 15 - 0;
    Z - investigation - 29..md
        . / validation / investigations / 2026 - 5 - 28;
    T06 - 9 - 59;
    Z - investigation - 55..md
        . / validation / investigations / 2026 - 5 - 27;
    T08 - 50 - 0;
    Z - investigation - 22..md
        . / validation / investigations / 2026 - 5 - 25;
    T06 - 38 - 15 - investigation - 5..md
        . / validation / investigations / 2026 - 5 - 27;
    T08 - 50 - 0;
    Z - investigation - 41..md
        . / validation / investigations / 2026 - 5 - 25;
    T09 - 33 - 42 - investigation - 11..md
        . / validation / substrate - authored / MANIFEST.md
        . / validation / substrate - authored / proposed / 2026 - 6 - 1;
    T10 - 45 - 30;
    Z - vessel - heartbeat - starvation - scan - development - vessel / README.md
        . / validation / substrate - authored / observations / 2026 - 6 - 1;
    T10 - 59 - 19;
    Z - substrate - self - observation - report - development - vessel.md
        . / validation / substrate - authored / observations / 2026 - 6 - 1;
    T19 - 25 - 58;
    Z - substrate - self - merge - ;
    with (-traceable - evidence - development - vessel.md
        . / validation / substrate - authored / observations / 2026 - 6 - 1)
        T21 - 54 - 50;
    Z - substrate - side - effect - ;
    with (-reuse - milestone - development - vessel.md
        . / validation / substrate - authored / observations / 2026 - 6 - 1)
        T19 - 34 - 42;
    Z - substrate - traceable - self - merge - v2 - development - vessel.md
        . / validation / substrate - authored / observations / 2026 - 6 - 1;
    T19 - 19 - 13;
    Z - substrate - self - trust - discovery - development - vessel.md
        . / validation / substrate - authored / observations / 2026 - 6 - 1;
    T18 - 56 - 50;
    Z - goal - host - full - publish - development - vessel.md
        . / validation / substrate - authored / observations / 2026 - 6 - 1;
    T19 - 23 - 2;
    Z - substrate - first - self - merge - milestone - development - vessel.md
        . / validation / substrate - authored / observations / 2026 - 6 - 1;
    T11 - 23 - 43;
    Z - goal - host - observability - report - development - vessel.md
        . / validation / substrate - authored / observations / 2026 - 6 - 1;
    T18 - 49 - 46;
    Z - goal - host - full - composition - development - vessel.md
        . / validation / substrate - authored / observations / 2026 - 6 - 1;
    T19 - 6 - 17;
    Z - substrate - as - development - side - effect - development - vessel.md
        . / validation / recovery / README.md
        . / validation / cascade - analysis / 2026 - 5 - 24 - cascade - meets - explicit - vessels.md
        . / validation / cascade - analysis / 2026 - 5 - 24 - linchpin - cascade.md
        . / validation / demo / README.md
        . / validation / teach / README.md
        . / validation / dev - responses / 2026 - 5 - 27;
    T10 - 40 - 0;
    Z - dev - response - 3..md
        . / validation / dev - responses / 2026 - 5 - 27;
    T10 - 50 - 0;
    Z - dev - response - 4..md
        . / validation / dev - responses / 2026 - 5 - 28;
    T00 - 15 - 0;
    Z - dev - response - 14..md
        . / validation / dev - responses / 2026 - 5 - 27;
    T11 - 25 - 0;
    Z - dev - response - 8;
    md
        . / validation / dev - responses / 2026 - 5 - 27;
    T13 - 15 - 0;
    Z - dev - response - 9..md
        . / validation / dev - responses / 2026 - 5 - 27;
    T12 - 55 - 0;
    Z - dev - response - 8..md
        . / validation / dev - responses / 2026 - 5 - 27;
    T10 - 25 - 0;
    Z - dev - response - 2..md
        . / validation / dev - responses / 2026 - 5 - 28;
    T00 - 50 - 0;
    Z - dev - response - 15..md
        . / validation / dev - responses / 2026 - 5 - 27;
    T19 - 15 - 0;
    Z - dev - response - 10..md
        . / validation / dev - responses / 2026 - 5 - 27;
    T22 - 55 - 0;
    Z - dev - response - 12..md
        . / validation / dev - responses / 2026 - 5 - 27;
    T11 - 0 - 0;
    Z - dev - response - 5..md
        . / validation / dev - responses / 2026 - 5 - 27;
    T11 - 35 - 0;
    Z - dev - response - 9;
    md
        . / validation / dev - responses / README.md
        . / validation / dev - responses / 2026 - 5 - 27;
    T20 - 15 - 0;
    Z - dev - response - 11..md
        . / validation / dev - responses / 2026 - 5 - 27;
    T11 - 15 - 0;
    Z - dev - response - 7..md
        . / validation / dev - responses / 2026 - 5 - 27;
    T23 - 5 - 0;
    Z - dev - response - 13..md
        . / validation / dev - responses / 2026 - 5 - 27;
    T11 - 0 - 30;
    Z - dev - response - 6..md
        . / validation / dev - responses / 2026 - 5 - 28;
    T01 - 30 - 0;
    Z - dev - response - 18;
    md
        . / validation / dev - responses / 2026 - 5 - 27;
    T10 - 10 - 0;
    Z - dev - response - 1..md
        . / validation / runs / baseline - 2026 - 5 - 2..md
        . / validation / demo2 / bringup / review4 / FILM_REVIEW.md
        . / validation / results / 2026 - 7 - 3 - learning - transfer - causal - ledger.md
        . / validation / results / substrate - cycle - resync - 2026 - 8 - 8;
    md
        . / validation / gaps / gap - 4 - goal - name - not - resolved - to - template.md
        . / validation / gaps / gap - 6 - substrate - degradation - and - validation - isolation.md
        . / validation / gaps / gap - 8 - no - substrate - monitoring.md
        . / validation / gaps / INDEX.md
        . / validation / gaps / gap - 3 - goal - failure - without - failure - mode.md
        . / validation / gaps / gap - 1 - no - concept - db -  in -local - substrate.md
        . / validation / gaps / gap - 7 - named - template - success - without - goal - closure.md
        . / validation / gaps / gap - 2 - ws - auth - rejects - substrate - internal - key.md
        . / validation / gaps / gap - 5 - template - churn - coverage - tick.md
        . / validation / README.md
        . / validation / state / COORDINATION.md
        . / validation / observations / README.md
        . / validation / findings / goal - host - mitosis - streaming - refactor - 2026 - 6 - 3 / observation.md
        . / validation / findings / dev - guidance - 2026 - 5 - 25.;
    md
        . / validation / findings / mitosis - empirical - proof - 2026 - 6 - 3 / observation.md
        . / validation / findings / stage - 3 - observation - 2026 - 6 - 3 / observation.md
        . / validation / findings / iter - 34 - narration.md
        . / validation / findings / iter - 25 - narration.md
        . / validation / findings / capability - validation.md
        . / validation / findings / iter - 30 - narration.md
        . / validation / findings / iter - 23 - narration.md
        . / validation / findings / goal - host - dispatch - setup - leak - 2026 - 6 - 3 / observation.md
        . / validation / findings / substrate - orthogonal - learning / 2026 - 6 - 2;
    T02 - 3 - 58;
    Z - orthogonal - learning - generalizable - pattern - development - vessel.md
        . / validation / findings / substrate - self - repair - observation - 2026 - 6 - 3 / observation.md
        . / validation / findings / iter - 20 - narration.md
        . / validation / findings / substrate - self - repair - observation - post - bootstrap - 2026 - 6 - 3 / observation.md
        . / validation / findings / config - surface - audit.md
        . / validation / findings / substrate - authored / 2026 - 6 - 1 - first - substrate - authored - publication.md
        . / validation / findings / side - effect - vessel - improvement - 2026 - 6 - 3 / observation.md
        . / validation / findings / iter - 32 - narration.md
        . / validation / findings / round4 - non - filesystem - capability.md
        . / validation / findings / substrate - scenario - seed - response - 2026 - 6 - 4 / observation.md
        . / validation / findings / substrate - autonomous - 10 - fixes - 2026 - 6 - 4 / observation.md
        . / validation / findings / hub - admin - keyspace - lockout.md
        . / validation / findings / operator - probe - 2026 - 5 - 27 - application - question - answering.md
        . / validation / findings / learning - rate - 2026 - 6 - 4 / SUBSTRATE_AUTONOMOUS_DETECTION_LOOP_2026_06_04.md
        . / validation / findings / learning - rate - 2026 - 6 - 4 / LEARNING_RATE_VALIDATION_2026_06_04.md
        . / validation / findings / learning - rate - 2026 - 6 - 4 / LEARNING_RATE_OBSERVATION_2026_06_04.md
        . / validation / findings / goal - host - mitosis - v2 - streaming - 2026 - 6 - 3 / observation.md
        . / validation / findings / yardstick - 2026 - 6 - 1 - obsidian - meta - skill.md
        . / validation / findings / 2026 - 6 - 3 - durability - and - new  - repo - primitives.md
        . / validation / findings / iter - 26 - narration.md
        . / validation / findings / autonomous - loop - fires - 2026 - 6 - 3 / observation.md
        . / validation / findings / iter - 18 - narration.md
        . / validation / findings / self - improvement - loop - 2026 - 6 - 4 / observation.md
        . / validation / findings / iter - 29 - narration.md
        . / validation / findings / round6 - hub - trace - read - latency.md
        . / validation / findings / round7 - blocker - sweep.md
        . / validation / findings / iter - 33 - narration.md
        . / validation / findings / iter - 15 - narration.md
        . / validation / findings / iter - 16 - narration.md
        . / validation / findings / substrate - consistency / 2026 - 6 - 1;
    T23 - 58 - 0;
    Z - post - mode - collapse - alignment - batch.md
        . / validation / findings / substrate - consistency / 2026 - 6 - 1;
    T22 - 19 - 5;
    Z - consistency - and - intent - alignment - report.md
        . / validation / findings / substrate - consistency / 2026 - 6 - 2;
    T00 - 23 - 18;
    Z - baseline - alignment - batch.md
        . / validation / findings / iter - 19 - blocker - f050.md
        . / validation / findings / concept - relevancy - investigation - 2026 - 6 - 4 / observation.md
        . / validation / findings / iter - 22 - narration.md
        . / validation / findings / substrate - driven - development / 2026 - 6 - 1 - merge - mechanism - pivot - to - composition.md
        . / validation / findings / iter - 27 - narration.md
        . / validation / findings / phase - 2 - probe - results - 2026 - 6 - 5 / observation.md
        . / validation / findings / iter - 31 - narration.md
        . / validation / findings / gap - escalation - loop - saturates - development - vessel.md
        . / validation / findings / iter - 17 - narration.md
        . / validation / findings / README.md
        . / validation / findings / substrate - state - conditioning / 2026 - 6 - 2;
    T04 - 49 - 46;
    Z - state - conditioning - baseline - observation - development - vessel.md
        . / validation / findings / round3 - blockers - and - capability.md
        . / validation / findings / substrate - seed - gap - response - 2026 - 6 - 4 / observation.md
        . / validation / findings / iter - 35 - narration.md
        . / validation / findings / f - 83 - debunked.md
        . / validation / findings / sustained - autonomous - loop - 2026 - 6 - 3 / observation.md
        . / validation / findings / dev - guidance - 2026 - 5 - 24.;
    md
        . / validation / findings / iter - 28 - narration.md
        . / validation / findings / 2026 - 6 - 2 - substrate - publishes - to - vessel - repos.md
        . / validation / findings / config - surface - open - decisions.md
        . / validation / findings / blocker - clearance - and - round2.md
        . / validation / findings / iter - 24 - narration.md
        . / validation / findings / substrate - self - detection - recursive / 2026 - 6 - 2;
    T07 - 25 - 27;
    Z - substrate - self - diagnosis - recursive - detection - development - vessel.md
        . / validation / findings / round5 - repairs - landed.md
        . / validation / findings / iter - 21 - narration.md
        . / validation / findings / substrate - ui - observation / 2026 - 6 - 2;
    T07 - 56 - 57;
    Z - substrate - face - and - interactor - learning.md
        . / validation / adversarial - probes / v1 / README.md
        . / validation / workspaces / typescript - multi - file - large / SPEC.md
        . / validation / workspaces / python - grep / README.md
        . / validation / workspaces / empty - workspace / README.md
        . / validation / workspaces / pristine - typescript - project / README.md
        . / validation / workspaces / typescript - complex - numbers / README.md
        . / validation / workspaces / pristine - python - project / README.md
        . / validation / workspaces / python - list - ops / README.md
        . / validation / prompts / 7 - extract - validator.md
        . / validation / prompts / 8 - implement - list - ops.md
        . / validation / prompts / 4 - explain - codebase.md
        . / validation / prompts / 10 - implement - complex - numbers.md
        . / validation / prompts / 5 - undirected - debug.md
        . / validation / prompts / 20 - activity - improvement.md
        . / validation / prompts / 19 - concept - db - integration.md
        . / validation / prompts / 30 - trace - driven - activity - execution.md
        . / validation / prompts / 25 - ts - learning - run - 2 - divide - bug.md
        . / validation / prompts / 2 - add - feature.md
        . / validation / prompts / 36 - long - context - spec - implementation.md
        . / validation / prompts / 23 - upkeep - grows - family.md
        . / validation / prompts / 21 - variant - family - health.md
        . / validation / prompts / 17 - cross - vessel - impulse - resolution.md
        . / validation / prompts / 9 - implement - grep.md
        . / validation / prompts / 16 - trace - driven - activity.md
        . / validation / prompts / 33 - activity - improvement - loop.md
        . / validation / prompts / 34 - cross - vessel - learning - loop.md
        . / validation / prompts / 32 - concept - accumulation - and - learning.md
        . / validation / prompts / 40 - forge - required - shape.md
        . / validation / prompts / 18 - load - impulse - discovery - path_1.default.md
        . / validation / prompts / 27 - ts - learning - run - 4 - add - clamp.md
        . / validation / prompts / 28 - multi - vessel - ecosystem - health.md
        . / validation / prompts / 22 - selection - and - score - update.md
        . / validation / prompts / 35 - multi - file - bug - fix.md
        . / validation / prompts / 3 - refactor.md
        . / validation / prompts / 6 - add - divide - ;
    with (-error - handling.md
        . / validation / prompts / 1 - fix - failing - test.md
        . / validation / prompts / 15 - trace - analysis.md
        . / validation / prompts / 24 - ts - learning - run - 1 - multiply - bug.md
        . / validation / prompts / 38 - web - fetch.md
        . / validation / prompts / 31 - vessel - capability - resolution.md
        . / validation / prompts / 37 - ambiguous - improve - code.md
        . / validation / prompts / 14 - registry - lookup - then - fix.md
        . / validation / prompts / 26 - ts - learning - run - 3 - power - bug.md
        . / validation / prompts / 29 - lifecycle - hooks - and - score - update.md
        . / validation / goals / EXTERNAL_DATA_GAMUT.md
        . / validation / failure - modes / PROGRESSION.md
        . / validation / failure - modes / README.md
        . / validation / failure - modes / cycles / README.md
        . / validation / docs / CLAUDE_CODE_CONTAINER.md
        . / repos / concept - db / scripts / git - hooks / README.md
        . / repos / concept - db / CLAUDE.md
        . / repos / development - vessel / node_modules / bun - types / node_modules /  / node / node_modules / undici - types / README.md
        . / repos / development - vessel / node_modules / bun - types / node_modules /  / node / README.md
        . / repos / development - vessel / node_modules / bun - types / README.md
        . / repos / development - vessel / node_modules / bun - types / CLAUDE.md
        . / repos / development - vessel / node_modules / bun - types / docs / README.md
        . / repos / development - vessel / node_modules /  / ias - executor - ts / node_modules / bun - types / README.md
        . / repos / development - vessel / node_modules /  / ias - executor - ts / node_modules / bun - types / docs / README.md
        . / repos / development - vessel / node_modules /  / ias - executor - ts / node_modules /  / node / README.md
        . / repos / development - vessel / node_modules /  / ias - executor - ts / node_modules /  / bun / node_modules / bun - types / node_modules /  / node / node_modules / undici - types / README.md
        . / repos / development - vessel / node_modules /  / ias - executor - ts / node_modules /  / bun / node_modules / bun - types / node_modules /  / node / README.md
        . / repos / development - vessel / node_modules /  / ias - executor - ts / node_modules /  / bun / node_modules / bun - types / README.md
        . / repos / development - vessel / node_modules /  / ias - executor - ts / node_modules /  / bun / node_modules / bun - types / docs / README.md
        . / repos / development - vessel / node_modules /  / ias - executor - ts / node_modules /  / bun / README.md
        . / repos / development - vessel / node_modules /  / ias - executor - ts / node_modules / typescript / SECURITY.md
        . / repos / development - vessel / node_modules /  / ias - executor - ts / node_modules / typescript / README.md
        . / repos / development - vessel / node_modules /  / ias - executor - ts / node_modules / .bun - cache /  / node)
    .0;
    /README.md
        . / repos / development - vessel / node_modules /  / ias - executor - ts / node_modules / .bun - cache /  / bun;
    .14;
    /README.md
        . / repos / development - vessel / node_modules /  / ias - executor - ts / node_modules / .bun - cache / typescript;
    .3;
    /SECURITY.md
        . / repos / development - vessel / node_modules /  / ias - executor - ts / node_modules / .bun - cache / typescript;
    .3;
    /README.md
        . / repos / development - vessel / node_modules /  / ias - executor - ts / node_modules / .bun - cache / bun - types;
    .14;
    /README.md
        . / repos / development - vessel / node_modules /  / ias - executor - ts / node_modules / .bun - cache / bun - types;
    .14;
    /docs/README.md
        . / repos / development - vessel / node_modules /  / ias - executor - ts / node_modules / .bun - cache / undici - types;
    .6;
    /README.md
        . / repos / development - vessel / node_modules /  / ias - executor - ts / node_modules / undici - types / README.md
        . / repos / development - vessel / node_modules /  / ias - executor - ts / README.md
        . / repos / development - vessel / node_modules / zod / README.md
        . / repos / development - vessel / node_modules /  / node / README.md
        . / repos / development - vessel / node_modules /  / bun / README.md
        . / repos / development - vessel / node_modules / brace - expansion / README.md
        . / repos / development - vessel / node_modules / code - block - writer / README.md
        . / repos / development - vessel / node_modules / hono / README.md
        . / repos / development - vessel / node_modules /  - morph / common / readme.md
        . / repos / development - vessel / node_modules / picomatch / README.md
        . / repos / development - vessel / node_modules / fdir / README.md
        . / repos / development - vessel / node_modules / typescript / SECURITY.md
        . / repos / development - vessel / node_modules / typescript / README.md
        . / repos / development - vessel / node_modules / .bun - cache /  / node;
    .1;
    /README.md
        . / repos / development - vessel / node_modules / .bun - cache /  / bun;
    .14;
    /README.md
        . / repos / development - vessel / node_modules / .bun - cache /  / bun;
    .2;
    /README.md
        . / repos / development - vessel / node_modules / .bun - cache /  / node;
    .3;
    /README.md
        . / repos / development - vessel / node_modules / .bun - cache / zod;
    .76;
    /README.md
        . / repos / development - vessel / node_modules / .bun - cache / picomatch;
    .5;
    /README.md
        . / repos / development - vessel / node_modules / .bun - cache / balanced - match;
    .4;
    /README.md
        . / repos / development - vessel / node_modules / .bun - cache / balanced - match;
    .4;
    /LICENSE.md
        . / repos / development - vessel / node_modules / .bun - cache / fdir;
    .0;
    /README.md
        . / repos / development - vessel / node_modules / .bun - cache /  - morph / common;
    .0;
    /readme.md
        . / repos / development - vessel / node_modules / .bun - cache / code - block - writer;
    .3;
    /README.md
        . / repos / development - vessel / node_modules / .bun - cache / typescript;
    .3;
    /SECURITY.md
        . / repos / development - vessel / node_modules / .bun - cache / typescript;
    .3;
    /README.md
        . / repos / development - vessel / node_modules / .bun - cache / minimatch;
    .5;
    /README.md
        . / repos / development - vessel / node_modules / .bun - cache / minimatch;
    .5;
    /LICENSE.md
        . / repos / development - vessel / node_modules / .bun - cache / undici - types;
    .0;
    /README.md
        . / repos / development - vessel / node_modules / .bun - cache / tinyglobby;
    .17;
    /README.md
        . / repos / development - vessel / node_modules / .bun - cache / brace - expansion;
    .7;
    /README.md
        . / repos / development - vessel / node_modules / .bun - cache / bun - types;
    .14;
    /README.md
        . / repos / development - vessel / node_modules / .bun - cache / bun - types;
    .14;
    /docs/README.md
        . / repos / development - vessel / node_modules / .bun - cache / undici - types;
    .6;
    /README.md
        . / repos / development - vessel / node_modules / .bun - cache / bun - types;
    .2;
    /README.md
        . / repos / development - vessel / node_modules / .bun - cache / bun - types;
    .2;
    /CLAUDE.md
        . / repos / development - vessel / node_modules / .bun - cache / bun - types;
    .2;
    /docs/README.md
        . / repos / development - vessel / node_modules / .bun - cache / ts - morph;
    .0;
    /readme.md
        . / repos / development - vessel / node_modules / .bun - cache / hono;
    .21;
    /README.md
        . / repos / development - vessel / node_modules / .bun - cache / path_1.default - browserify;
    .1;
    /CHANGELOG.md
        . / repos / development - vessel / node_modules / .bun - cache / path_1.default - browserify;
    .1;
    /security.md
        . / repos / development - vessel / node_modules / .bun - cache / path_1.default - browserify;
    .1;
    /README.md
        . / repos / development - vessel / node_modules / minimatch / README.md
        . / repos / development - vessel / node_modules / minimatch / LICENSE.md
        . / repos / development - vessel / node_modules / tinyglobby / README.md
        . / repos / development - vessel / node_modules / undici - types / README.md
        . / repos / development - vessel / node_modules / balanced - match / README.md
        . / repos / development - vessel / node_modules / balanced - match / LICENSE.md
        . / repos / development - vessel / node_modules / path_1.default - browserify / CHANGELOG.md
        . / repos / development - vessel / node_modules / path_1.default - browserify / security.md
        . / repos / development - vessel / node_modules / path_1.default - browserify / README.md
        . / repos / development - vessel / node_modules / ts - morph / readme.md
        . / repos / development - vessel / README.md
        . / repos / development - vessel / CLAUDE.md
        . / repos / development - vessel / docs / VALIDATION_2026_05_22.md
        . / repos / development - vessel / docs / CASES_AND_FLOWS.md
        . / repos / development - vessel / docs / VERIFY_2026_05_21b.md
        . / repos / development - vessel / docs / SELF_APPLICATION.md
        . / repos / development - vessel / docs / VERIFY_2026_05_21c.md
        . / repos / development - vessel / docs / VERIFY_2026_07_09_autonomous_parity.md
        . / repos / development - vessel / docs / VERIFY_2026_05_21.md
        . / repos / development - vessel / docs / findings / 2026 - 6 - 2 - substrate - managed - test.md
        . / repos / identity - vessel / scripts / git - hooks / README.md
        . / repos / identity - vessel / README.md
        . / repos / identity - vessel / docs / archive / 2026 - 4 - 2 / DASHBOARD_TEST_RESULTS.md
        . / repos / identity - vessel / docs / archive / 2026 - 4 - 2 / VESSEL_SEPARATION_OF_CONCERNS.md
        . / repos / identity - vessel / docs / archive / 2026 - 4 - 2 / TRACE_SCHEMA.md
        . / repos / identity - vessel / docs / archive / 2026 - 4 - 2 / AUTH_FLOW_DIAGRAM.md
        . / repos / identity - vessel / docs / archive / 2026 - 4 - 2 / INTEGRATION_STATUS.md
        . / repos / identity - vessel / docs / archive / 2026 - 4 - 2 / DUAL_AUTH_ARCHITECTURE.md
        . / repos / identity - vessel / docs / archive / 2026 - 4 - 2 / VALIDATION_RESULTS.md
        . / repos / obsidian - vessel / README.md
        . / repos / obsidian - vessel / docs / INTERACTION_MODEL.md
        . / repos / cpg - inference - ts / CHANGELOG.md
        . / repos / cpg - inference - ts / README.md
        . / repos / cpg - inference - ts / docs / PUBLISHING.md
        . / repos / llm - resolver - vessel / node_modules / bun - types / README.md
        . / repos / llm - resolver - vessel / node_modules / bun - types / docs / README.md
        . / repos / llm - resolver - vessel / node_modules / es - object - atoms / CHANGELOG.md
        . / repos / llm - resolver - vessel / node_modules / es - object - atoms / README.md
        . / repos / llm - resolver - vessel / node_modules / es - errors / CHANGELOG.md
        . / repos / llm - resolver - vessel / node_modules / es - errors / README.md
        . / repos / llm - resolver - vessel / node_modules /  / ias - executor - ts / node_modules / bun - types / README.md
        . / repos / llm - resolver - vessel / node_modules /  / ias - executor - ts / node_modules / bun - types / docs / README.md
        . / repos / llm - resolver - vessel / node_modules /  / ias - executor - ts / node_modules /  / node / README.md
        . / repos / llm - resolver - vessel / node_modules /  / ias - executor - ts / node_modules /  / bun / README.md
        . / repos / llm - resolver - vessel / node_modules /  / ias - executor - ts / node_modules / typescript / SECURITY.md
        . / repos / llm - resolver - vessel / node_modules /  / ias - executor - ts / node_modules / typescript / README.md
        . / repos / llm - resolver - vessel / node_modules /  / ias - executor - ts / node_modules / .bun - cache /  / node;
    .0;
    /README.md
        . / repos / llm - resolver - vessel / node_modules /  / ias - executor - ts / node_modules / .bun - cache /  / bun;
    .14;
    /README.md
        . / repos / llm - resolver - vessel / node_modules /  / ias - executor - ts / node_modules / .bun - cache / typescript;
    .3;
    /SECURITY.md
        . / repos / llm - resolver - vessel / node_modules /  / ias - executor - ts / node_modules / .bun - cache / typescript;
    .3;
    /README.md
        . / repos / llm - resolver - vessel / node_modules /  / ias - executor - ts / node_modules / .bun - cache / bun - types;
    .14;
    /README.md
        . / repos / llm - resolver - vessel / node_modules /  / ias - executor - ts / node_modules / .bun - cache / bun - types;
    .14;
    /docs/README.md
        . / repos / llm - resolver - vessel / node_modules /  / ias - executor - ts / node_modules / .bun - cache / undici - types;
    .6;
    /README.md
        . / repos / llm - resolver - vessel / node_modules /  / ias - executor - ts / node_modules / undici - types / README.md
        . / repos / llm - resolver - vessel / node_modules /  / ias - executor - ts / README.md
        . / repos / llm - resolver - vessel / node_modules / formdata - node / readme.md
        . / repos / llm - resolver - vessel / node_modules / web - streams - polyfill / README.md
        . / repos / llm - resolver - vessel / node_modules /  / node - fetch / README.md
        . / repos / llm - resolver - vessel / node_modules /  / node / README.md
        . / repos / llm - resolver - vessel / node_modules /  / bun / README.md
        . / repos / llm - resolver - vessel / node_modules / abort - controller / README.md
        . / repos / llm - resolver - vessel / node_modules / openai / src / _vendor / partial - json - parser / README.md
        . / repos / llm - resolver - vessel / node_modules / openai / src / _vendor / zod - to - json - schema / README.md
        . / repos / llm - resolver - vessel / node_modules / openai / src / internal / README.md
        . / repos / llm - resolver - vessel / node_modules / openai / src / internal / qs / README.md
        . / repos / llm - resolver - vessel / node_modules / openai / src / internal / qs / LICENSE.md
        . / repos / llm - resolver - vessel / node_modules / openai / src / core / README.md
        . / repos / llm - resolver - vessel / node_modules / openai / src / resources / realtime / api.md
        . / repos / llm - resolver - vessel / node_modules / openai / src / resources / responses / api.md
        . / repos / llm - resolver - vessel / node_modules / openai / src / resources / webhooks / api.md
        . / repos / llm - resolver - vessel / node_modules / openai / src / resources / conversations / api.md
        . / repos / llm - resolver - vessel / node_modules / openai / CHANGELOG.md
        . / repos / llm - resolver - vessel / node_modules / openai / README.md
        . / repos / llm - resolver - vessel / node_modules / mime - db / HISTORY.md
        . / repos / llm - resolver - vessel / node_modules / mime - db / README.md
        . / repos / llm - resolver - vessel / node_modules / form - data - encoder / readme.md
        . / repos / llm - resolver - vessel / node_modules / math - intrinsics / CHANGELOG.md
        . / repos / llm - resolver - vessel / node_modules / math - intrinsics / README.md
        . / repos / llm - resolver - vessel / node_modules / dunder - proto / CHANGELOG.md
        . / repos / llm - resolver - vessel / node_modules / dunder - proto / README.md
        . / repos / llm - resolver - vessel / node_modules / typescript / SECURITY.md
        . / repos / llm - resolver - vessel / node_modules / typescript / README.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / webidl - conversions;
    .1;
    /README.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / webidl - conversions;
    .1;
    /LICENSE.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / mime - db;
    .0;
    /HISTORY.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / mime - db;
    .0;
    /README.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / event - target - shim;
    .1;
    /README.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / node - domexception;
    .0;
    /README.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / node - domexception;
    .0;
    /.history/README_20210527214323.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / node - domexception;
    .0;
    /.history/README_20210527213411.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / node - domexception;
    .0;
    /.history/README_20210527213803.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / node - domexception;
    .0;
    /.history/README_20210527213345.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / node - domexception;
    .0;
    /.history/README_20210527203617.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / node - domexception;
    .0;
    /.history/README_20210527212714.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / node - domexception;
    .0;
    /.history/README_20210527214408.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / hasown;
    .3;
    /CHANGELOG.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / hasown;
    .3;
    /README.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / web - streams - polyfill;
    .0 - 7;
    b1dbbf11ca1d290;
    /README.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / formdata - node;
    .1;
    /readme.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / combined - stream;
    .8;
    /Readme.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache /  / bun;
    .14;
    /README.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache /  / node - fetch;
    .13;
    /README.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache /  / node;
    .130;
    /README.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / dunder - proto;
    .1;
    /CHANGELOG.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / dunder - proto;
    .1;
    /README.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / math - intrinsics;
    .0;
    /CHANGELOG.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / math - intrinsics;
    .0;
    /README.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / asynckit;
    .0;
    /README.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / form - data - encoder;
    .2;
    /readme.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / call - bind - apply - helpers;
    .2;
    /CHANGELOG.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / call - bind - apply - helpers;
    .2;
    /README.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / delayed - stream;
    .0;
    /Readme.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / openai;
    .0;
    /src/_vendor / partial - json - parser / README.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / openai;
    .0;
    /src/_vendor / zod - to - json - schema / README.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / openai;
    .0;
    /src/internal / README.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / openai;
    .0;
    /src/internal / qs / README.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / openai;
    .0;
    /src/internal / qs / LICENSE.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / openai;
    .0;
    /src/core / README.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / openai;
    .0;
    /src/resources / realtime / api.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / openai;
    .0;
    /src/resources / responses / api.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / openai;
    .0;
    /src/resources / webhooks / api.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / openai;
    .0;
    /src/resources / conversations / api.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / openai;
    .0;
    /CHANGELOG.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / openai;
    .0;
    /README.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache /  - ai / sdk;
    .0;
    /src/_vendor / partial - json - parser / README.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache /  - ai / sdk;
    .0;
    /src/_shims / README.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache /  - ai / sdk;
    .0;
    /CHANGELOG.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache /  - ai / sdk;
    .0;
    /_shims/README.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache /  - ai / sdk;
    .0;
    /README.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / abort - controller;
    .0;
    /README.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / typescript;
    .3;
    /SECURITY.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / typescript;
    .3;
    /README.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / mime - types;
    .35;
    /HISTORY.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / mime - types;
    .35;
    /README.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / gopd;
    .0;
    /CHANGELOG.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / gopd;
    .0;
    /README.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / get - intrinsic;
    .0;
    /CHANGELOG.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / get - intrinsic;
    .0;
    /README.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / node - fetch;
    .0;
    /README.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / node - fetch;
    .0;
    /LICENSE.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / has - symbols;
    .0;
    /CHANGELOG.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / has - symbols;
    .0;
    /README.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / agentkeepalive;
    .0;
    /README.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / es - object - atoms;
    .2;
    /CHANGELOG.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / es - object - atoms;
    .2;
    /README.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / whatwg - url;
    .0;
    /README.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / function () { } - bind;
    .2;
    /.github/SECURITY.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / function () { } - bind;
    .2;
    /CHANGELOG.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / function () { } - bind;
    .2;
    /README.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / has - tostringtag;
    .2;
    /CHANGELOG.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / has - tostringtag;
    .2;
    /README.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / get - proto;
    .1;
    /CHANGELOG.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / get - proto;
    .1;
    /README.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / undici - types;
    .5;
    /README.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / bun - types;
    .14;
    /README.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / bun - types;
    .14;
    /docs/README.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / es - errors;
    .0;
    /CHANGELOG.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / es - errors;
    .0;
    /README.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / humanize - ms;
    .1;
    /History.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / humanize - ms;
    .1;
    /README.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / es - define - property;
    .1;
    /CHANGELOG.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / es - define - property;
    .1;
    /README.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / form - data;
    .5;
    /CHANGELOG.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / form - data;
    .5;
    /README.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / ms;
    .3;
    /readme.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / ms;
    .3;
    /license.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / es - set - tostringtag;
    .0;
    /CHANGELOG.md
        . / repos / llm - resolver - vessel / node_modules / .bun - cache / es - set - tostringtag;
    .0;
    /README.md
        . / repos / llm - resolver - vessel / node_modules /  - ai / sdk / src / _vendor / partial - json - parser / README.md
        . / repos / llm - resolver - vessel / node_modules /  - ai / sdk / src / _shims / README.md
        . / repos / llm - resolver - vessel / node_modules /  - ai / sdk / CHANGELOG.md
        . / repos / llm - resolver - vessel / node_modules /  - ai / sdk / _shims / README.md
        . / repos / llm - resolver - vessel / node_modules /  - ai / sdk / README.md
        . / repos / llm - resolver - vessel / node_modules / node - fetch / README.md
        . / repos / llm - resolver - vessel / node_modules / node - fetch / LICENSE.md
        . / repos / llm - resolver - vessel / node_modules / mime - types / HISTORY.md
        . / repos / llm - resolver - vessel / node_modules / mime - types / README.md
        . / repos / llm - resolver - vessel / node_modules / node - domexception / README.md
        . / repos / llm - resolver - vessel / node_modules / node - domexception / .history / README_20210527214323.md
        . / repos / llm - resolver - vessel / node_modules / node - domexception / .history / README_20210527213411.md
        . / repos / llm - resolver - vessel / node_modules / node - domexception / .history / README_20210527213803.md
        . / repos / llm - resolver - vessel / node_modules / node - domexception / .history / README_20210527213345.md
        . / repos / llm - resolver - vessel / node_modules / node - domexception / .history / README_20210527203617.md
        . / repos / llm - resolver - vessel / node_modules / node - domexception / .history / README_20210527212714.md
        . / repos / llm - resolver - vessel / node_modules / node - domexception / .history / README_20210527214408.md
        . / repos / llm - resolver - vessel / node_modules / combined - stream / Readme.md
        . / repos / llm - resolver - vessel / node_modules / humanize - ms / History.md
        . / repos / llm - resolver - vessel / node_modules / humanize - ms / README.md
        . / repos / llm - resolver - vessel / node_modules / ms / readme.md
        . / repos / llm - resolver - vessel / node_modules / ms / license.md
        . / repos / llm - resolver - vessel / node_modules / hasown / CHANGELOG.md
        . / repos / llm - resolver - vessel / node_modules / hasown / README.md
        . / repos / llm - resolver - vessel / node_modules / gopd / CHANGELOG.md
        . / repos / llm - resolver - vessel / node_modules / gopd / README.md
        . / repos / llm - resolver - vessel / node_modules / es - define - property / CHANGELOG.md
        . / repos / llm - resolver - vessel / node_modules / es - define - property / README.md
        . / repos / llm - resolver - vessel / node_modules / undici - types / README.md
        . / repos / llm - resolver - vessel / node_modules / asynckit / README.md
        . / repos / llm - resolver - vessel / node_modules / get - intrinsic / CHANGELOG.md
        . / repos / llm - resolver - vessel / node_modules / get - intrinsic / README.md
        . / repos / llm - resolver - vessel / node_modules / has - tostringtag / CHANGELOG.md
        . / repos / llm - resolver - vessel / node_modules / has - tostringtag / README.md
        . / repos / llm - resolver - vessel / node_modules / event - target - shim / README.md
        . / repos / llm - resolver - vessel / node_modules / whatwg - url / README.md
        . / repos / llm - resolver - vessel / node_modules / agentkeepalive / README.md
        . / repos / llm - resolver - vessel / node_modules / function () { } - bind / .github / SECURITY.md
        . / repos / llm - resolver - vessel / node_modules / function () { } - bind / CHANGELOG.md
        . / repos / llm - resolver - vessel / node_modules / function () { } - bind / README.md
        . / repos / llm - resolver - vessel / node_modules / call - bind - apply - helpers / CHANGELOG.md
        . / repos / llm - resolver - vessel / node_modules / call - bind - apply - helpers / README.md
        . / repos / llm - resolver - vessel / node_modules / has - symbols / CHANGELOG.md
        . / repos / llm - resolver - vessel / node_modules / has - symbols / README.md
        . / repos / llm - resolver - vessel / node_modules / es - set - tostringtag / CHANGELOG.md
        . / repos / llm - resolver - vessel / node_modules / es - set - tostringtag / README.md
        . / repos / llm - resolver - vessel / node_modules / delayed - stream / Readme.md
        . / repos / llm - resolver - vessel / node_modules / get - proto / CHANGELOG.md
        . / repos / llm - resolver - vessel / node_modules / get - proto / README.md
        . / repos / llm - resolver - vessel / node_modules / form - data / CHANGELOG.md
        . / repos / llm - resolver - vessel / node_modules / form - data / README.md
        . / repos / llm - resolver - vessel / node_modules / webidl - conversions / README.md
        . / repos / llm - resolver - vessel / node_modules / webidl - conversions / LICENSE.md
        . / repos / human - surface - vessel / node_modules / bun - types / README.md
        . / repos / human - surface - vessel / node_modules / bun - types / docs / README.md
        . / repos / human - surface - vessel / node_modules /  / node / README.md
        . / repos / human - surface - vessel / node_modules /  / bun / README.md
        . / repos / human - surface - vessel / node_modules / hono / README.md
        . / repos / human - surface - vessel / node_modules / typescript / SECURITY.md
        . / repos / human - surface - vessel / node_modules / typescript / README.md
        . / repos / human - surface - vessel / node_modules / undici - types / README.md
        . / repos / human - surface - vessel / ui / README.md
        . / repos / libp2p - federation - transport / node_modules /  / http - parser - js / node_modules / uint8arrays / node_modules / multiformats / README.md
        . / repos / libp2p - federation - transport / node_modules /  / http - parser - js / node_modules / uint8arrays / README.md
        . / repos / libp2p - federation - transport / node_modules /  / http - parser - js / README.md
        . / repos / libp2p - federation - transport / node_modules /  / http - parser - js / LICENSE.md
        . / repos / libp2p - federation - transport / node_modules / supports - color / readme.md
        . / repos / libp2p - federation - transport / node_modules / bun - types / README.md
        . / repos / libp2p - federation - transport / node_modules / bun - types / docs / README.md
        . / repos / libp2p - federation - transport / node_modules / eventemitter3 / README.md
        . / repos / libp2p - federation - transport / node_modules / delay / readme.md
        . / repos / libp2p - federation - transport / node_modules /  / node / README.md
        . / repos / libp2p - federation - transport / node_modules /  / bun / README.md
        . / repos / libp2p - federation - transport / node_modules / uint8arraylist / README.md
        . / repos / libp2p - federation - transport / node_modules / abort - controller / README.md
        . / repos / libp2p - federation - transport / node_modules / uint8 - varint / README.md
        . / repos / libp2p - federation - transport / node_modules / it - parallel / README.md
        . / repos / libp2p - federation - transport / node_modules / weald / README.md
        . / repos / libp2p - federation - transport / node_modules / it - queue / README.md
        . / repos / libp2p - federation - transport / node_modules / p - defer / readme.md
        . / repos / libp2p - federation - transport / node_modules / p - retry / readme.md
        . / repos / libp2p - federation - transport / node_modules / super. - regex / readme.md
        . / repos / libp2p - federation - transport / node_modules / hashlru / README.md
        . / repos / libp2p - federation - transport / node_modules / time - span / readme.md
        . / repos / libp2p - federation - transport / node_modules / any - signal / README.md
        . / repos / libp2p - federation - transport / node_modules / ieee754 / README.md
        . / repos / libp2p - federation - transport / node_modules / it - drain / README.md
        . / repos / libp2p - federation - transport / node_modules / convert - hrtime / readme.md
        . / repos / libp2p - federation - transport / node_modules / unlimited - timeout / readme.md
        . / repos / libp2p - federation - transport / node_modules / clone - regexp / readme.md
        . / repos / libp2p - federation - transport / node_modules / progress - events / README.md
        . / repos / libp2p - federation - transport / node_modules / function () { } - timeout / readme.md
        . / repos / libp2p - federation - transport / node_modules / it - length - prefixed / README.md
        . / repos / libp2p - federation - transport / node_modules / interface - datastore / README.md
        . / repos / libp2p - federation - transport / node_modules / datastore - core / README.md
        . / repos / libp2p - federation - transport / node_modules / p - timeout / readme.md
        . / repos / libp2p - federation - transport / node_modules / main - event / README.md
        . / repos / libp2p - federation - transport / node_modules / cborg / bench / README.md
        . / repos / libp2p - federation - transport / node_modules / cborg / CHANGELOG.md
        . / repos / libp2p - federation - transport / node_modules / cborg / README.md
        . / repos / libp2p - federation - transport / node_modules / string_decoder / README.md
        . / repos / libp2p - federation - transport / node_modules / race - signal / README.md
        . / repos / libp2p - federation - transport / node_modules / abort - error / README.md
        . / repos / libp2p - federation - transport / node_modules / is - electron / README.md
        . / repos / libp2p - federation - transport / node_modules / safe - buffer / README.md
        . / repos / libp2p - federation - transport / node_modules /  / dns - packet / CHANGELOG.md
        . / repos / libp2p - federation - transport / node_modules /  / dns - packet / README.md
        . / repos / libp2p - federation - transport / node_modules / get - iterator / README.md
        . / repos / libp2p - federation - transport / node_modules / multiformats / README.md
        . / repos / libp2p - federation - transport / node_modules / typescript / SECURITY.md
        . / repos / libp2p - federation - transport / node_modules / typescript / README.md
        . / repos / libp2p - federation - transport / node_modules / undici / types / README.md
        . / repos / libp2p - federation - transport / node_modules / undici / lib / web / subresource - integrity / Readme.md
        . / repos / libp2p - federation - transport / node_modules / undici / README.md
        . / repos / libp2p - federation - transport / node_modules / undici / docs / docs / api / GlobalInstallation.md
        . / repos / libp2p - federation - transport / node_modules / undici / docs / docs / api / Socks5ProxyAgent.md
        . / repos / libp2p - federation - transport / node_modules / undici / docs / docs / api / Dispatcher.md
        . / repos / libp2p - federation - transport / node_modules / undici / docs / docs / api / Pool.md
        . / repos / libp2p - federation - transport / node_modules / undici / docs / docs / api / CacheStore.md
        . / repos / libp2p - federation - transport / node_modules / undici / docs / docs / api / Client.md
        . / repos / libp2p - federation - transport / node_modules / undici / docs / docs / api / PoolStats.md
        . / repos / libp2p - federation - transport / node_modules / undici / docs / docs / api / RetryAgent.md
        . / repos / libp2p - federation - transport / node_modules / undici / docs / docs / api / MockCallHistoryLog.md
        . / repos / libp2p - federation - transport / node_modules / undici / docs / docs / api / RetryHandler.md
        . / repos / libp2p - federation - transport / node_modules / undici / docs / docs / api / EnvHttpProxyAgent.md
        . / repos / libp2p - federation - transport / node_modules / undici / docs / docs / api / MockErrors.md
        . / repos / libp2p - federation - transport / node_modules / undici / docs / docs / api / Errors.md
        . / repos / libp2p - federation - transport / node_modules / undici / docs / docs / api / BalancedPool.md
        . / repos / libp2p - federation - transport / node_modules / undici / docs / docs / api / WebSocket.md
        . / repos / libp2p - federation - transport / node_modules / undici / docs / docs / api / Agent.md
        . / repos / libp2p - federation - transport / node_modules / undici / docs / docs / api / Util.md
        . / repos / libp2p - federation - transport / node_modules / undici / docs / docs / api / Fetch.md
        . / repos / libp2p - federation - transport / node_modules / undici / docs / docs / api / SnapshotAgent.md
        . / repos / libp2p - federation - transport / node_modules / undici / docs / docs / api / api - lifecycle.md
        . / repos / libp2p - federation - transport / node_modules / undici / docs / docs / api / ContentType.md
        . / repos / libp2p - federation - transport / node_modules / undici / docs / docs / api / DiagnosticsChannel.md
        . / repos / libp2p - federation - transport / node_modules / undici / docs / docs / api / ClientStats.md
        . / repos / libp2p - federation - transport / node_modules / undici / docs / docs / api / MockClient.md
        . / repos / libp2p - federation - transport / node_modules / undici / docs / docs / api / Debug.md
        . / repos / libp2p - federation - transport / node_modules / undici / docs / docs / api / EventSource.md
        . / repos / libp2p - federation - transport / node_modules / undici / docs / docs / api / RoundRobinPool.md
        . / repos / libp2p - federation - transport / node_modules / undici / docs / docs / api / CacheStorage.md
        . / repos / libp2p - federation - transport / node_modules / undici / docs / docs / api / MockPool.md
        . / repos / libp2p - federation - transport / node_modules / undici / docs / docs / api / RedirectHandler.md
        . / repos / libp2p - federation - transport / node_modules / undici / docs / docs / api / MockAgent.md
        . / repos / libp2p - federation - transport / node_modules / undici / docs / docs / api / ProxyAgent.md
        . / repos / libp2p - federation - transport / node_modules / undici / docs / docs / api / Connector.md
        . / repos / libp2p - federation - transport / node_modules / undici / docs / docs / api / MockCallHistory.md
        . / repos / libp2p - federation - transport / node_modules / undici / docs / docs / api / Cookies.md
        . / repos / libp2p - federation - transport / node_modules / undici / docs / docs / api / H2CClient.md
        . / repos / libp2p - federation - transport / node_modules / undici / docs / docs / best - practices / proxy.md
        . / repos / libp2p - federation - transport / node_modules / undici / docs / docs / best - practices / writing - tests.md
        . / repos / libp2p - federation - transport / node_modules / undici / docs / docs / best - practices / mocking - request.md
        . / repos / libp2p - federation - transport / node_modules / undici / docs / docs / best - practices / client - certificate.md
        . / repos / libp2p - federation - transport / node_modules / undici / docs / docs / best - practices / undici - vs - builtin - fetch.md
        . / repos / libp2p - federation - transport / node_modules / undici / docs / docs / best - practices / migrating - from - v7 - to - v8.md
        . / repos / libp2p - federation - transport / node_modules / undici / docs / docs / best - practices / crawling.md
        . / repos / libp2p - federation - transport / node_modules / undici / docs / docs / GettingStarted.md
        . / repos / libp2p - federation - transport / node_modules /  / multiaddr / README.md
        . / repos / libp2p - federation - transport / node_modules /  / uri - to - multiaddr / README.md
        . / repos / libp2p - federation - transport / node_modules /  / dns / README.md
        . / repos / libp2p - federation - transport / node_modules /  / multiaddr - to - uri / README.md
        . / repos / libp2p - federation - transport / node_modules /  / multiaddr - matcher / README.md
        . / repos / libp2p - federation - transport / node_modules / it - sort / README.md
        . / repos / libp2p - federation - transport / node_modules /  / libp2p - yamux / node_modules / uint8arraylist / node_modules / uint8arrays / node_modules / multiformats / README.md
        . / repos / libp2p - federation - transport / node_modules /  / libp2p - yamux / node_modules / uint8arraylist / node_modules / uint8arrays / README.md
        . / repos / libp2p - federation - transport / node_modules /  / libp2p - yamux / node_modules / uint8arraylist / README.md
        . / repos / libp2p - federation - transport / node_modules /  / libp2p - yamux / README.md
        . / repos / libp2p - federation - transport / node_modules /  / libp2p - noise / node_modules / uint8arraylist / README.md
        . / repos / libp2p - federation - transport / node_modules /  / libp2p - noise / node_modules / uint8arrays / node_modules / multiformats / README.md
        . / repos / libp2p - federation - transport / node_modules /  / libp2p - noise / node_modules / uint8arrays / README.md
        . / repos / libp2p - federation - transport / node_modules /  / libp2p - noise / README.md
        . / repos / libp2p - federation - transport / node_modules /  / as - chacha20poly1305 / README.md
        . / repos / libp2p - federation - transport / node_modules /  / is - ip / CHANGELOG.md
        . / repos / libp2p - federation - transport / node_modules /  / is - ip / README.md
        . / repos / libp2p - federation - transport / node_modules /  / as - sha256 / README.md
        . / repos / libp2p - federation - transport / node_modules /  / netmask / README.md
        . / repos / libp2p - federation - transport / node_modules /  / curves / README.md
        . / repos / libp2p - federation - transport / node_modules /  / ciphers / README.md
        . / repos / libp2p - federation - transport / node_modules /  / hashes / README.md
        . / repos / libp2p - federation - transport / node_modules / it - merge / README.md
        . / repos / libp2p - federation - transport / node_modules / it - queueless - pushable / README.md
        . / repos / libp2p - federation - transport / node_modules / wherearewe / README.md
        . / repos / libp2p - federation - transport / node_modules / protons - runtime / node_modules / uint8arraylist / README.md
        . / repos / libp2p - federation - transport / node_modules / protons - runtime / node_modules / uint8 - varint / README.md
        . / repos / libp2p - federation - transport / node_modules / protons - runtime / node_modules / uint8arrays / node_modules / multiformats / README.md
        . / repos / libp2p - federation - transport / node_modules / protons - runtime / node_modules / uint8arrays / README.md
        . / repos / libp2p - federation - transport / node_modules / protons - runtime / README.md
        . / repos / libp2p - federation - transport / node_modules / ws / README.md
        . / repos / libp2p - federation - transport / node_modules / buffer / AUTHORS.md
        . / repos / libp2p - federation - transport / node_modules / buffer / README.md
        . / repos / libp2p - federation - transport / node_modules / utf8 - codec / README.md
        . / repos / libp2p - federation - transport / node_modules / uint8arrays / README.md
        . / repos / libp2p - federation - transport / node_modules / mortice / README.md
        . / repos / libp2p - federation - transport / node_modules / ms / README.md
        . / repos / libp2p - federation - transport / node_modules / ip - regex / readme.md
        . / repos / libp2p - federation - transport / node_modules / it - reader / README.md
        . / repos / libp2p - federation - transport / node_modules / it - stream - types / README.md
        . / repos / libp2p - federation - transport / node_modules / interface - store / README.md
        . / repos / libp2p - federation - transport / node_modules / it - filter / README.md
        . / repos / libp2p - federation - transport / node_modules / it - map / README.md
        . / repos / libp2p - federation - transport / node_modules / it - pipe / README.md
        . / repos / libp2p - federation - transport / node_modules / is - ip / readme.md
        . / repos / libp2p - federation - transport / node_modules / readable - stream / README.md
        . / repos / libp2p - federation - transport / node_modules / retimeable - signal / README.md
        . / repos / libp2p - federation - transport / node_modules / it - take / README.md
        . / repos / libp2p - federation - transport / node_modules / undici - types / README.md
        . / repos / libp2p - federation - transport / node_modules / it - to - browser - readablestream / README.md
        . / repos / libp2p - federation - transport / node_modules / event - target - shim / README.md
        . / repos / libp2p - federation - transport / node_modules / is - network - error / readme.md
        . / repos / libp2p - federation - transport / node_modules /  / http / README.md
        . / repos / libp2p - federation - transport / node_modules /  / peer - record / node_modules / protons - runtime / README.md
        . / repos / libp2p - federation - transport / node_modules /  / peer - record / README.md
        . / repos / libp2p - federation - transport / node_modules /  / circuit - relay - v2 / node_modules / protons - runtime / README.md
        . / repos / libp2p - federation - transport / node_modules /  / circuit - relay - v2 / README.md
        . / repos / libp2p - federation - transport / node_modules /  / dcutr / node_modules / protons - runtime / README.md
        . / repos / libp2p - federation - transport / node_modules /  / dcutr / README.md
        . / repos / libp2p - federation - transport / node_modules /  / http - peer - id - auth / node_modules / uint8 - varint / node_modules / uint8arraylist / README.md
        . / repos / libp2p - federation - transport / node_modules /  / http - peer - id - auth / node_modules / uint8 - varint / README.md
        . / repos / libp2p - federation - transport / node_modules /  / http - peer - id - auth / node_modules / uint8arrays / node_modules / multiformats / README.md
        . / repos / libp2p - federation - transport / node_modules /  / http - peer - id - auth / node_modules / uint8arrays / README.md
        . / repos / libp2p - federation - transport / node_modules /  / http - peer - id - auth / README.md
        . / repos / libp2p - federation - transport / node_modules /  / identify / node_modules / protons - runtime / README.md
        . / repos / libp2p - federation - transport / node_modules /  / identify / README.md
        . / repos / libp2p - federation - transport / node_modules /  / ping / README.md
        . / repos / libp2p - federation - transport / node_modules /  / utils / README.md
        . / repos / libp2p - federation - transport / node_modules /  / peer - collections / README.md
        . / repos / libp2p - federation - transport / node_modules /  / peer - id / README.md
        . / repos / libp2p - federation - transport / node_modules /  / logger / README.md
        . / repos / libp2p - federation - transport / node_modules /  / http - websocket / node_modules / uint8arrays / node_modules / multiformats / README.md
        . / repos / libp2p - federation - transport / node_modules /  / http - websocket / node_modules / uint8arrays / README.md
        . / repos / libp2p - federation - transport / node_modules /  / http - websocket / README.md
        . / repos / libp2p - federation - transport / node_modules /  / interface / README.md
        . / repos / libp2p - federation - transport / node_modules /  / http - utils / node_modules / uint8arrays / node_modules / multiformats / README.md
        . / repos / libp2p - federation - transport / node_modules /  / http - utils / node_modules / uint8arrays / README.md
        . / repos / libp2p - federation - transport / node_modules /  / http - utils / README.md
        . / repos / libp2p - federation - transport / node_modules /  / http - fetch / node_modules / uint8arrays / node_modules / multiformats / README.md
        . / repos / libp2p - federation - transport / node_modules /  / http - fetch / node_modules / uint8arrays / README.md
        . / repos / libp2p - federation - transport / node_modules /  / http - fetch / README.md
        . / repos / libp2p - federation - transport / node_modules /  / tcp / README.md
        . / repos / libp2p - federation - transport / node_modules /  / websockets / README.md
        . / repos / libp2p - federation - transport / node_modules /  / autonat / node_modules / protons - runtime / README.md
        . / repos / libp2p - federation - transport / node_modules /  / autonat / README.md
        . / repos / libp2p - federation - transport / node_modules /  / crypto / node_modules / protons - runtime / README.md
        . / repos / libp2p - federation - transport / node_modules /  / crypto / README.md
        . / repos / libp2p - federation - transport / node_modules /  / interface - internal / README.md
        . / repos / libp2p - federation - transport / node_modules /  / multistream - select / README.md
        . / repos / libp2p - federation - transport / node_modules /  / peer - store / node_modules / protons - runtime / README.md
        . / repos / libp2p - federation - transport / node_modules /  / peer - store / README.md
        . / repos / libp2p - federation - transport / node_modules / libp2p / README.md
        . / repos / libp2p - federation - transport / node_modules / it - peekable / README.md
        . / repos / libp2p - federation - transport / node_modules / is - loopback - addr / README.md
        . / repos / libp2p - federation - transport / node_modules / events / security.md
        . / repos / libp2p - federation - transport / node_modules / events / History.md
        . / repos / libp2p - federation - transport / node_modules / events / Readme.md
        . / repos / libp2p - federation - transport / node_modules / race - event / README.md
        . / repos / libp2p - federation - transport / node_modules / it - all / README.md
        . / repos / libp2p - federation - transport / node_modules / p - queue / readme.md
        . / repos / libp2p - federation - transport / node_modules / nanoid / README.md
        . / repos / libp2p - federation - transport / node_modules /  / fnv1a / readme.md
        . / repos / libp2p - federation - transport / node_modules / p - event / readme.md
        . / repos / libp2p - federation - transport / node_modules / random - int / readme.md
        . / repos / libp2p - federation - transport / node_modules / process / README.md
        . / repos / libp2p - federation - transport / node_modules / it - pushable / README.md
        . / repos / libp2p - federation - transport / node_modules / base64 - js / README.md
        . / repos / libp2p - federation - transport / node_modules / is - regexp / readme.md
        . / repos / libp2p - federation - transport / node_modules / netmask / CHANGELOG.md
        . / repos / libp2p - federation - transport / node_modules / netmask / README.md
        . / repos / libp2p - federation - transport / node_modules / netmask / LICENSE.md
        . / repos / libp2p - federation - transport / node_modules / cookie / README.md
        . / repos / libp2p - federation - transport / node_modules /  / ip - codec / Readme.md
        . / repos / libp2p - federation - transport / README.md
        . / repos / stateful - ui - vessel / README.md
        . / repos / activity - api / tests / README.md
        . / repos / activity - api / sql / SCHEMA_CONVENTIONS.md
        . / repos / activity - api / sql / migrations / MIGRATION - 60 - SUMMARY.md
        . / repos / activity - api / sql / migrations / .archive / 2026 - 4 - 6 / IMPULSE_DATA_DEPRECATION.md
        . / repos / activity - api / sql / migrations / 58 - register - context - templates.md
        . / repos / activity - api / sql / migrations / 53 - VERIFICATION.md
        . / repos / activity - api / sql / migrations / 60 - TESTING - PLAN.md
        . / repos / activity - api / sql / SCHEMA_REORGANIZATION.md
        . / repos / activity - api / sql / README.md
        . / repos / activity - api / sql / MIGRATION_PHASE2.md
        . / repos / activity - api / node_modules / supports - color / readme.md
        . / repos / activity - api / node_modules / bun - types / node_modules /  / node / node_modules / undici - types / README.md
        . / repos / activity - api / node_modules / bun - types / node_modules /  / node / README.md
        . / repos / activity - api / node_modules / bun - types / README.md
        . / repos / activity - api / node_modules / bun - types / CLAUDE.md
        . / repos / activity - api / node_modules / bun - types / docs / README.md
        . / repos / activity - api / node_modules / standard - as - callback / README.md
        . / repos / activity - api / node_modules / path_1.default - type / readme.md
        . / repos / activity - api / node_modules / es - object - atoms / CHANGELOG.md
        . / repos / activity - api / node_modules / es - object - atoms / README.md
        . / repos / activity - api / node_modules / doctrine / CHANGELOG.md
        . / repos / activity - api / node_modules / doctrine / README.md
        . / repos / activity - api / node_modules / lodash.isarguments / README.md
        . / repos / activity - api / node_modules / es - errors / CHANGELOG.md
        . / repos / activity - api / node_modules / es - errors / README.md
        . / repos / activity - api / node_modules / ajv / README.md
        . / repos / activity - api / node_modules / define - properties / CHANGELOG.md
        . / repos / activity - api / node_modules / define - properties / README.md
        . / repos / activity - api / node_modules / redis - errors / README.md
        . / repos / activity - api / node_modules / onnxruntime - node / README.md
        . / repos / activity - api / node_modules / is - number / README.md
        . / repos / activity - api / node_modules / formdata - node / readme.md
        . / repos / activity - api / node_modules / web - streams - polyfill / README.md
        . / repos / activity - api / node_modules / path_1.default - exists / readme.md
        . / repos / activity - api / node_modules / shebang - command / readme.md
        . / repos / activity - api / node_modules /  / js / README.md
        . / repos / activity - api / node_modules /  / eslintrc / node_modules / ajv / node_modules / json - schema - traverse / README.md
        . / repos / activity - api / node_modules /  / eslintrc / node_modules / ajv / lib / dotjs / README.md
        . / repos / activity - api / node_modules /  / eslintrc / node_modules / ajv / README.md
        . / repos / activity - api / node_modules /  / eslintrc / README.md
        . / repos / activity - api / node_modules / word - wrap / README.md
        . / repos / activity - api / node_modules / zod / README.md
        . / repos / activity - api / node_modules / denque / CHANGELOG.md
        . / repos / activity - api / node_modules / denque / README.md
        . / repos / activity - api / node_modules / punycode / README.md
        . / repos / activity - api / node_modules / ts - api - utils / README.md
        . / repos / activity - api / node_modules / ts - api - utils / LICENSE.md
        . / repos / activity - api / node_modules /  / json - schema / README.md
        . / repos / activity - api / node_modules /  / semver / README.md
        . / repos / activity - api / node_modules /  / node - fetch / node_modules /  / node / node_modules / undici - types / README.md
        . / repos / activity - api / node_modules /  / node - fetch / node_modules /  / node / README.md
        . / repos / activity - api / node_modules /  / node - fetch / README.md
        . / repos / activity - api / node_modules /  / node / README.md
        . / repos / activity - api / node_modules /  / uuid / README.md
        . / repos / activity - api / node_modules /  / bun / README.md
        . / repos / activity - api / node_modules / ioredis / README.md
        . / repos / activity - api / node_modules / abort - controller / README.md
        . / repos / activity - api / node_modules / p - locate / readme.md
        . / repos / activity - api / node_modules / node - gyp - build / SECURITY.md
        . / repos / activity - api / node_modules / node - gyp - build / README.md
        . / repos / activity - api / node_modules / type - check / README.md
        . / repos / activity - api / node_modules /  - eslint / types / README.md
        . / repos / activity - api / node_modules /  - eslint / utils / README.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / README.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - unnecessary - boolean - literal - compare.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - duplicate - ;
    let ;
    (function () {
    })( || ( = {}));
    -values.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / ban - ts - comment.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - ;
    for (- in -array.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / ban - types.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / parameter - properties.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / non - nullable - type - assertion - style.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - unsafe - assignment.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / prefer - namespace - keyword.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / prefer - find.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - useless - template - literals.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / type - annotation - spacing.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / prefer - nullish - coalescing.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / max - params.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / camelcase.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - unused - vars.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / block - spacing.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / init - declarations.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / semi.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / key - spacing.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / prefer - reduce - type - parameter.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / comma - dangle.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / consistent - generic - constructors.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / member - delimiter - style.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - invalid - this.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / unified - signatures.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - inferrable - types.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - base - to - string.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / quotes.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / naming - convention.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - )
        throw -literal.md
            . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / prefer - includes.md
            . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / triple - slash - reference.md
            . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / ;
    switch (-exhaustiveness - check.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - array - constructor.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - this - alias.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - ) {
    }
    var ;
    -requires.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / padding - line - between - statements.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - redundant - type - constituents.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / explicit - member - accessibility.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - implied - eval.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - unused - expressions.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / dot - notation.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - extraneous - class {
    }.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - misused - new.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - unnecessary - type - arguments.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - unnecessary - type - assertion.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / prefer - optional - chain.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / member - ordering.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - unnecessary - qualifier.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / adjacent - overload - signatures.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - extra - non - null - assertion.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - empty - interface.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / ;
    -param - last.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / prefer - ts - expect - error.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / comma - spacing.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / restrict - template - expressions.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - explicit - any.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / consistent - type - imports.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / prefer - function () { } - type.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - unsafe - declaration - merging.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / prefer - ;
    return -this - type.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / prefer - readonly.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - misused - promises.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / require - array - sort - compare.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - confusing - non - null - assertion.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / class {
    } - methods - use - this.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - loss - of - precision.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - duplicate - imports.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / array - type.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - empty - function () { }.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - namespace.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / prefer - regexp - exec.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - invalid - void -type.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - loop - func.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / require - await.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / method - signature - style.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - useless - empty - ;
    md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / prefer - promise - reject - errors.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - type - alias.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / lines - between - class {
    } - members.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / consistent - type - definitions.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / restrict - plus - operands.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - unsafe - member - access.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - unsafe - ;
    (function () {
    })( || ( = {}));
    -comparison.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / sort - type - constituents.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / prefer - destructuring.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - useless - constructor.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - extra - semi.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / typedef.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - shadow.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - ;
    -type - side - effects.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / space - infix - ops.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / func - call - spacing.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - unsafe - unary - minus.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / consistent - type - assertions.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / prefer - as - ;
    const md;
})
    . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / space - before - function () { } - paren.md
    . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - array - delete .md
    . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - non - null - asserted - nullish - coalescing.md
    . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / consistent - indexed - object - style.md
    . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - confusing - void -expression.md
    . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / explicit - function () { } - ;
return -type.md
    . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / README.md
    . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / prefer - string - starts - ends - ;
with (.md
    . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - magic - numbers.md
    . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / await -thenable.md
    . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - mixed - enums.md
    . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / )
    return -await .md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - use - before - define.md
        . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / prefer - ;
var ;
(function () {
})( || ( = {}));
-initializers.md
    . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / class {
} - literal - property - style.md
    . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - dynamic - delete .md
    . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / consistent - type - exports.md
    . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / explicit - module - boundary - types.md
    . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - dupe - class {
} - members.md
    . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / prefer - readonly - parameter - types.md
    . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / lines - around - comment.md
    . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - floating - promises.md
    . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / space - before - blocks.md
    . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / prefer - literal - ;
(function () {
})( || ( = {}));
-member.md
    . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / strict - boolean - expressions.md
    . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - duplicate - type - constituents.md
    . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - meaningless - void -operator.md
    . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - unsafe - ;
return .md
    . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / promise - function () { } - async.md
    . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / brace - style.md
    . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - require - imports.md
    . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / ban - tslint - comment.md
    . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - non - null - assertion.md
    . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - unnecessary - condition.md
    . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - unnecessary - type - constraint.md
    . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / object - curly - spacing.md
    . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - unsafe - call.md
    . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / prefer - ;
for (-of.md
    . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - parameter - properties.md
    . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - restricted - imports.md
    . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - unsafe - argument.md
    . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / TEMPLATE.md
    . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - extra - parens.md
    . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - redeclare.md
    . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / no - non - null - asserted - optional - chain.md
    . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / indent.md
    . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / keyword - spacing.md
    . / repos / activity - api / node_modules /  - eslint / eslint - plugin / docs / rules / unbound - method.md
    . / repos / activity - api / node_modules /  - eslint / scope - manager / README.md
    . / repos / activity - api / node_modules /  - eslint / visitor - keys / README.md
    . / repos / activity - api / node_modules /  - eslint / parser / README.md
    . / repos / activity - api / node_modules /  - eslint / typescript - estree / node_modules / minimatch / node_modules / brace - expansion / README.md
    . / repos / activity - api / node_modules /  - eslint / typescript - estree / node_modules / minimatch / README.md
    . / repos / activity - api / node_modules /  - eslint / typescript - estree / README.md
    . / repos / activity - api / node_modules /  - eslint / type - utils / README.md
    . / repos / activity - api / node_modules / globby / readme.md
    . / repos / activity - api / node_modules / matcher / readme.md
    . / repos / activity - api / node_modules / ignore / README.md
    . / repos / activity - api / node_modules / uuidv7 / CHANGELOG.md
    . / repos / activity - api / node_modules / uuidv7 / README.md
    . / repos / activity - api / node_modules / detect - node / Readme.md
    . / repos / activity - api / node_modules / flat - cache / changelog.md
    . / repos / activity - api / node_modules / flat - cache / README.md
    . / repos / activity - api / node_modules / eslint / node_modules / ajv / node_modules / json - schema - traverse / README.md
    . / repos / activity - api / node_modules / eslint / node_modules / ajv / lib / dotjs / README.md
    . / repos / activity - api / node_modules / eslint / node_modules / ajv / README.md
    . / repos / activity - api / node_modules / eslint / README.md
    . / repos / activity - api / node_modules / semver / README.md
    . / repos / activity - api / node_modules / color - name / README.md
    . / repos / activity - api / node_modules / resolve - from / readme.md
    . / repos / activity - api / node_modules / strip - json - comments / readme.md
    . / repos / activity - api / node_modules / tslib / SECURITY.md
    . / repos / activity - api / node_modules / tslib / README.md
    . / repos / activity - api / node_modules / run - parallel / README.md
    . / repos / activity - api / node_modules / json - schema - traverse / README.md
    . / repos / activity - api / node_modules / object - keys / CHANGELOG.md
    . / repos / activity - api / node_modules / object - keys / README.md
    . / repos / activity - api / node_modules / which / CHANGELOG.md
    . / repos / activity - api / node_modules / which / README.md
    . / repos / activity - api / node_modules / braces / README.md
    . / repos / activity - api / node_modules / brace - expansion / README.md
    . / repos / activity - api / node_modules / strip - ansi / readme.md
    . / repos / activity - api / node_modules / wrappy / README.md
    . / repos / activity - api / node_modules / mime - db / HISTORY.md
    . / repos / activity - api / node_modules / mime - db / README.md
    . / repos / activity - api / node_modules / form - data - encoder / readme.md
    . / repos / activity - api / node_modules / lodash.defaults / README.md
    . / repos / activity - api / node_modules / fast - glob / node_modules / glob - parent / CHANGELOG.md
    . / repos / activity - api / node_modules / fast - glob / node_modules / glob - parent / README.md
    . / repos / activity - api / node_modules / fast - glob / README.md
    . / repos / activity - api / node_modules / prelude - ls / CHANGELOG.md
    . / repos / activity - api / node_modules / prelude - ls / README.md
    . / repos / activity - api / node_modules / math - intrinsics / CHANGELOG.md
    . / repos / activity - api / node_modules / math - intrinsics / README.md
    . / repos / activity - api / node_modules / is - extglob / README.md
    . / repos / activity - api / node_modules / hono / README.md
    . / repos / activity - api / node_modules / fast - uri / README.md
    . / repos / activity - api / node_modules / acorn / CHANGELOG.md
    . / repos / activity - api / node_modules / acorn / README.md
    . / repos / activity - api / node_modules / js - yaml / README.md
    . / repos / activity - api / node_modules / glob - parent / README.md
    . / repos / activity - api / node_modules / dunder - proto / CHANGELOG.md
    . / repos / activity - api / node_modules / dunder - proto / README.md
    . / repos / activity - api / node_modules / natural - compare / README.md
    . / repos / activity - api / node_modules / boolean / CHANGELOG.md
    . / repos / activity - api / node_modules / boolean / README.md
    . / repos / activity - api / node_modules / picomatch / CHANGELOG.md
    . / repos / activity - api / node_modules / picomatch / README.md
    . / repos / activity - api / node_modules /  / fs.stat / README.md
    . / repos / activity - api / node_modules /  / fs.scandir / README.md
    . / repos / activity - api / node_modules /  / fs.walk / README.md
    . / repos / activity - api / node_modules / require - from - string / readme.md
    . / repos / activity - api / node_modules / roarr / README.md
    . / repos / activity - api / node_modules / p - limit / readme.md
    . / repos / activity - api / node_modules / sprintf - js / CONTRIBUTORS.md
    . / repos / activity - api / node_modules / sprintf - js / README.md
    . / repos / activity - api / node_modules / escape - string - regexp / readme.md
    . / repos / activity - api / node_modules / ; ; )
    ;
-fresh / readme.md
    . / repos / activity - api / node_modules / lodash.merge / README.md
    . / repos / activity - api / node_modules / merge2 / README.md
    . / repos / activity - api / node_modules / typescript / SECURITY.md
    . / repos / activity - api / node_modules / typescript / README.md
    . / repos / activity - api / node_modules / .bun - cache / p - locate;
.0;
/readme.md
    . / repos / activity - api / node_modules / .bun - cache / fastq;
.1;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache / fastq;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / node - gyp - build;
.4;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache / node - gyp - build;
.4;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / braces;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / onnxruntime - node;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / roarr;
.4;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / path_1.default - parse;
.7;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / webidl - conversions;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / webidl - conversions;
.1;
/LICENSE.md
    . / repos / activity - api / node_modules / .bun - cache / glob - parent;
.2;
/CHANGELOG.md
    . / repos / activity - api / node_modules / .bun - cache / glob - parent;
.2;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / nanoid;
.6;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / node - addon - api;
.0;
/tools/README.md
    . / repos / activity - api / node_modules / .bun - cache / node - addon - api;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / node - addon - api;
.0;
/LICENSE.md
    . / repos / activity - api / node_modules / .bun - cache / is - core - module;
.1;
/CHANGELOG.md
    . / repos / activity - api / node_modules / .bun - cache / is - core - module;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / mime - db;
.0;
/HISTORY.md
    . / repos / activity - api / node_modules / .bun - cache / mime - db;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / event - target - shim;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / eslintrc;
.4;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / js;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / node - domexception;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / node - domexception;
.0;
/.history/README_20210527214323.md
    . / repos / activity - api / node_modules / .bun - cache / node - domexception;
.0;
/.history/README_20210527213411.md
    . / repos / activity - api / node_modules / .bun - cache / node - domexception;
.0;
/.history/README_20210527213803.md
    . / repos / activity - api / node_modules / .bun - cache / node - domexception;
.0;
/.history/README_20210527213345.md
    . / repos / activity - api / node_modules / .bun - cache / node - domexception;
.0;
/.history/README_20210527203617.md
    . / repos / activity - api / node_modules / .bun - cache / node - domexception;
.0;
/.history/README_20210527212714.md
    . / repos / activity - api / node_modules / .bun - cache / node - domexception;
.0;
/.history/README_20210527214408.md
    . / repos / activity - api / node_modules / .bun - cache / web - streams - polyfill;
.0 - 7;
b1dbbf11ca1d290;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / formdata - node;
.1;
/readme.md
    . / repos / activity - api / node_modules / .bun - cache / combined - stream;
.8;
/Readme.md
    . / repos / activity - api / node_modules / .bun - cache /  / uuid;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / bun;
.10;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / node - fetch;
.13;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / node;
.130;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / json - schema;
.15;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / semver;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / node;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / micromatch;
.8;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / zod;
.76;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / keyv;
.4;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / ts - api - utils;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / ts - api - utils;
.3;
/LICENSE.md
    . / repos / activity - api / node_modules / .bun - cache / shebang - command;
.0;
/readme.md
    . / repos / activity - api / node_modules / .bun - cache / strip - json - comments;
.1;
/readme.md
    . / repos / activity - api / node_modules / .bun - cache / lodash.defaults;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / esquery;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / scope - manager;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / utils;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - unnecessary - boolean - literal - compare.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - duplicate - ;
(function () {
})( || ( = {}));
-values.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / ban - ts - comment.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - ;
for (- in -array.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin)
.0;
/docs/rules / ban - types.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / parameter - properties.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / non - nullable - type - assertion - style.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - unsafe - assignment.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / prefer - namespace - keyword.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / prefer - find.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - useless - template - literals.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / type - annotation - spacing.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / prefer - nullish - coalescing.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / max - params.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / camelcase.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - unused - vars.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / block - spacing.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / init - declarations.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / semi.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / key - spacing.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / prefer - reduce - type - parameter.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / comma - dangle.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / consistent - generic - constructors.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / member - delimiter - style.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - invalid - this.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / unified - signatures.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - inferrable - types.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - base - to - string.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / quotes.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / naming - convention.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - ;
throw -literal.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / prefer - includes.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / triple - slash - reference.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / ;
switch (-exhaustiveness - check.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin) {
}
.0;
/docs/rules / no - array - constructor.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - this - alias.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - ;
var ;
-requires.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / padding - line - between - statements.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - redundant - type - constituents.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / explicit - member - accessibility.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - implied - eval.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - unused - expressions.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / dot - notation.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - extraneous - class {
}.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - misused - new.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - unnecessary - type - arguments.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - unnecessary - type - assertion.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / prefer - optional - chain.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / member - ordering.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - unnecessary - qualifier.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / adjacent - overload - signatures.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - extra - non - null - assertion.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - empty - interface.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / ;
-param - last.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / prefer - ts - expect - error.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / comma - spacing.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / restrict - template - expressions.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - explicit - any.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / consistent - type - imports.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / prefer - function () { } - type.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - unsafe - declaration - merging.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / prefer - ;
return -this - type.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / prefer - readonly.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - misused - promises.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / require - array - sort - compare.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - confusing - non - null - assertion.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / class {
} - methods - use - this.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - loss - of - precision.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - duplicate - imports.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / array - type.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - empty - function () { }.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - namespace.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / prefer - regexp - exec.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - invalid - void -type.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - loop - func.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / require - await .md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / method - signature - style.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - useless - empty - ;
md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / prefer - promise - reject - errors.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - type - alias.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / lines - between - class {
} - members.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / consistent - type - definitions.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / restrict - plus - operands.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - unsafe - member - access.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - unsafe - ;
(function () {
})( || ( = {}));
-comparison.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / sort - type - constituents.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / prefer - destructuring.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - useless - constructor.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - extra - semi.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / typedef.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - shadow.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - ;
-type - side - effects.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / space - infix - ops.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / func - call - spacing.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - unsafe - unary - minus.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / consistent - type - assertions.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / prefer - as - ;
const md;
/repos/activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / space - before - function () { } - paren.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - array - delete .md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - non - null - asserted - nullish - coalescing.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / consistent - indexed - object - style.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - confusing - void -expression.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / explicit - function () { } - ;
return -type.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / README.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / prefer - string - starts - ends - ;
with (.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin)
.0;
/docs/rules / no - magic - numbers.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / await -thenable.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - mixed - enums.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / ;
return -await .md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - use - before - define.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / prefer - ;
(function () {
})( || ( = {}));
-initializers.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / class {
} - literal - property - style.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - dynamic - delete .md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / consistent - type - exports.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / explicit - module - boundary - types.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - dupe - class {
} - members.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / prefer - readonly - parameter - types.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / lines - around - comment.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - floating - promises.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / space - before - blocks.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / prefer - literal - ;
(function () {
})( || ( = {}));
-member.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / strict - boolean - expressions.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - duplicate - type - constituents.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - meaningless - void -operator.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - unsafe - ;
return .md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / promise - function () { } - async.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / brace - style.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - require - imports.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / ban - tslint - comment.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - non - null - assertion.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - unnecessary - condition.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - unnecessary - type - constraint.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / object - curly - spacing.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - unsafe - call.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / prefer - ;
for (-of.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin; ; .0)
/docs/rules / no - parameter - properties.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - restricted - imports.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - unsafe - argument.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / TEMPLATE.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - extra - parens.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - redeclare.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / no - non - null - asserted - optional - chain.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / indent.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / keyword - spacing.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / eslint - plugin;
.0;
/docs/rules / unbound - method.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / types;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / parser;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / typescript - estree;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / type - utils;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  - eslint / visitor - keys;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / dunder - proto;
.1;
/CHANGELOG.md
    . / repos / activity - api / node_modules / .bun - cache / dunder - proto;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / globalthis;
.4;
/CHANGELOG.md
    . / repos / activity - api / node_modules / .bun - cache / globalthis;
.4;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / strip - ansi;
.1;
/readme.md
    . / repos / activity - api / node_modules / .bun - cache / math - intrinsics;
.0;
/CHANGELOG.md
    . / repos / activity - api / node_modules / .bun - cache / math - intrinsics;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / glob;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / locate - path_1.default;
.0;
/readme.md
    . / repos / activity - api / node_modules / .bun - cache / json - schema - traverse;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / supports - preserve - symlinks - flag;
.0;
/CHANGELOG.md
    . / repos / activity - api / node_modules / .bun - cache / supports - preserve - symlinks - flag;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / lodash.isarguments;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / flat - cache;
.0;
/changelog.md
    . / repos / activity - api / node_modules / .bun - cache / flat - cache;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / asynckit;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / balanced - match;
.2;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / balanced - match;
.2;
/LICENSE.md
    . / repos / activity - api / node_modules / .bun - cache / hasown;
.2;
/CHANGELOG.md
    . / repos / activity - api / node_modules / .bun - cache / hasown;
.2;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / has - flag;
.0;
/readme.md
    . / repos / activity - api / node_modules / .bun - cache / fast - levenshtein;
.6;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / fast - levenshtein;
.6;
/LICENSE.md
    . / repos / activity - api / node_modules / .bun - cache / inflight;
.6;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / js - yaml;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / path_1.default - exists;
.0;
/readme.md
    . / repos / activity - api / node_modules / .bun - cache / ajv;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / type - fest;
.2;
/readme.md
    . / repos / activity - api / node_modules / .bun - cache / form - data - encoder;
.2;
/readme.md
    . / repos / activity - api / node_modules / .bun - cache / ioredis;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / cross - spawn;
.6;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / call - bind - apply - helpers;
.2;
/CHANGELOG.md
    . / repos / activity - api / node_modules / .bun - cache / call - bind - apply - helpers;
.2;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / espree;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / resolve;
.11;
/.github/INCIDENT_RESPONSE_PROCESS.md
    . / repos / activity - api / node_modules / .bun - cache / resolve;
.11;
/.github/THREAT_MODEL.md
    . / repos / activity - api / node_modules / .bun - cache / resolve;
.11;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache / jose;
.2;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / jose;
.2;
/LICENSE.md
    . / repos / activity - api / node_modules / .bun - cache / adm - zip;
.17;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / brace - expansion;
.2;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / yocto - queue;
.0;
/readme.md
    . / repos / activity - api / node_modules / .bun - cache / acorn - jsx;
.2;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / fs.stat;
.5;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / fs.walk;
.8;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / fs.scandir;
.5;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / delayed - stream;
.0;
/Readme.md
    . / repos / activity - api / node_modules / .bun - cache / flatted;
.1;
/golang/README.md
    . / repos / activity - api / node_modules / .bun - cache / flatted;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / to - regex - range;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / path_1.default - is - absolute;
.1;
/readme.md
    . / repos / activity - api / node_modules / .bun - cache / debug;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / is - number;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / doctrine;
.0;
/CHANGELOG.md
    . / repos / activity - api / node_modules / .bun - cache / doctrine;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / has - property - descriptors;
.2;
/CHANGELOG.md
    . / repos / activity - api / node_modules / .bun - cache / has - property - descriptors;
.2;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / p - limit;
.0;
/readme.md
    . / repos / activity - api / node_modules / .bun - cache / once;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / merge2;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / fast - json - stable - stringify;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / config - array;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / module - importer;
.1;
/CHANGELOG.md
    . / repos / activity - api / node_modules / .bun - cache /  / module - importer;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / object - schema;
.3;
/CHANGELOG.md
    . / repos / activity - api / node_modules / .bun - cache /  / object - schema;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  - ai / sdk;
.3;
/src/_vendor / partial - json - parser / README.md
    . / repos / activity - api / node_modules / .bun - cache /  - ai / sdk;
.3;
/src/_shims / README.md
    . / repos / activity - api / node_modules / .bun - cache /  - ai / sdk;
.3;
/CHANGELOG.md
    . / repos / activity - api / node_modules / .bun - cache /  - ai / sdk;
.3;
/_shims/README.md
    . / repos / activity - api / node_modules / .bun - cache /  - ai / sdk;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / detect - node;
.0;
/Readme.md
    . / repos / activity - api / node_modules / .bun - cache / abort - controller;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / escape - string - regexp;
.0;
/readme.md
    . / repos / activity - api / node_modules / .bun - cache / typescript;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache / typescript;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / resolve - from;
.0;
/readme.md
    . / repos / activity - api / node_modules / .bun - cache / color - name;
.4;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / fast - glob;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / mime - types;
.35;
/HISTORY.md
    . / repos / activity - api / node_modules / .bun - cache / mime - types;
.35;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / natural - compare;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / supports - color;
.0;
/readme.md
    . / repos / activity - api / node_modules / .bun - cache / imurmurhash;
.4;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / ansi - regex;
.1;
/readme.md
    . / repos / activity - api / node_modules / .bun - cache / esutils;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / chalk;
.2;
/readme.md
    . / repos / activity - api / node_modules / .bun - cache / type - fest;
.1;
/readme.md
    . / repos / activity - api / node_modules / .bun - cache / gopd;
.0;
/CHANGELOG.md
    . / repos / activity - api / node_modules / .bun - cache / gopd;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / fill - range;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / rimraf;
.2;
/CHANGELOG.md
    . / repos / activity - api / node_modules / .bun - cache / rimraf;
.2;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / slash;
.0;
/readme.md
    . / repos / activity - api / node_modules / .bun - cache / argon2;
.1;
/argon2/CHANGELOG.md
    . / repos / activity - api / node_modules / .bun - cache / argon2;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / wrappy;
.2;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / format;
.0;
/readme.md
    . / repos / activity - api / node_modules / .bun - cache / run - parallel;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / levn;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / get - intrinsic;
.0;
/CHANGELOG.md
    . / repos / activity - api / node_modules / .bun - cache / get - intrinsic;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / commands;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / color - convert;
.1;
/CHANGELOG.md
    . / repos / activity - api / node_modules / .bun - cache / color - convert;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / minimatch;
.5;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / argparse;
.1;
/CHANGELOG.md
    . / repos / activity - api / node_modules / .bun - cache / argparse;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / matcher;
.0;
/readme.md
    . / repos / activity - api / node_modules / .bun - cache / uri - js;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / denque;
.0;
/CHANGELOG.md
    . / repos / activity - api / node_modules / .bun - cache / denque;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / node - fetch;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / node - fetch;
.0;
/LICENSE.md
    . / repos / activity - api / node_modules / .bun - cache / queue - microtask;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / optionator;
.4;
/CHANGELOG.md
    . / repos / activity - api / node_modules / .bun - cache / optionator;
.4;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / globals;
.0;
/readme.md
    . / repos / activity - api / node_modules / .bun - cache / has - symbols;
.0;
/CHANGELOG.md
    . / repos / activity - api / node_modules / .bun - cache / has - symbols;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / global - agent;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / agentkeepalive;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / is - glob;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / ;
-fresh;
.1;
/readme.md
    . / repos / activity - api / node_modules / .bun - cache / object - keys;
.1;
/CHANGELOG.md
    . / repos / activity - api / node_modules / .bun - cache / object - keys;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / whatwg - url;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / reusify;
.0;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache / reusify;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / function () { } - bind;
.2;
/.github/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache / function () { } - bind;
.2;
/CHANGELOG.md
    . / repos / activity - api / node_modules / .bun - cache / function () { } - bind;
.2;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / has - tostringtag;
.2;
/CHANGELOG.md
    . / repos / activity - api / node_modules / .bun - cache / has - tostringtag;
.2;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / file - entry - cache;
.1;
/changelog.md
    . / repos / activity - api / node_modules / .bun - cache / file - entry - cache;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / estraverse;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / redis - errors;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / get - proto;
.1;
/CHANGELOG.md
    . / repos / activity - api / node_modules / .bun - cache / get - proto;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / which;
.2;
/CHANGELOG.md
    . / repos / activity - api / node_modules / .bun - cache / which;
.2;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / type - check;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / json - stringify - safe;
.1;
/CHANGELOG.md
    . / repos / activity - api / node_modules / .bun - cache / json - stringify - safe;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / graphemer;
.0;
/CHANGELOG.md
    . / repos / activity - api / node_modules / .bun - cache / graphemer;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / fast - deep - equal;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / require - from - string;
.2;
/readme.md
    . / repos / activity - api / node_modules / .bun - cache /  / structured - clone;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / ms;
.0;
/readme.md
    . / repos / activity - api / node_modules / .bun - cache / ms;
.0;
/license.md
    . / repos / activity - api / node_modules / .bun - cache / array - union;
.0;
/readme.md
    . / repos / activity - api / node_modules / .bun - cache / uuidv7;
.0;
/CHANGELOG.md
    . / repos / activity - api / node_modules / .bun - cache / uuidv7;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / fs.realpath;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / tslib;
.1;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache / tslib;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / undici - types;
.5;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / acorn;
.0;
/CHANGELOG.md
    . / repos / activity - api / node_modules / .bun - cache / acorn;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / es - object - atoms;
.1;
/CHANGELOG.md
    . / repos / activity - api / node_modules / .bun - cache / es - object - atoms;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / standard - as - callback;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / fast - uri;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / ansi - styles;
.0;
/readme.md
    . / repos / activity - api / node_modules / .bun - cache / dir - glob;
.1;
/readme.md
    . / repos / activity - api / node_modules / .bun - cache / shebang - regex;
.0;
/readme.md
    . / repos / activity - api / node_modules / .bun - cache / is - extglob;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / bun - types;
.10;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / bun - types;
.10;
/CLAUDE.md
    . / repos / activity - api / node_modules / .bun - cache / bun - types;
.10;
/docs/README.md
    . / repos / activity - api / node_modules / .bun - cache / word - wrap;
.5;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / json - buffer;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / prettier;
.1;
/THIRD-PARTY-NOTICES.md
    . / repos / activity - api / node_modules / .bun - cache / prettier;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / eslint - visitor - keys;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / debug;
.9;
/CHANGELOG.md
    . / repos / activity - api / node_modules / .bun - cache / debug;
.9;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / find - up;
.0;
/readme.md
    . / repos / activity - api / node_modules / .bun - cache / picomatch;
.1;
/CHANGELOG.md
    . / repos / activity - api / node_modules / .bun - cache / picomatch;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / lodash.merge;
.2;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / esrecurse;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / globby;
.0;
/readme.md
    . / repos / activity - api / node_modules / .bun - cache /  - community / eslint - utils;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  - community / regexpp;
.2;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / cluster - key - slot;
.2;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / isexe;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / eslint;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / semver;
.4;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / ignore;
.2;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / undici - types;
.2;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - float64array;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - float64array;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / complex - float64 - ctor;
.2;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / complex - float64 - ctor;
.2;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / math - base - special - absf;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / math - base - special - absf;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / math - base - special - trunc;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / math - base - special - trunc;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - typed - array;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - typed - array;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / number - float16 - ctor;
.2;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / number - float16 - ctor;
.2;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / napi - create - int32;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / napi - create - int32;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - integer;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - integer;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / number - float64 - base - get - high - word;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / number - float64 - base - get - high - word;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / array - complex64;
.2;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / array - complex64;
.2;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - positive - number;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - positive - number;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - tools - array - function () { };
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - tools - array - function () { };
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - function () { };
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - function () { };
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / utils - define - nonenumerable - read - only - property;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / utils - define - nonenumerable - read - only - property;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float32 - pinf;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float32 - pinf;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / os - byte - order;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / os - byte - order;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / string - replace;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / string - replace;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float64 - high - word - sign - mask;
.1;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float64 - high - word - sign - mask;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - big - endian;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - big - endian;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / utils - property - symbols;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / utils - property - symbols;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / complex - float32 - reim;
.4;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / complex - float32 - reim;
.4;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / complex - float32 - real;
.2;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / complex - float32 - real;
.2;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / number - float64 - base - normalize;
.4;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / number - float64 - base - normalize;
.4;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - regexp;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - regexp;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - array - max - array - length;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - array - max - array - length;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / random - base - beta;
.2;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / random - base - beta;
.2;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / napi - argv - int32;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / napi - argv - int32;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - has - own - property;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - has - own - property;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - napi - equal - types;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - napi - equal - types;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / array - complex128;
.2;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / array - complex128;
.2;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / number - float64 - base - to - float32;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / number - float64 - base - to - float32;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / math - base - special - ceil;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / math - base - special - ceil;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / blas - base - gcopy;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / blas - base - gcopy;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float64 - num - high - word - significand - bits;
.1;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float64 - num - high - word - significand - bits;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / string - base - format - tokenize;
.4;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / string - base - format - tokenize;
.4;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / math - base - special - copysign;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / math - base - special - copysign;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / array - base - assert - is - complex64array;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / array - base - assert - is - complex64array;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - has - iterator - symbol - support;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - has - iterator - symbol - support;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / array - float32;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / array - float32;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / math - base - special - pow;
.1;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / math - base - special - pow;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / string - base - lowercase;
.1;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / string - base - lowercase;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - has - int16array - support;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - has - int16array - support;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / number - float64 - base - from - words;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / number - float64 - base - from - words;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - int8 - max;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - int8 - max;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / regexp - function () { } - name;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / regexp - function () { } - name;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / random - base - mt19937;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / random - base - mt19937;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - has - int8array - support;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - has - int8array - support;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / os - float - word - order;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / os - float - word - order;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - instance - of;
.1;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - instance - of;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / string - base - replace;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / string - base - replace;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / complex - float64 - reim;
.4;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / complex - float64 - reim;
.4;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / array - float64;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / array - float64;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / fs - resolve - parent - path_1.default;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / fs - resolve - parent - path_1.default;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float16 - eps;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float16 - eps;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / random - base - improved - ziggurat;
.2;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / random - base - improved - ziggurat;
.2;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / number - float64 - base - to - float16;
.2;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / number - float64 - base - to - float16;
.2;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / regexp - extended - length - path_1.default;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / regexp - extended - length - path_1.default;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / strided - base - reinterpret - complex64;
.2;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / strided - base - reinterpret - complex64;
.2;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / number - uint32 - base - to - int32;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / number - uint32 - base - to - int32;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - has - tostringtag - support;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - has - tostringtag - support;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / number - float16 - base - to - float32;
.2;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / number - float16 - base - to - float32;
.2;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / number - float64 - base - set - low - word;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / number - float64 - base - set - low - word;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float16 - max;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float16 - max;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - int8array;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - int8array;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - has - uint8clampedarray - support;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - has - uint8clampedarray - support;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / array - bool;
.2;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / array - bool;
.2;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float64 - high - word - significand - mask;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float64 - high - word - significand - mask;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - int16 - min;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - int16 - min;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float64 - max - safe - integer;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float64 - max - safe - integer;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - has - uint32array - support;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - has - uint32array - support;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / utils - type - of;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / utils - type - of;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - has - uint16array - support;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - has - uint16array - support;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / array - uint16;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / array - uint16;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - int8 - min;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - int8 - min;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - object;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - object;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / number - float32 - base - to - float16;
.1;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / number - float32 - base - to - float16;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - napi - is - type;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - napi - is - type;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float32 - significand - mask;
.4;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float32 - significand - mask;
.4;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - int32array;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - int32array;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / utils - get - prototype - of;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / utils - get - prototype - of;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / utils - enumerable - properties;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / utils - enumerable - properties;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float64 - ln - two;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float64 - ln - two;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / array - to - json;
.1;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / array - to - json;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / array - int16;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / array - int16;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float32 - sign - mask;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float32 - sign - mask;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - uint32 - max;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - uint32 - max;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float64 - smallest - normal;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float64 - smallest - normal;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / array - uint8;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / array - uint8;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - complex - typed - array;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - complex - typed - array;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / math - base - assert - is - nanf;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / math - base - assert - is - nanf;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / napi - argv;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / napi - argv;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - boolean;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - boolean;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / utils - function () { } - name;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / utils - function () { } - name;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - int32 - max;
.1;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - int32 - max;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - plain - object;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - plain - object;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / array - base - assert - is - accessor - array;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / array - base - assert - is - accessor - array;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float32 - exponent - mask;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float32 - exponent - mask;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - positive - integer;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - positive - integer;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / object - assign;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / object - assign;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / math - base - assert - is - finite;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / math - base - assert - is - finite;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / math - base - assert - is - positive - zero;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / math - base - assert - is - positive - zero;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - object - like;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - object - like;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / utils - define - read - only - property;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / utils - define - read - only - property;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - nonnegative - integer;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - nonnegative - integer;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / complex - float32 - ctor;
.1;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / complex - float32 - ctor;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / math - base - special - max;
.1;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / math - base - special - max;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / array - base - getter;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / array - base - getter;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / strided - base - reinterpret - boolean;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / strided - base - reinterpret - boolean;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float16 - smallest - normal;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float16 - smallest - normal;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / symbol - to - primitive;
.2;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / symbol - to - primitive;
.2;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float64 - eps;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float64 - eps;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - has - function () { } - name - support;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - has - function () { } - name - support;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - number;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - number;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float64 - high - word - abs - mask;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float64 - high - word - abs - mask;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / complex - float64 - real;
.2;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / complex - float64 - real;
.2;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - array - max - typed - array - length;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - array - max - typed - array - length;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / error - tools - fmtprodmsg;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / error - tools - fmtprodmsg;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float32 - abs - mask;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float32 - abs - mask;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / utils - escape - regexp - string;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / utils - escape - regexp - string;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / types;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / types;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / object - ctor;
.2;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / object - ctor;
.2;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / math - base - napi - unary;
.7;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / math - base - napi - unary;
.7;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / random - base - shared;
.2;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / random - base - shared;
.2;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - nan;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - nan;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - uint32array;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - uint32array;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - int16array;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - int16array;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float32 - exponent - bias;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float32 - exponent - bias;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / math - base - assert - is - finitef;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / math - base - assert - is - finitef;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / utils - index - of;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / utils - index - of;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / utils - define - nonenumerable - read - only - accessor;
.4;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / utils - define - nonenumerable - read - only - accessor;
.4;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / math - base - special - floor;
.4;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / math - base - special - floor;
.4;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - uint8 - max;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - uint8 - max;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float32 - ninf;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float32 - ninf;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / math - base - special - ldexp;
.5;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / math - base - special - ldexp;
.5;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - array;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - array;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float64 - max - base2 - exponent;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float64 - max - base2 - exponent;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / strided - base - reinterpret - complex128;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / strided - base - reinterpret - complex128;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / number - float64 - base - set - high - word;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / number - float64 - base - set - high - word;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float16 - significand - mask;
.1;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float16 - significand - mask;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float64 - pinf;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float64 - pinf;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / number - ctor;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / number - ctor;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float64 - high - word - exponent - mask;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float64 - high - word - exponent - mask;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - uint8array;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - uint8array;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / string - format;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / string - format;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / utils - library - manifest;
.4;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / utils - library - manifest;
.4;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - has - float32array - support;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - has - float32array - support;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / process - cwd;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / process - cwd;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / utils - define - nonenumerable - read - write - accessor;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / utils - define - nonenumerable - read - write - accessor;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / array - base - assert - is - complex128array;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / array - base - assert - is - complex128array;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / math - base - assert - is - even;
.5;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / math - base - assert - is - even;
.5;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float64 - ninf;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float64 - ninf;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / napi - ;
.1;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / napi - ;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / number - float64 - base - to - words;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / number - float64 - base - to - words;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - uint16 - max;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - uint16 - max;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float32 - eps;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float32 - eps;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / utils - convert - path_1.default;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / utils - convert - path_1.default;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - has - has - instance - symbol - support;
.1;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - has - has - instance - symbol - support;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float64 - min - base2 - exponent - subnormal;
.1;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float64 - min - base2 - exponent - subnormal;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / math - base - assert - is - integer;
.7;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / math - base - assert - is - integer;
.7;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / utils - noop;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / utils - noop;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / utils - constructor - name;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / utils - constructor - name;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / boolean - ctor;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / boolean - ctor;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - enumerable - property;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - enumerable - property;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - collection;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - collection;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / array - int32;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / array - int32;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / math - base - special - exp;
.5;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / math - base - special - exp;
.5;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float32 - num - significand - bits;
.1;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float32 - num - significand - bits;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / symbol - iterator;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / symbol - iterator;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / math - base - assert - is - odd;
.2;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / math - base - assert - is - odd;
.2;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / number - float16 - base - to - float64;
.2;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / number - float16 - base - to - float64;
.2;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - has - to - primitive - symbol - support;
.1;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - has - to - primitive - symbol - support;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - uint8clampedarray;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - uint8clampedarray;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / symbol - ctor;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / symbol - ctor;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float64 - exponent - bias;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float64 - exponent - bias;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - has - float64array - support;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - has - float64array - support;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / utils - global;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / utils - global;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - float32array;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - float32array;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - array - like - object;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - array - like - object;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float16 - sign - mask;
.1;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float16 - sign - mask;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / number - uint32 - base - mul;
.1;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / number - uint32 - base - mul;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - napi - status - ok;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - napi - status - ok;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / napi - argv - float;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / napi - argv - float;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - has - uint8array - support;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - has - uint8array - support;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - little - endian;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - little - endian;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / array - base - setter;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / array - base - setter;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / array - uint32;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / array - uint32;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / string - base - format - interpolate;
.4;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / string - base - format - interpolate;
.4;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / array - int8;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / array - int8;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / math - base - napi - binary;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / math - base - napi - binary;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - has - symbol - support;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - has - symbol - support;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / math - base - special - abs;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / math - base - special - abs;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - arguments;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - arguments;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / array - base - accessor - setter;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / array - base - accessor - setter;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / math - base - special - sqrt;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / math - base - special - sqrt;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - complex - like;
.4;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - complex - like;
.4;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float16 - num - significand - bits;
.2;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float16 - num - significand - bits;
.2;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / math - base - special - ln;
.5;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / math - base - special - ln;
.5;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / complex - float64 - imag;
.2;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / complex - float64 - imag;
.2;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / array - uint8c;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / array - uint8c;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - string;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - string;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - booleanarray;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - booleanarray;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - string - array;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - string - array;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / utils - keys;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / utils - keys;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / math - base - assert - is - infinite;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / math - base - assert - is - infinite;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / math - base - assert - is - nan;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / math - base - assert - is - nan;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / array - base - accessor - getter;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / array - base - accessor - getter;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / array - base - arraylike2object;
.2;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / array - base - arraylike2object;
.2;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / napi - argv - double;
.2;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / napi - argv - double;
.2;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float16 - exponent - mask;
.1;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float16 - exponent - mask;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - int16 - max;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - int16 - max;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / array - dtype;
.1;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / array - dtype;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - uint16array;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - uint16array;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - arraybuffer;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - arraybuffer;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / number - float32 - base - to - word;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / number - float32 - base - to - word;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / number - float64 - base - exponent;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / number - float64 - base - exponent;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / complex - float32 - imag;
.2;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / complex - float32 - imag;
.2;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / utils - native - class {
};
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / utils - native - class {
};
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float64 - max - base2 - exponent - subnormal;
.1;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float64 - max - base2 - exponent - subnormal;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float16 - exponent - bias;
.1;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - float16 - exponent - bias;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / utils - constant - function () { };
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / utils - constant - function () { };
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - int32 - min;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / constants - int32 - min;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - buffer;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - is - buffer;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / symbol - has - instance;
.1;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / symbol - has - instance;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / fs - exists;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / fs - exists;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / number - float32 - base - exponent;
.4;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / number - float32 - base - exponent;
.4;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / utils - define - property;
.5;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / utils - define - property;
.5;
/README.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - has - int32array - support;
.3;
/SECURITY.md
    . / repos / activity - api / node_modules / .bun - cache /  / assert - has - int32array - support;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / es - errors;
.0;
/CHANGELOG.md
    . / repos / activity - api / node_modules / .bun - cache / es - errors;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / ajv;
.0;
/lib/dotjs / README.md
    . / repos / activity - api / node_modules / .bun - cache / ajv;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / path_1.default - type;
.0;
/readme.md
    . / repos / activity - api / node_modules / .bun - cache / eslint - scope;
.2;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / brace - expansion;
.12;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / humanize - ms;
.1;
/History.md
    . / repos / activity - api / node_modules / .bun - cache / humanize - ms;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / prelude - ls;
.1;
/CHANGELOG.md
    . / repos / activity - api / node_modules / .bun - cache / prelude - ls;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / redis - parser;
.0;
/changelog.md
    . / repos / activity - api / node_modules / .bun - cache / redis - parser;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / hono;
.8;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / path_1.default - key;
.1;
/readme.md
    . / repos / activity - api / node_modules / .bun - cache / serialize - error;
.1;
/readme.md
    . / repos / activity - api / node_modules / .bun - cache / punycode;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / glob - parent;
.2;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / define - data - property;
.4;
/CHANGELOG.md
    . / repos / activity - api / node_modules / .bun - cache / define - data - property;
.4;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / minimatch;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / define - properties;
.1;
/CHANGELOG.md
    . / repos / activity - api / node_modules / .bun - cache / define - properties;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / callsites;
.0;
/readme.md
    . / repos / activity - api / node_modules / .bun - cache / is - path_1.default - inside;
.3;
/readme.md
    . / repos / activity - api / node_modules / .bun - cache / es - define - property;
.1;
/CHANGELOG.md
    . / repos / activity - api / node_modules / .bun - cache / es - define - property;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / es6 - error;
.1;
/CHANGELOG.md
    . / repos / activity - api / node_modules / .bun - cache / es6 - error;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / es6 - error;
.1;
/LICENSE.md
    . / repos / activity - api / node_modules / .bun - cache / inherits;
.4;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / uuid;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / uuid;
.0;
/LICENSE.md
    . / repos / activity - api / node_modules / .bun - cache / sprintf - js;
.3;
/CONTRIBUTORS.md
    . / repos / activity - api / node_modules / .bun - cache / sprintf - js;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / onnxruntime - common;
.3;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / form - data;
.5;
/CHANGELOG.md
    . / repos / activity - api / node_modules / .bun - cache / form - data;
.5;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / ms;
.3;
/readme.md
    . / repos / activity - api / node_modules / .bun - cache / ms;
.3;
/license.md
    . / repos / activity - api / node_modules / .bun - cache / boolean;
.0;
/CHANGELOG.md
    . / repos / activity - api / node_modules / .bun - cache / boolean;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / json - schema - traverse;
.1;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / es - set - tostringtag;
.0;
/CHANGELOG.md
    . / repos / activity - api / node_modules / .bun - cache / es - set - tostringtag;
.0;
/README.md
    . / repos / activity - api / node_modules / .bun - cache / parent - module;
.1;
/readme.md
    . / repos / activity - api / node_modules / globalthis / CHANGELOG.md
    . / repos / activity - api / node_modules / globalthis / README.md
    . / repos / activity - api / node_modules / reusify / SECURITY.md
    . / repos / activity - api / node_modules / reusify / README.md
    . / repos / activity - api / node_modules /  / config - array / README.md
    . / repos / activity - api / node_modules /  / module - importer / CHANGELOG.md
    . / repos / activity - api / node_modules /  / module - importer / README.md
    . / repos / activity - api / node_modules /  / object - schema / CHANGELOG.md
    . / repos / activity - api / node_modules /  / object - schema / README.md
    . / repos / activity - api / node_modules / fast - deep - equal / README.md
    . / repos / activity - api / node_modules / cross - spawn / README.md
    . / repos / activity - api / node_modules / define - data - property / CHANGELOG.md
    . / repos / activity - api / node_modules / define - data - property / README.md
    . / repos / activity - api / node_modules /  - ai / sdk / src / _vendor / partial - json - parser / README.md
    . / repos / activity - api / node_modules /  - ai / sdk / src / _shims / README.md
    . / repos / activity - api / node_modules /  - ai / sdk / CHANGELOG.md
    . / repos / activity - api / node_modules /  - ai / sdk / _shims / README.md
    . / repos / activity - api / node_modules /  - ai / sdk / README.md
    . / repos / activity - api / node_modules / fast - json - stable - stringify / README.md
    . / repos / activity - api / node_modules / prettier / THIRD - PARTY - NOTICES.md
    . / repos / activity - api / node_modules / prettier / README.md
    . / repos / activity - api / node_modules / has - flag / readme.md
    . / repos / activity - api / node_modules / node - fetch / README.md
    . / repos / activity - api / node_modules / node - fetch / LICENSE.md
    . / repos / activity - api / node_modules / mime - types / HISTORY.md
    . / repos / activity - api / node_modules / mime - types / README.md
    . / repos / activity - api / node_modules / node - domexception / README.md
    . / repos / activity - api / node_modules / node - domexception / .history / README_20210527214323.md
    . / repos / activity - api / node_modules / node - domexception / .history / README_20210527213411.md
    . / repos / activity - api / node_modules / node - domexception / .history / README_20210527213803.md
    . / repos / activity - api / node_modules / node - domexception / .history / README_20210527213345.md
    . / repos / activity - api / node_modules / node - domexception / .history / README_20210527203617.md
    . / repos / activity - api / node_modules / node - domexception / .history / README_20210527212714.md
    . / repos / activity - api / node_modules / node - domexception / .history / README_20210527214408.md
    . / repos / activity - api / node_modules / micromatch / README.md
    . / repos / activity - api / node_modules / ansi - regex / readme.md
    . / repos / activity - api / node_modules / debug / README.md
    . / repos / activity - api / node_modules / resolve / .github / INCIDENT_RESPONSE_PROCESS.md
    . / repos / activity - api / node_modules / resolve / .github / THREAT_MODEL.md
    . / repos / activity - api / node_modules / resolve / SECURITY.md
    . / repos / activity - api / node_modules / rimraf / CHANGELOG.md
    . / repos / activity - api / node_modules / rimraf / README.md
    . / repos / activity - api / node_modules / is - glob / README.md
    . / repos / activity - api / node_modules / eslint - scope / README.md
    . / repos / activity - api / node_modules / uri - js / README.md
    . / repos / activity - api / node_modules / eslint - visitor - keys / README.md
    . / repos / activity - api / node_modules / json - buffer / README.md
    . / repos / activity - api / node_modules /  / format / readme.md
    . / repos / activity - api / node_modules / flatted / golang / README.md
    . / repos / activity - api / node_modules / flatted / README.md
    . / repos / activity - api / node_modules / find - up / readme.md
    . / repos / activity - api / node_modules / has - property - descriptors / CHANGELOG.md
    . / repos / activity - api / node_modules / has - property - descriptors / README.md
    . / repos / activity - api / node_modules /  / commands / README.md
    . / repos / activity - api / node_modules / combined - stream / Readme.md
    . / repos / activity - api / node_modules / humanize - ms / History.md
    . / repos / activity - api / node_modules / humanize - ms / README.md
    . / repos / activity - api / node_modules / ms / readme.md
    . / repos / activity - api / node_modules / ms / license.md
    . / repos / activity - api / node_modules / hasown / CHANGELOG.md
    . / repos / activity - api / node_modules / hasown / README.md
    . / repos / activity - api / node_modules / glob / README.md
    . / repos / activity - api / node_modules / queue - microtask / README.md
    . / repos / activity - api / node_modules / shebang - regex / readme.md
    . / repos / activity - api / node_modules / is - path_1.default - inside / readme.md
    . / repos / activity - api / node_modules / onnxruntime - common / README.md
    . / repos / activity - api / node_modules / gopd / CHANGELOG.md
    . / repos / activity - api / node_modules / gopd / README.md
    . / repos / activity - api / node_modules / globals / readme.md
    . / repos / activity - api / node_modules / minimatch / README.md
    . / repos / activity - api / node_modules / esutils / README.md
    . / repos / activity - api / node_modules / isexe / README.md
    . / repos / activity - api / node_modules / argon2 / argon2 / CHANGELOG.md
    . / repos / activity - api / node_modules / argon2 / README.md
    . / repos / activity - api / node_modules / path_1.default - parse / README.md
    . / repos / activity - api / node_modules / cluster - key - slot / README.md
    . / repos / activity - api / node_modules / es - define - property / CHANGELOG.md
    . / repos / activity - api / node_modules / es - define - property / README.md
    . / repos / activity - api / node_modules /  / structured - clone / README.md
    . / repos / activity - api / node_modules / undici - types / README.md
    . / repos / activity - api / node_modules / path_1.default - is - absolute / readme.md
    . / repos / activity - api / node_modules / asynckit / README.md
    . / repos / activity - api / node_modules / global - agent / README.md
    . / repos / activity - api / node_modules / once / README.md
    . / repos / activity - api / node_modules / imurmurhash / README.md
    . / repos / activity - api / node_modules / inflight / README.md
    . / repos / activity - api / node_modules / dir - glob / readme.md
    . / repos / activity - api / node_modules / fill - range / README.md
    . / repos / activity - api / node_modules / get - intrinsic / CHANGELOG.md
    . / repos / activity - api / node_modules / get - intrinsic / README.md
    . / repos / activity - api / node_modules / acorn - jsx / README.md
    . / repos / activity - api / node_modules / keyv / README.md
    . / repos / activity - api / node_modules / has - tostringtag / CHANGELOG.md
    . / repos / activity - api / node_modules / has - tostringtag / README.md
    . / repos / activity - api / node_modules / callsites / readme.md
    . / repos / activity - api / node_modules / to - regex - range / README.md
    . / repos / activity - api / node_modules / json - stringify - safe / CHANGELOG.md
    . / repos / activity - api / node_modules / json - stringify - safe / README.md
    . / repos / activity - api / node_modules / event - target - shim / README.md
    . / repos / activity - api / node_modules / is - core - module / CHANGELOG.md
    . / repos / activity - api / node_modules / is - core - module / README.md
    . / repos / activity - api / node_modules / balanced - match / README.md
    . / repos / activity - api / node_modules / balanced - match / LICENSE.md
    . / repos / activity - api / node_modules / adm - zip / README.md
    . / repos / activity - api / node_modules / serialize - error / readme.md
    . / repos / activity - api / node_modules / serialize - error / node_modules / type - fest / readme.md
    . / repos / activity - api / node_modules / fast - levenshtein / README.md
    . / repos / activity - api / node_modules / fast - levenshtein / LICENSE.md
    . / repos / activity - api / node_modules / fastq / SECURITY.md
    . / repos / activity - api / node_modules / fastq / README.md
    . / repos / activity - api / node_modules / whatwg - url / README.md
    . / repos / activity - api / node_modules / es6 - error / CHANGELOG.md
    . / repos / activity - api / node_modules / es6 - error / README.md
    . / repos / activity - api / node_modules / es6 - error / LICENSE.md
    . / repos / activity - api / node_modules / array - union / readme.md
    . / repos / activity - api / node_modules / agentkeepalive / README.md
    . / repos / activity - api / node_modules / espree / README.md
    . / repos / activity - api / node_modules / file - entry - cache / changelog.md
    . / repos / activity - api / node_modules / file - entry - cache / README.md
    . / repos / activity - api / node_modules / yocto - queue / readme.md
    . / repos / activity - api / node_modules / chalk / readme.md
    . / repos / activity - api / node_modules / uuid / README.md
    . / repos / activity - api / node_modules / uuid / LICENSE.md
    . / repos / activity - api / node_modules /  - community / regexpp / README.md
    . / repos / activity - api / node_modules /  - community / eslint - utils / README.md
    . / repos / activity - api / node_modules / function () { } - bind / .github / SECURITY.md
    . / repos / activity - api / node_modules / function () { } - bind / CHANGELOG.md
    . / repos / activity - api / node_modules / function () { } - bind / README.md
    . / repos / activity - api / node_modules / fs.realpath / README.md
    . / repos / activity - api / node_modules / call - bind - apply - helpers / CHANGELOG.md
    . / repos / activity - api / node_modules / call - bind - apply - helpers / README.md
    . / repos / activity - api / node_modules / color - convert / CHANGELOG.md
    . / repos / activity - api / node_modules / color - convert / README.md
    . / repos / activity - api / node_modules /  / napi - create - int32 / SECURITY.md
    . / repos / activity - api / node_modules /  / napi - create - int32 / README.md
    . / repos / activity - api / node_modules /  / array - uint8c / SECURITY.md
    . / repos / activity - api / node_modules /  / array - uint8c / README.md
    . / repos / activity - api / node_modules /  / assert - is - big - endian / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - is - big - endian / README.md
    . / repos / activity - api / node_modules /  / number - float64 - base - to - float32 / SECURITY.md
    . / repos / activity - api / node_modules /  / number - float64 - base - to - float32 / README.md
    . / repos / activity - api / node_modules /  / boolean - ctor / SECURITY.md
    . / repos / activity - api / node_modules /  / boolean - ctor / README.md
    . / repos / activity - api / node_modules /  / constants - float64 - max - base2 - exponent - subnormal / SECURITY.md
    . / repos / activity - api / node_modules /  / constants - float64 - max - base2 - exponent - subnormal / README.md
    . / repos / activity - api / node_modules /  / math - base - special - abs / SECURITY.md
    . / repos / activity - api / node_modules /  / math - base - special - abs / README.md
    . / repos / activity - api / node_modules /  / math - base - napi - binary / SECURITY.md
    . / repos / activity - api / node_modules /  / math - base - napi - binary / README.md
    . / repos / activity - api / node_modules /  / utils - property - symbols / SECURITY.md
    . / repos / activity - api / node_modules /  / utils - property - symbols / README.md
    . / repos / activity - api / node_modules /  / constants - uint8 - max / SECURITY.md
    . / repos / activity - api / node_modules /  / constants - uint8 - max / README.md
    . / repos / activity - api / node_modules /  / array - int8 / SECURITY.md
    . / repos / activity - api / node_modules /  / array - int8 / README.md
    . / repos / activity - api / node_modules /  / assert - is - complex - like / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - is - complex - like / README.md
    . / repos / activity - api / node_modules /  / complex - float64 - real / SECURITY.md
    . / repos / activity - api / node_modules /  / complex - float64 - real / README.md
    . / repos / activity - api / node_modules /  / assert - has - uint8clampedarray - support / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - has - uint8clampedarray - support / README.md
    . / repos / activity - api / node_modules /  / assert - is - booleanarray / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - is - booleanarray / README.md
    . / repos / activity - api / node_modules /  / assert - is - number / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - is - number / README.md
    . / repos / activity - api / node_modules /  / assert - is - uint8clampedarray / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - is - uint8clampedarray / README.md
    . / repos / activity - api / node_modules /  / math - base - special - ceil / SECURITY.md
    . / repos / activity - api / node_modules /  / math - base - special - ceil / README.md
    . / repos / activity - api / node_modules /  / math - base - special - max / SECURITY.md
    . / repos / activity - api / node_modules /  / math - base - special - max / README.md
    . / repos / activity - api / node_modules /  / number - float64 - base - exponent / SECURITY.md
    . / repos / activity - api / node_modules /  / number - float64 - base - exponent / README.md
    . / repos / activity - api / node_modules /  / number - ctor / SECURITY.md
    . / repos / activity - api / node_modules /  / number - ctor / README.md
    . / repos / activity - api / node_modules /  / array - base - getter / SECURITY.md
    . / repos / activity - api / node_modules /  / array - base - getter / README.md
    . / repos / activity - api / node_modules /  / assert - has - tostringtag - support / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - has - tostringtag - support / README.md
    . / repos / activity - api / node_modules /  / utils - define - read - only - property / SECURITY.md
    . / repos / activity - api / node_modules /  / utils - define - read - only - property / README.md
    . / repos / activity - api / node_modules /  / string - format / SECURITY.md
    . / repos / activity - api / node_modules /  / string - format / README.md
    . / repos / activity - api / node_modules /  / constants - float16 - sign - mask / SECURITY.md
    . / repos / activity - api / node_modules /  / constants - float16 - sign - mask / README.md
    . / repos / activity - api / node_modules /  / utils - keys / SECURITY.md
    . / repos / activity - api / node_modules /  / utils - keys / README.md
    . / repos / activity - api / node_modules /  / constants - float16 - num - significand - bits / SECURITY.md
    . / repos / activity - api / node_modules /  / constants - float16 - num - significand - bits / README.md
    . / repos / activity - api / node_modules /  / symbol - to - primitive / SECURITY.md
    . / repos / activity - api / node_modules /  / symbol - to - primitive / README.md
    . / repos / activity - api / node_modules /  / assert - has - float32array - support / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - has - float32array - support / README.md
    . / repos / activity - api / node_modules /  / complex - float32 - reim / SECURITY.md
    . / repos / activity - api / node_modules /  / complex - float32 - reim / README.md
    . / repos / activity - api / node_modules /  / os - float - word - order / SECURITY.md
    . / repos / activity - api / node_modules /  / os - float - word - order / README.md
    . / repos / activity - api / node_modules /  / random - base - beta / SECURITY.md
    . / repos / activity - api / node_modules /  / random - base - beta / README.md
    . / repos / activity - api / node_modules /  / assert - is - function () { } / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - is - function () { } / README.md
    . / repos / activity - api / node_modules /  / regexp - function () { } - name / SECURITY.md
    . / repos / activity - api / node_modules /  / regexp - function () { } - name / README.md
    . / repos / activity - api / node_modules /  / number - float32 - base - to - word / SECURITY.md
    . / repos / activity - api / node_modules /  / number - float32 - base - to - word / README.md
    . / repos / activity - api / node_modules /  / assert - is - positive - integer / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - is - positive - integer / README.md
    . / repos / activity - api / node_modules /  / array - complex128 / SECURITY.md
    . / repos / activity - api / node_modules /  / array - complex128 / README.md
    . / repos / activity - api / node_modules /  / array - bool / SECURITY.md
    . / repos / activity - api / node_modules /  / array - bool / README.md
    . / repos / activity - api / node_modules /  / assert - has - int8array - support / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - has - int8array - support / README.md
    . / repos / activity - api / node_modules /  / string - base - format - interpolate / SECURITY.md
    . / repos / activity - api / node_modules /  / string - base - format - interpolate / README.md
    . / repos / activity - api / node_modules /  / error - tools - fmtprodmsg / SECURITY.md
    . / repos / activity - api / node_modules /  / error - tools - fmtprodmsg / README.md
    . / repos / activity - api / node_modules /  / assert - is - int16array / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - is - int16array / README.md
    . / repos / activity - api / node_modules /  / complex - float32 - real / SECURITY.md
    . / repos / activity - api / node_modules /  / complex - float32 - real / README.md
    . / repos / activity - api / node_modules /  / utils - get - prototype - of / SECURITY.md
    . / repos / activity - api / node_modules /  / utils - get - prototype - of / README.md
    . / repos / activity - api / node_modules /  / constants - float16 - max / SECURITY.md
    . / repos / activity - api / node_modules /  / constants - float16 - max / README.md
    . / repos / activity - api / node_modules /  / utils - define - property / SECURITY.md
    . / repos / activity - api / node_modules /  / utils - define - property / README.md
    . / repos / activity - api / node_modules /  / math - base - assert - is - finite / SECURITY.md
    . / repos / activity - api / node_modules /  / math - base - assert - is - finite / README.md
    . / repos / activity - api / node_modules /  / assert - has - function () { } - name - support / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - has - function () { } - name - support / README.md
    . / repos / activity - api / node_modules /  / complex - float64 - ctor / SECURITY.md
    . / repos / activity - api / node_modules /  / complex - float64 - ctor / README.md
    . / repos / activity - api / node_modules /  / number - float64 - base - set - low - word / SECURITY.md
    . / repos / activity - api / node_modules /  / number - float64 - base - set - low - word / README.md
    . / repos / activity - api / node_modules /  / constants - uint32 - max / SECURITY.md
    . / repos / activity - api / node_modules /  / constants - uint32 - max / README.md
    . / repos / activity - api / node_modules /  / random - base - improved - ziggurat / SECURITY.md
    . / repos / activity - api / node_modules /  / random - base - improved - ziggurat / README.md
    . / repos / activity - api / node_modules /  / number - float64 - base - set - high - word / SECURITY.md
    . / repos / activity - api / node_modules /  / number - float64 - base - set - high - word / README.md
    . / repos / activity - api / node_modules /  / constants - float16 - smallest - normal / SECURITY.md
    . / repos / activity - api / node_modules /  / constants - float16 - smallest - normal / README.md
    . / repos / activity - api / node_modules /  / complex - float64 - reim / SECURITY.md
    . / repos / activity - api / node_modules /  / complex - float64 - reim / README.md
    . / repos / activity - api / node_modules /  / assert - has - symbol - support / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - has - symbol - support / README.md
    . / repos / activity - api / node_modules /  / number - float32 - base - exponent / SECURITY.md
    . / repos / activity - api / node_modules /  / number - float32 - base - exponent / README.md
    . / repos / activity - api / node_modules /  / constants - float64 - high - word - significand - mask / SECURITY.md
    . / repos / activity - api / node_modules /  / constants - float64 - high - word - significand - mask / README.md
    . / repos / activity - api / node_modules /  / array - base - accessor - getter / SECURITY.md
    . / repos / activity - api / node_modules /  / array - base - accessor - getter / README.md
    . / repos / activity - api / node_modules /  / array - base - assert - is - complex64array / SECURITY.md
    . / repos / activity - api / node_modules /  / array - base - assert - is - complex64array / README.md
    . / repos / activity - api / node_modules /  / assert - is - string / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - is - string / README.md
    . / repos / activity - api / node_modules /  / strided - base - reinterpret - boolean / SECURITY.md
    . / repos / activity - api / node_modules /  / strided - base - reinterpret - boolean / README.md
    . / repos / activity - api / node_modules /  / constants - float64 - smallest - normal / SECURITY.md
    . / repos / activity - api / node_modules /  / constants - float64 - smallest - normal / README.md
    . / repos / activity - api / node_modules /  / types / SECURITY.md
    . / repos / activity - api / node_modules /  / types / README.md
    . / repos / activity - api / node_modules /  / assert - is - enumerable - property / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - is - enumerable - property / README.md
    . / repos / activity - api / node_modules /  / constants - float64 - high - word - abs - mask / SECURITY.md
    . / repos / activity - api / node_modules /  / constants - float64 - high - word - abs - mask / README.md
    . / repos / activity - api / node_modules /  / array - base - arraylike2object / SECURITY.md
    . / repos / activity - api / node_modules /  / array - base - arraylike2object / README.md
    . / repos / activity - api / node_modules /  / assert - napi - status - ok / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - napi - status - ok / README.md
    . / repos / activity - api / node_modules /  / assert - has - uint32array - support / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - has - uint32array - support / README.md
    . / repos / activity - api / node_modules /  / string - replace / SECURITY.md
    . / repos / activity - api / node_modules /  / string - replace / README.md
    . / repos / activity - api / node_modules /  / utils - convert - path_1.default / SECURITY.md
    . / repos / activity - api / node_modules /  / utils - convert - path_1.default / README.md
    . / repos / activity - api / node_modules /  / assert - is - integer / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - is - integer / README.md
    . / repos / activity - api / node_modules /  / math - base - assert - is - positive - zero / SECURITY.md
    . / repos / activity - api / node_modules /  / math - base - assert - is - positive - zero / README.md
    . / repos / activity - api / node_modules /  / constants - float16 - exponent - bias / SECURITY.md
    . / repos / activity - api / node_modules /  / constants - float16 - exponent - bias / README.md
    . / repos / activity - api / node_modules /  / strided - base - reinterpret - complex64 / SECURITY.md
    . / repos / activity - api / node_modules /  / strided - base - reinterpret - complex64 / README.md
    . / repos / activity - api / node_modules /  / number - float16 - ctor / SECURITY.md
    . / repos / activity - api / node_modules /  / number - float16 - ctor / README.md
    . / repos / activity - api / node_modules /  / assert - is - float64array / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - is - float64array / README.md
    . / repos / activity - api / node_modules /  / math - base - assert - is - infinite / SECURITY.md
    . / repos / activity - api / node_modules /  / math - base - assert - is - infinite / README.md
    . / repos / activity - api / node_modules /  / utils - global / SECURITY.md
    . / repos / activity - api / node_modules /  / utils - global / README.md
    . / repos / activity - api / node_modules /  / constants - float32 - sign - mask / SECURITY.md
    . / repos / activity - api / node_modules /  / constants - float32 - sign - mask / README.md
    . / repos / activity - api / node_modules /  / constants - float64 - num - high - word - significand - bits / SECURITY.md
    . / repos / activity - api / node_modules /  / constants - float64 - num - high - word - significand - bits / README.md
    . / repos / activity - api / node_modules /  / utils - type - of / SECURITY.md
    . / repos / activity - api / node_modules /  / utils - type - of / README.md
    . / repos / activity - api / node_modules /  / math - base - assert - is - finitef / SECURITY.md
    . / repos / activity - api / node_modules /  / math - base - assert - is - finitef / README.md
    . / repos / activity - api / node_modules /  / utils - function () { } - name / SECURITY.md
    . / repos / activity - api / node_modules /  / utils - function () { } - name / README.md
    . / repos / activity - api / node_modules /  / utils - escape - regexp - string / SECURITY.md
    . / repos / activity - api / node_modules /  / utils - escape - regexp - string / README.md
    . / repos / activity - api / node_modules /  / constants - float64 - pinf / SECURITY.md
    . / repos / activity - api / node_modules /  / constants - float64 - pinf / README.md
    . / repos / activity - api / node_modules /  / napi - ;
/SECURITY.md
    . / repos / activity - api / node_modules /  / napi - ;
/README.md
    . / repos / activity - api / node_modules /  / array - complex64 / SECURITY.md
    . / repos / activity - api / node_modules /  / array - complex64 / README.md
    . / repos / activity - api / node_modules /  / constants - float16 - exponent - mask / SECURITY.md
    . / repos / activity - api / node_modules /  / constants - float16 - exponent - mask / README.md
    . / repos / activity - api / node_modules /  / constants - float64 - min - base2 - exponent - subnormal / SECURITY.md
    . / repos / activity - api / node_modules /  / constants - float64 - min - base2 - exponent - subnormal / README.md
    . / repos / activity - api / node_modules /  / constants - float32 - abs - mask / SECURITY.md
    . / repos / activity - api / node_modules /  / constants - float32 - abs - mask / README.md
    . / repos / activity - api / node_modules /  / constants - float32 - exponent - bias / SECURITY.md
    . / repos / activity - api / node_modules /  / constants - float32 - exponent - bias / README.md
    . / repos / activity - api / node_modules /  / blas - base - gcopy / SECURITY.md
    . / repos / activity - api / node_modules /  / blas - base - gcopy / README.md
    . / repos / activity - api / node_modules /  / assert - is - object / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - is - object / README.md
    . / repos / activity - api / node_modules /  / symbol - iterator / SECURITY.md
    . / repos / activity - api / node_modules /  / symbol - iterator / README.md
    . / repos / activity - api / node_modules /  / constants - int32 - max / SECURITY.md
    . / repos / activity - api / node_modules /  / constants - int32 - max / README.md
    . / repos / activity - api / node_modules /  / constants - float64 - max - safe - integer / SECURITY.md
    . / repos / activity - api / node_modules /  / constants - float64 - max - safe - integer / README.md
    . / repos / activity - api / node_modules /  / constants - int8 - max / SECURITY.md
    . / repos / activity - api / node_modules /  / constants - int8 - max / README.md
    . / repos / activity - api / node_modules /  / constants - float32 - exponent - mask / SECURITY.md
    . / repos / activity - api / node_modules /  / constants - float32 - exponent - mask / README.md
    . / repos / activity - api / node_modules /  / constants - int16 - min / SECURITY.md
    . / repos / activity - api / node_modules /  / constants - int16 - min / README.md
    . / repos / activity - api / node_modules /  / assert - is - arguments / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - is - arguments / README.md
    . / repos / activity - api / node_modules /  / number - uint32 - base - to - int32 / SECURITY.md
    . / repos / activity - api / node_modules /  / number - uint32 - base - to - int32 / README.md
    . / repos / activity - api / node_modules /  / constants - float64 - exponent - bias / SECURITY.md
    . / repos / activity - api / node_modules /  / constants - float64 - exponent - bias / README.md
    . / repos / activity - api / node_modules /  / assert - is - float32array / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - is - float32array / README.md
    . / repos / activity - api / node_modules /  / assert - napi - is - type / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - napi - is - type / README.md
    . / repos / activity - api / node_modules /  / number - float64 - base - from - words / SECURITY.md
    . / repos / activity - api / node_modules /  / number - float64 - base - from - words / README.md
    . / repos / activity - api / node_modules /  / assert - has - int16array - support / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - has - int16array - support / README.md
    . / repos / activity - api / node_modules /  / constants - int16 - max / SECURITY.md
    . / repos / activity - api / node_modules /  / constants - int16 - max / README.md
    . / repos / activity - api / node_modules /  / assert - is - object - like / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - is - object - like / README.md
    . / repos / activity - api / node_modules /  / math - base - assert - is - odd / SECURITY.md
    . / repos / activity - api / node_modules /  / math - base - assert - is - odd / README.md
    . / repos / activity - api / node_modules /  / constants - array - max - typed - array - length / SECURITY.md
    . / repos / activity - api / node_modules /  / constants - array - max - typed - array - length / README.md
    . / repos / activity - api / node_modules /  / math - base - special - ln / SECURITY.md
    . / repos / activity - api / node_modules /  / math - base - special - ln / README.md
    . / repos / activity - api / node_modules /  / fs - resolve - parent - path_1.default / SECURITY.md
    . / repos / activity - api / node_modules /  / fs - resolve - parent - path_1.default / README.md
    . / repos / activity - api / node_modules /  / constants - float64 - ninf / SECURITY.md
    . / repos / activity - api / node_modules /  / constants - float64 - ninf / README.md
    . / repos / activity - api / node_modules /  / constants - float32 - ninf / SECURITY.md
    . / repos / activity - api / node_modules /  / constants - float32 - ninf / README.md
    . / repos / activity - api / node_modules /  / regexp - extended - length - path_1.default / SECURITY.md
    . / repos / activity - api / node_modules /  / regexp - extended - length - path_1.default / README.md
    . / repos / activity - api / node_modules /  / assert - has - uint8array - support / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - has - uint8array - support / README.md
    . / repos / activity - api / node_modules /  / assert - has - iterator - symbol - support / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - has - iterator - symbol - support / README.md
    . / repos / activity - api / node_modules /  / assert - is - collection / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - is - collection / README.md
    . / repos / activity - api / node_modules /  / array - uint8 / SECURITY.md
    . / repos / activity - api / node_modules /  / array - uint8 / README.md
    . / repos / activity - api / node_modules /  / constants - int32 - min / SECURITY.md
    . / repos / activity - api / node_modules /  / constants - int32 - min / README.md
    . / repos / activity - api / node_modules /  / string - base - lowercase / SECURITY.md
    . / repos / activity - api / node_modules /  / string - base - lowercase / README.md
    . / repos / activity - api / node_modules /  / random - base - mt19937 / SECURITY.md
    . / repos / activity - api / node_modules /  / random - base - mt19937 / README.md
    . / repos / activity - api / node_modules /  / string - base - format - tokenize / SECURITY.md
    . / repos / activity - api / node_modules /  / string - base - format - tokenize / README.md
    . / repos / activity - api / node_modules /  / process - cwd / SECURITY.md
    . / repos / activity - api / node_modules /  / process - cwd / README.md
    . / repos / activity - api / node_modules /  / utils - define - nonenumerable - read - only - accessor / SECURITY.md
    . / repos / activity - api / node_modules /  / utils - define - nonenumerable - read - only - accessor / README.md
    . / repos / activity - api / node_modules /  / utils - native - class {
} / SECURITY.md
    . / repos / activity - api / node_modules /  / utils - native - class {
} / README.md
    . / repos / activity - api / node_modules /  / constants - array - max - array - length / SECURITY.md
    . / repos / activity - api / node_modules /  / constants - array - max - array - length / README.md
    . / repos / activity - api / node_modules /  / assert - is - uint16array / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - is - uint16array / README.md
    . / repos / activity - api / node_modules /  / math - base - special - trunc / SECURITY.md
    . / repos / activity - api / node_modules /  / math - base - special - trunc / README.md
    . / repos / activity - api / node_modules /  / array - dtype / SECURITY.md
    . / repos / activity - api / node_modules /  / array - dtype / README.md
    . / repos / activity - api / node_modules /  / math - base - assert - is - nanf / SECURITY.md
    . / repos / activity - api / node_modules /  / math - base - assert - is - nanf / README.md
    . / repos / activity - api / node_modules /  / math - base - special - absf / SECURITY.md
    . / repos / activity - api / node_modules /  / math - base - special - absf / README.md
    . / repos / activity - api / node_modules /  / assert - has - uint16array - support / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - has - uint16array - support / README.md
    . / repos / activity - api / node_modules /  / assert - is - uint8array / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - is - uint8array / README.md
    . / repos / activity - api / node_modules /  / constants - float32 - pinf / SECURITY.md
    . / repos / activity - api / node_modules /  / constants - float32 - pinf / README.md
    . / repos / activity - api / node_modules /  / assert - is - little - endian / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - is - little - endian / README.md
    . / repos / activity - api / node_modules /  / assert - is - int8array / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - is - int8array / README.md
    . / repos / activity - api / node_modules /  / assert - is - complex - typed - array / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - is - complex - typed - array / README.md
    . / repos / activity - api / node_modules /  / math - base - special - sqrt / SECURITY.md
    . / repos / activity - api / node_modules /  / math - base - special - sqrt / README.md
    . / repos / activity - api / node_modules /  / array - int16 / SECURITY.md
    . / repos / activity - api / node_modules /  / array - int16 / README.md
    . / repos / activity - api / node_modules /  / constants - float64 - eps / SECURITY.md
    . / repos / activity - api / node_modules /  / constants - float64 - eps / README.md
    . / repos / activity - api / node_modules /  / assert - has - float64array - support / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - has - float64array - support / README.md
    . / repos / activity - api / node_modules /  / array - uint16 / SECURITY.md
    . / repos / activity - api / node_modules /  / array - uint16 / README.md
    . / repos / activity - api / node_modules /  / array - int32 / SECURITY.md
    . / repos / activity - api / node_modules /  / array - int32 / README.md
    . / repos / activity - api / node_modules /  / math - base - napi - unary / SECURITY.md
    . / repos / activity - api / node_modules /  / math - base - napi - unary / README.md
    . / repos / activity - api / node_modules /  / constants - float16 - significand - mask / SECURITY.md
    . / repos / activity - api / node_modules /  / constants - float16 - significand - mask / README.md
    . / repos / activity - api / node_modules /  / assert - has - to - primitive - symbol - support / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - has - to - primitive - symbol - support / README.md
    . / repos / activity - api / node_modules /  / assert - has - int32array - support / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - has - int32array - support / README.md
    . / repos / activity - api / node_modules /  / string - base - replace / SECURITY.md
    . / repos / activity - api / node_modules /  / string - base - replace / README.md
    . / repos / activity - api / node_modules /  / object - assign / SECURITY.md
    . / repos / activity - api / node_modules /  / object - assign / README.md
    . / repos / activity - api / node_modules /  / array - base - setter / SECURITY.md
    . / repos / activity - api / node_modules /  / array - base - setter / README.md
    . / repos / activity - api / node_modules /  / array - base - assert - is - accessor - array / SECURITY.md
    . / repos / activity - api / node_modules /  / array - base - assert - is - accessor - array / README.md
    . / repos / activity - api / node_modules /  / math - base - special - copysign / SECURITY.md
    . / repos / activity - api / node_modules /  / math - base - special - copysign / README.md
    . / repos / activity - api / node_modules /  / assert - is - nonnegative - integer / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - is - nonnegative - integer / README.md
    . / repos / activity - api / node_modules /  / math - base - special - ldexp / SECURITY.md
    . / repos / activity - api / node_modules /  / math - base - special - ldexp / README.md
    . / repos / activity - api / node_modules /  / number - float32 - base - to - float16 / SECURITY.md
    . / repos / activity - api / node_modules /  / number - float32 - base - to - float16 / README.md
    . / repos / activity - api / node_modules /  / assert - is - uint32array / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - is - uint32array / README.md
    . / repos / activity - api / node_modules /  / constants - float32 - num - significand - bits / SECURITY.md
    . / repos / activity - api / node_modules /  / constants - float32 - num - significand - bits / README.md
    . / repos / activity - api / node_modules /  / random - base - shared / SECURITY.md
    . / repos / activity - api / node_modules /  / random - base - shared / README.md
    . / repos / activity - api / node_modules /  / assert - is - regexp / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - is - regexp / README.md
    . / repos / activity - api / node_modules /  / number - float64 - base - normalize / SECURITY.md
    . / repos / activity - api / node_modules /  / number - float64 - base - normalize / README.md
    . / repos / activity - api / node_modules /  / assert - is - int32array / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - is - int32array / README.md
    . / repos / activity - api / node_modules /  / assert - is - nan / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - is - nan / README.md
    . / repos / activity - api / node_modules /  / constants - float16 - eps / SECURITY.md
    . / repos / activity - api / node_modules /  / constants - float16 - eps / README.md
    . / repos / activity - api / node_modules /  / utils - noop / SECURITY.md
    . / repos / activity - api / node_modules /  / utils - noop / README.md
    . / repos / activity - api / node_modules /  / assert - is - plain - object / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - is - plain - object / README.md
    . / repos / activity - api / node_modules /  / napi - argv - int32 / SECURITY.md
    . / repos / activity - api / node_modules /  / napi - argv - int32 / README.md
    . / repos / activity - api / node_modules /  / assert - is - typed - array / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - is - typed - array / README.md
    . / repos / activity - api / node_modules /  / math - base - assert - is - integer / SECURITY.md
    . / repos / activity - api / node_modules /  / math - base - assert - is - integer / README.md
    . / repos / activity - api / node_modules /  / math - base - special - pow / SECURITY.md
    . / repos / activity - api / node_modules /  / math - base - special - pow / README.md
    . / repos / activity - api / node_modules /  / napi - argv / SECURITY.md
    . / repos / activity - api / node_modules /  / napi - argv / README.md
    . / repos / activity - api / node_modules /  / assert - is - positive - number / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - is - positive - number / README.md
    . / repos / activity - api / node_modules /  / complex - float32 - imag / SECURITY.md
    . / repos / activity - api / node_modules /  / complex - float32 - imag / README.md
    . / repos / activity - api / node_modules /  / complex - float64 - imag / SECURITY.md
    . / repos / activity - api / node_modules /  / complex - float64 - imag / README.md
    . / repos / activity - api / node_modules /  / utils - define - nonenumerable - read - only - property / SECURITY.md
    . / repos / activity - api / node_modules /  / utils - define - nonenumerable - read - only - property / README.md
    . / repos / activity - api / node_modules /  / assert - instance - of / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - instance - of / README.md
    . / repos / activity - api / node_modules /  / number - float64 - base - to - words / SECURITY.md
    . / repos / activity - api / node_modules /  / number - float64 - base - to - words / README.md
    . / repos / activity - api / node_modules /  / number - float64 - base - get - high - word / SECURITY.md
    . / repos / activity - api / node_modules /  / number - float64 - base - get - high - word / README.md
    . / repos / activity - api / node_modules /  / utils - enumerable - properties / SECURITY.md
    . / repos / activity - api / node_modules /  / utils - enumerable - properties / README.md
    . / repos / activity - api / node_modules /  / assert - is - arraybuffer / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - is - arraybuffer / README.md
    . / repos / activity - api / node_modules /  / constants - float64 - max - base2 - exponent / SECURITY.md
    . / repos / activity - api / node_modules /  / constants - float64 - max - base2 - exponent / README.md
    . / repos / activity - api / node_modules /  / array - uint32 / SECURITY.md
    . / repos / activity - api / node_modules /  / array - uint32 / README.md
    . / repos / activity - api / node_modules /  / number - float16 - base - to - float32 / SECURITY.md
    . / repos / activity - api / node_modules /  / number - float16 - base - to - float32 / README.md
    . / repos / activity - api / node_modules /  / number - float16 - base - to - float64 / SECURITY.md
    . / repos / activity - api / node_modules /  / number - float16 - base - to - float64 / README.md
    . / repos / activity - api / node_modules /  / constants - float32 - eps / SECURITY.md
    . / repos / activity - api / node_modules /  / constants - float32 - eps / README.md
    . / repos / activity - api / node_modules /  / number - float64 - base - to - float16 / SECURITY.md
    . / repos / activity - api / node_modules /  / number - float64 - base - to - float16 / README.md
    . / repos / activity - api / node_modules /  / constants - float64 - ln - two / SECURITY.md
    . / repos / activity - api / node_modules /  / constants - float64 - ln - two / README.md
    . / repos / activity - api / node_modules /  / array - float64 / SECURITY.md
    . / repos / activity - api / node_modules /  / array - float64 / README.md
    . / repos / activity - api / node_modules /  / utils - define - nonenumerable - read - write - accessor / SECURITY.md
    . / repos / activity - api / node_modules /  / utils - define - nonenumerable - read - write - accessor / README.md
    . / repos / activity - api / node_modules /  / utils - index - of / SECURITY.md
    . / repos / activity - api / node_modules /  / utils - index - of / README.md
    . / repos / activity - api / node_modules /  / assert - is - array - like - object / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - is - array - like - object / README.md
    . / repos / activity - api / node_modules /  / array - base - accessor - setter / SECURITY.md
    . / repos / activity - api / node_modules /  / array - base - accessor - setter / README.md
    . / repos / activity - api / node_modules /  / object - ctor / SECURITY.md
    . / repos / activity - api / node_modules /  / object - ctor / README.md
    . / repos / activity - api / node_modules /  / assert - tools - array - function () { } / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - tools - array - function () { } / README.md
    . / repos / activity - api / node_modules /  / math - base - special - exp / SECURITY.md
    . / repos / activity - api / node_modules /  / math - base - special - exp / README.md
    . / repos / activity - api / node_modules /  / utils - constructor - name / SECURITY.md
    . / repos / activity - api / node_modules /  / utils - constructor - name / README.md
    . / repos / activity - api / node_modules /  / constants - int8 - min / SECURITY.md
    . / repos / activity - api / node_modules /  / constants - int8 - min / README.md
    . / repos / activity - api / node_modules /  / os - byte - order / SECURITY.md
    . / repos / activity - api / node_modules /  / os - byte - order / README.md
    . / repos / activity - api / node_modules /  / napi - argv - double / SECURITY.md
    . / repos / activity - api / node_modules /  / napi - argv - double / README.md
    . / repos / activity - api / node_modules /  / assert - has - own - property / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - has - own - property / README.md
    . / repos / activity - api / node_modules /  / constants - uint16 - max / SECURITY.md
    . / repos / activity - api / node_modules /  / constants - uint16 - max / README.md
    . / repos / activity - api / node_modules /  / fs - exists / SECURITY.md
    . / repos / activity - api / node_modules /  / fs - exists / README.md
    . / repos / activity - api / node_modules /  / complex - float32 - ctor / SECURITY.md
    . / repos / activity - api / node_modules /  / complex - float32 - ctor / README.md
    . / repos / activity - api / node_modules /  / assert - is - array / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - is - array / README.md
    . / repos / activity - api / node_modules /  / assert - napi - equal - types / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - napi - equal - types / README.md
    . / repos / activity - api / node_modules /  / array - to - json / SECURITY.md
    . / repos / activity - api / node_modules /  / array - to - json / README.md
    . / repos / activity - api / node_modules /  / array - base - assert - is - complex128array / SECURITY.md
    . / repos / activity - api / node_modules /  / array - base - assert - is - complex128array / README.md
    . / repos / activity - api / node_modules /  / assert - is - string - array / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - is - string - array / README.md
    . / repos / activity - api / node_modules /  / math - base - assert - is - nan / SECURITY.md
    . / repos / activity - api / node_modules /  / math - base - assert - is - nan / README.md
    . / repos / activity - api / node_modules /  / math - base - special - floor / SECURITY.md
    . / repos / activity - api / node_modules /  / math - base - special - floor / README.md
    . / repos / activity - api / node_modules /  / assert - has - has - instance - symbol - support / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - has - has - instance - symbol - support / README.md
    . / repos / activity - api / node_modules /  / assert - is - buffer / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - is - buffer / README.md
    . / repos / activity - api / node_modules /  / assert - is - boolean / SECURITY.md
    . / repos / activity - api / node_modules /  / assert - is - boolean / README.md
    . / repos / activity - api / node_modules /  / array - float32 / SECURITY.md
    . / repos / activity - api / node_modules /  / array - float32 / README.md
    . / repos / activity - api / node_modules /  / constants - float32 - significand - mask / SECURITY.md
    . / repos / activity - api / node_modules /  / constants - float32 - significand - mask / README.md
    . / repos / activity - api / node_modules /  / symbol - has - instance / SECURITY.md
    . / repos / activity - api / node_modules /  / symbol - has - instance / README.md
    . / repos / activity - api / node_modules /  / strided - base - reinterpret - complex128 / SECURITY.md
    . / repos / activity - api / node_modules /  / strided - base - reinterpret - complex128 / README.md
    . / repos / activity - api / node_modules /  / constants - float64 - high - word - exponent - mask / SECURITY.md
    . / repos / activity - api / node_modules /  / constants - float64 - high - word - exponent - mask / README.md
    . / repos / activity - api / node_modules /  / symbol - ctor / SECURITY.md
    . / repos / activity - api / node_modules /  / symbol - ctor / README.md
    . / repos / activity - api / node_modules /  / napi - argv - float / SECURITY.md
    . / repos / activity - api / node_modules /  / napi - argv - float / README.md
    . / repos / activity - api / node_modules /  / utils - constant - function () { } / SECURITY.md
    . / repos / activity - api / node_modules /  / utils - constant - function () { } / README.md
    . / repos / activity - api / node_modules /  / math - base - assert - is - even / SECURITY.md
    . / repos / activity - api / node_modules /  / math - base - assert - is - even / README.md
    . / repos / activity - api / node_modules /  / number - uint32 - base - mul / SECURITY.md
    . / repos / activity - api / node_modules /  / number - uint32 - base - mul / README.md
    . / repos / activity - api / node_modules /  / utils - library - manifest / node_modules / debug / node_modules / ms / readme.md
    . / repos / activity - api / node_modules /  / utils - library - manifest / node_modules / debug / node_modules / ms / license.md
    . / repos / activity - api / node_modules /  / utils - library - manifest / node_modules / debug / CHANGELOG.md
    . / repos / activity - api / node_modules /  / utils - library - manifest / node_modules / debug / README.md
    . / repos / activity - api / node_modules /  / utils - library - manifest / SECURITY.md
    . / repos / activity - api / node_modules /  / utils - library - manifest / README.md
    . / repos / activity - api / node_modules /  / constants - float64 - high - word - sign - mask / SECURITY.md
    . / repos / activity - api / node_modules /  / constants - float64 - high - word - sign - mask / README.md
    . / repos / activity - api / node_modules / has - symbols / CHANGELOG.md
    . / repos / activity - api / node_modules / has - symbols / README.md
    . / repos / activity - api / node_modules / optionator / CHANGELOG.md
    . / repos / activity - api / node_modules / optionator / README.md
    . / repos / activity - api / node_modules / es - set - tostringtag / CHANGELOG.md
    . / repos / activity - api / node_modules / es - set - tostringtag / README.md
    . / repos / activity - api / node_modules / node - addon - api / tools / README.md
    . / repos / activity - api / node_modules / node - addon - api / README.md
    . / repos / activity - api / node_modules / node - addon - api / LICENSE.md
    . / repos / activity - api / node_modules / nanoid / README.md
    . / repos / activity - api / node_modules / inherits / README.md
    . / repos / activity - api / node_modules / argparse / CHANGELOG.md
    . / repos / activity - api / node_modules / argparse / README.md
    . / repos / activity - api / node_modules / ansi - styles / readme.md
    . / repos / activity - api / node_modules / jose / README.md
    . / repos / activity - api / node_modules / jose / LICENSE.md
    . / repos / activity - api / node_modules / esrecurse / README.md
    . / repos / activity - api / node_modules / parent - module / readme.md
    . / repos / activity - api / node_modules / locate - path_1.default / readme.md
    . / repos / activity - api / node_modules / path_1.default - key / readme.md
    . / repos / activity - api / node_modules / type - fest / readme.md
    . / repos / activity - api / node_modules / delayed - stream / Readme.md
    . / repos / activity - api / node_modules / get - proto / CHANGELOG.md
    . / repos / activity - api / node_modules / get - proto / README.md
    . / repos / activity - api / node_modules / levn / README.md
    . / repos / activity - api / node_modules / form - data / CHANGELOG.md
    . / repos / activity - api / node_modules / form - data / README.md
    . / repos / activity - api / node_modules / webidl - conversions / README.md
    . / repos / activity - api / node_modules / webidl - conversions / LICENSE.md
    . / repos / activity - api / node_modules / esquery / README.md
    . / repos / activity - api / node_modules / slash / readme.md
    . / repos / activity - api / node_modules / graphemer / CHANGELOG.md
    . / repos / activity - api / node_modules / graphemer / README.md
    . / repos / activity - api / node_modules / estraverse / README.md
    . / repos / activity - api / node_modules / supports - preserve - symlinks - flag / CHANGELOG.md
    . / repos / activity - api / node_modules / supports - preserve - symlinks - flag / README.md
    . / repos / activity - api / node_modules / redis - parser / changelog.md
    . / repos / activity - api / node_modules / redis - parser / README.md
    . / repos / activity - api / scripts / git - hooks / README.md
    . / repos / activity - api / README.md
    . / repos / activity - api / CLAUDE.md
    . / repos / activity - api / docs / SHAPE_MATCH_SCORING.md
    . / repos / activity - api / docs / SHAPE_REGISTRY.md
    . / repos / activity - api / docs / archive / 2026 - 4 - 8 - verification / API_KEY_AUTH_VERIFICATION_SUMMARY.md
    . / repos / activity - api / docs / archive / 2026 - 4 - 8 - verification / API_KEY_VERIFICATION_CHECKLIST.md
    . / repos / activity - api / docs / archive / 2026 - 4 - 8 - verification / README.md
    . / repos / activity - api / docs / archive / 2026 - 4 - 8 - verification / VERIFICATION_DELIVERABLES.md
    . / repos / activity - api / docs / archive / 2026 - 4 - 14 - jiggle - prune / FEEDBACK_ENDPOINT_VERIFICATION.md
    . / repos / activity - api / docs / archive / 2026 - 4 - 14 - jiggle - prune / GAP_ANALYSIS_AND_PLAN.md
    . / repos / activity - api / docs / archive / 2026 - 4 - 14 - jiggle - prune / SCHEMA_FIX_GENERIC_RESOLVERS.md
    . / repos / activity - api / docs / archive / 2026 - 4 - 14 - jiggle - prune / VERIFICATION_REPORT.md
    . / repos / activity - api / docs / archive / 2026 - 4 - 14 - jiggle - prune / FEEDBACK_IMPLEMENTATION_SUMMARY.md
    . / repos / activity - api / docs / archive / 2026 - 4 - 14 - jiggle - prune / README.md
    . / repos / activity - api / docs / archive / 2026 - 4 - 14 - jiggle - prune / FEEDBACK_QUICK_REFERENCE.md
    . / repos / activity - api / docs / archive / 2026 - 3 - 27 / SETUP_SUMMARY.md
    . / repos / activity - api / docs / archive / 2026 - 3 - 27 / README.md
    . / repos / activity - api / docs / VARIANT_CREATION.md
    . / repos / activity - api / docs / GOAL_PATHS_IMPLEMENTATION.md
    . / repos / activity - api / docs / SCHEMA_MIGRATION_GUIDE.md
    . / repos / activity - api / docs / API_PHASE1_ENDPOINTS.md
    . / repos / activity - api / docs / CI_CD_INTEGRATION.md
    . / repos / activity - api / docs / IMPULSE_SHAPE_MATCHING_ANALYSIS.md
    . / repos / activity - api / docs / VARIANT_CONFIDENCE_QUICK_REFERENCE.md
    . / repos / activity - api / docs / PATTERN_EXTRACTION_IMPLEMENTATION.md
    . / repos / activity - api / docs / SURREALDB_TYPES.md
    . / repos / activity - api / docs / API_REFERENCE.md
    . / repos / activity - api / docs / DISCOVERY_INTEGRATION.md
    . / repos / activity - api / docs / testing / CLEANUP_UPKEEP_RUNBOOK.md
    . / repos / ias - executor - ts / node_modules / bun - types / README.md
    . / repos / ias - executor - ts / node_modules / bun - types / docs / README.md
    . / repos / ias - executor - ts / node_modules /  / node / README.md
    . / repos / ias - executor - ts / node_modules /  / bun / README.md
    . / repos / ias - executor - ts / node_modules / typescript / SECURITY.md
    . / repos / ias - executor - ts / node_modules / typescript / README.md
    . / repos / ias - executor - ts / node_modules / .bun - cache /  / node;
.0;
/README.md
    . / repos / ias - executor - ts / node_modules / .bun - cache /  / bun;
.14;
/README.md
    . / repos / ias - executor - ts / node_modules / .bun - cache / typescript;
.3;
/SECURITY.md
    . / repos / ias - executor - ts / node_modules / .bun - cache / typescript;
.3;
/README.md
    . / repos / ias - executor - ts / node_modules / .bun - cache / bun - types;
.14;
/README.md
    . / repos / ias - executor - ts / node_modules / .bun - cache / bun - types;
.14;
/docs/README.md
    . / repos / ias - executor - ts / node_modules / .bun - cache / undici - types;
.6;
/README.md
    . / repos / ias - executor - ts / node_modules / undici - types / README.md
    . / repos / ias - executor - ts / README.md
    . / repos / discovery - vessel / node_modules / bun - types / README.md
    . / repos / discovery - vessel / node_modules / bun - types / CLAUDE.md
    . / repos / discovery - vessel / node_modules / bun - types / docs / README.md
    . / repos / discovery - vessel / node_modules /  / node / README.md
    . / repos / discovery - vessel / node_modules /  / bun / README.md
    . / repos / discovery - vessel / node_modules / hono / README.md
    . / repos / discovery - vessel / node_modules / typescript / SECURITY.md
    . / repos / discovery - vessel / node_modules / typescript / README.md
    . / repos / discovery - vessel / node_modules / .bun - cache /  / node;
.0;
/README.md
    . / repos / discovery - vessel / node_modules / .bun - cache /  / bun;
.11;
/README.md
    . / repos / discovery - vessel / node_modules / .bun - cache / undici - types;
.2;
/README.md
    . / repos / discovery - vessel / node_modules / .bun - cache / bun - types;
.11;
/README.md
    . / repos / discovery - vessel / node_modules / .bun - cache / bun - types;
.11;
/CLAUDE.md
    . / repos / discovery - vessel / node_modules / .bun - cache / bun - types;
.11;
/docs/README.md
    . / repos / discovery - vessel / node_modules / .bun - cache / typescript;
.3;
/SECURITY.md
    . / repos / discovery - vessel / node_modules / .bun - cache / typescript;
.3;
/README.md
    . / repos / discovery - vessel / node_modules / .bun - cache / hono;
.12;
/README.md
    . / repos / discovery - vessel / node_modules / undici - types / README.md
    . / repos / discovery - vessel / test / README.md
    . / repos / discovery - vessel / CHANGELOG.md
    . / repos / discovery - vessel / scripts / git - hooks / README.md
    . / repos / discovery - vessel / README.md
    . / repos / discovery - vessel / CLAUDE.md
    . / gap - store / a - gap - was - closed - ;
with (-a - remedy - that - never - happened.md
    . / Substrate / Projects / MyNewOpenTasksProject.md
    . / Substrate / Projects / test_project_with_open_todos_for_real.md
    . / Substrate / Projects / NewProjectWithAnOpenTodo.md
    . / Substrate / Projects / test_open_todos.md
    . / Substrate / Projects / temp_project_with_todos.md
    . / Substrate / Projects / NewProjectWithTrulyOpenTodos.md
    . / Substrate / Projects / test_project_for_dispatch.md
    . / Substrate / Projects / NewProjectWithNewTodos.md
    . / Substrate / Projects / TestOpenTodos.md
    . / Substrate / Projects / NewTestProject.md
    . / Substrate / Projects / MyProject.md
    . / Substrate / Projects / new_temp_project_with_open_todos.md
    . / Substrate / Projects / NewProject.md
    . / Substrate / Projects / my_temp_project_with_open_todo.md
    . / Substrate / Projects / new_project_with_todos.md
    . / Substrate / Projects / AnotherNewProjectWithTrulyOpenTodos.md
    . / Substrate / Projects / TestProjectWithOpenTodos.md
    . / Substrate / Projects / NewFileWithOpenTodos.md
    . / Substrate / Projects / TemporaryProjectWithOpenTodos.md
    . / Substrate / Projects / NewProjectWithTodos.md
    . / Substrate / Projects / NewProjectWithOpenTodos.md
    . / Substrate / Projects / MyTestProject.md
    . / Substrate / Projects / new_project_with_undispatched_todo.md
    . / Substrate / Projects / ProjectWithOpenTodo.md
    . / Substrate / Projects / NewProjectWithOpenTodosNow.md
    . / Substrate / Projects / UnfinishedProject.md
    . / Substrate / Projects / MyProjectWithOpenTodo.md
    . / Substrate / Projects / test_project.md
    . / Substrate / Projects / temp_project.md
    . / Substrate / Projects / dummy_project.md
    . / Substrate / Projects / AnotherProject.md
    . / Substrate / Projects / TemporaryNewProject.md
    . / Substrate / Projects / new_open_todo.md
    . / Substrate / Projects / MyNewProject.md
    . / Substrate / Projects / my_new_project_with_open_todo.md
    . / Substrate / Projects / test_dispatch_project.md
    . / Substrate / Projects / test_open_todos_new.md
    . / Substrate / Projects / NewProjectWithOpenTodoForTest.md
    . / Substrate / Projects / test_project_with_open_todo.md
    . / Substrate / Projects / NewProjectWithOpenTask.md
    . / Substrate / Projects / temp_project_with_open_todos.md
    . / Substrate / Projects / my_project_with_todos.md
    . / Substrate / Projects / test_project_with_todos.md
    . / Substrate / Projects / TestWithOpenTodos.md
    . / Substrate / Projects / ProjectWithNewTodos.md
    . / Substrate / Projects / TestProject.md
    . / Substrate / Projects / temporary_test_project_with_todos.md
    . / Substrate / Projects / NewTestProjectWithOpenTodos.md
    . / Substrate / what - day - is - it - dcf64ac5.md
    . / memory / orphaned_capabilities_scan_summary.md
    . / memory_note.md
    . / gaps / substrate - gap - systematic - failure - development - vessel_scaffold - and - publish - vessel.md
    . / gaps / a - gap - was - closed - )
    with (-a - remedy - that - never - happened.md
        . / gaps / systematic - failure - development - vessel_scaffold - and - publish - vessel / improvement.md
        . / scripts / git - hooks / README.md
        . / scripts / substrate / federation - relay / node_modules /  / http - parser - js / node_modules / uint8arrays / node_modules / multiformats / README.md
        . / scripts / substrate / federation - relay / node_modules /  / http - parser - js / node_modules / uint8arrays / README.md
        . / scripts / substrate / federation - relay / node_modules /  / http - parser - js / README.md
        . / scripts / substrate / federation - relay / node_modules /  / http - parser - js / LICENSE.md
        . / scripts / substrate / federation - relay / node_modules / supports - color / readme.md
        . / scripts / substrate / federation - relay / node_modules / bun - types / README.md
        . / scripts / substrate / federation - relay / node_modules / bun - types / docs / README.md
        . / scripts / substrate / federation - relay / node_modules / eventemitter3 / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / http - parser - js / node_modules / uint8arrays / node_modules / multiformats / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / http - parser - js / node_modules / uint8arrays / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / http - parser - js / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / http - parser - js / LICENSE.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / supports - color / readme.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / bun - types / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / bun - types / docs / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / eventemitter3 / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / delay / readme.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / node / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / bun / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / uint8arraylist / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / abort - controller / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / uint8 - varint / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / it - parallel / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / weald / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / it - queue / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / p - defer / readme.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / p - retry / readme.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / super. - regex / readme.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / hashlru / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / time - span / readme.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / any - signal / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / ieee754 / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / it - drain / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / convert - hrtime / readme.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / unlimited - timeout / readme.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / clone - regexp / readme.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / progress - events / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / function () { } - timeout / readme.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / it - length - prefixed / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / interface - datastore / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / datastore - core / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / p - timeout / readme.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / main - event / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / cborg / bench / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / cborg / CHANGELOG.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / cborg / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / string_decoder / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / race - signal / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / abort - error / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / is - electron / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / safe - buffer / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / dns - packet / CHANGELOG.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / dns - packet / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / get - iterator / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / multiformats / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / typescript / SECURITY.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / typescript / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / undici / types / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / undici / lib / web / subresource - integrity / Readme.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / undici / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / undici / docs / docs / api / GlobalInstallation.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / undici / docs / docs / api / Socks5ProxyAgent.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / undici / docs / docs / api / Dispatcher.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / undici / docs / docs / api / Pool.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / undici / docs / docs / api / CacheStore.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / undici / docs / docs / api / Client.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / undici / docs / docs / api / PoolStats.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / undici / docs / docs / api / RetryAgent.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / undici / docs / docs / api / MockCallHistoryLog.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / undici / docs / docs / api / RetryHandler.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / undici / docs / docs / api / EnvHttpProxyAgent.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / undici / docs / docs / api / MockErrors.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / undici / docs / docs / api / Errors.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / undici / docs / docs / api / BalancedPool.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / undici / docs / docs / api / WebSocket.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / undici / docs / docs / api / Agent.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / undici / docs / docs / api / Util.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / undici / docs / docs / api / Fetch.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / undici / docs / docs / api / SnapshotAgent.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / undici / docs / docs / api / api - lifecycle.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / undici / docs / docs / api / ContentType.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / undici / docs / docs / api / DiagnosticsChannel.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / undici / docs / docs / api / ClientStats.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / undici / docs / docs / api / MockClient.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / undici / docs / docs / api / Debug.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / undici / docs / docs / api / EventSource.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / undici / docs / docs / api / RoundRobinPool.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / undici / docs / docs / api / CacheStorage.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / undici / docs / docs / api / MockPool.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / undici / docs / docs / api / RedirectHandler.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / undici / docs / docs / api / MockAgent.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / undici / docs / docs / api / ProxyAgent.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / undici / docs / docs / api / Connector.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / undici / docs / docs / api / MockCallHistory.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / undici / docs / docs / api / Cookies.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / undici / docs / docs / api / H2CClient.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / undici / docs / docs / best - practices / proxy.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / undici / docs / docs / best - practices / writing - tests.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / undici / docs / docs / best - practices / mocking - request.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / undici / docs / docs / best - practices / client - certificate.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / undici / docs / docs / best - practices / undici - vs - builtin - fetch.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / undici / docs / docs / best - practices / migrating - from - v7 - to - v8.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / undici / docs / docs / best - practices / crawling.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / undici / docs / docs / GettingStarted.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / multiaddr / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / uri - to - multiaddr / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / dns / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / multiaddr - to - uri / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / multiaddr - matcher / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / it - sort / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / libp2p - yamux / node_modules / uint8arraylist / node_modules / uint8arrays / node_modules / multiformats / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / libp2p - yamux / node_modules / uint8arraylist / node_modules / uint8arrays / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / libp2p - yamux / node_modules / uint8arraylist / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / libp2p - yamux / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / libp2p - noise / node_modules / uint8arraylist / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / libp2p - noise / node_modules / uint8arrays / node_modules / multiformats / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / libp2p - noise / node_modules / uint8arrays / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / libp2p - noise / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / as - chacha20poly1305 / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / is - ip / CHANGELOG.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / is - ip / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / as - sha256 / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / netmask / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / curves / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / ciphers / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / hashes / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / it - merge / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / it - queueless - pushable / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / wherearewe / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / protons - runtime / node_modules / uint8arraylist / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / protons - runtime / node_modules / uint8 - varint / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / protons - runtime / node_modules / uint8arrays / node_modules / multiformats / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / protons - runtime / node_modules / uint8arrays / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / protons - runtime / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / ws / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / buffer / AUTHORS.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / buffer / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / utf8 - codec / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / uint8arrays / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / mortice / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / ms / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / ip - regex / readme.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / it - reader / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / it - stream - types / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / interface - store / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / it - filter / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / it - map / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / it - pipe / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / is - ip / readme.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / readable - stream / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / retimeable - signal / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / it - take / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / undici - types / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / it - to - browser - readablestream / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / event - target - shim / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / is - network - error / readme.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / http / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / peer - record / node_modules / protons - runtime / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / peer - record / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / circuit - relay - v2 / node_modules / protons - runtime / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / circuit - relay - v2 / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / dcutr / node_modules / protons - runtime / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / dcutr / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / http - peer - id - auth / node_modules / uint8 - varint / node_modules / uint8arraylist / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / http - peer - id - auth / node_modules / uint8 - varint / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / http - peer - id - auth / node_modules / uint8arrays / node_modules / multiformats / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / http - peer - id - auth / node_modules / uint8arrays / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / http - peer - id - auth / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / identify / node_modules / protons - runtime / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / identify / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / ping / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / utils / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / peer - collections / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / peer - id / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / logger / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / http - websocket / node_modules / uint8arrays / node_modules / multiformats / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / http - websocket / node_modules / uint8arrays / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / http - websocket / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / interface / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / http - utils / node_modules / uint8arrays / node_modules / multiformats / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / http - utils / node_modules / uint8arrays / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / http - utils / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / http - fetch / node_modules / uint8arrays / node_modules / multiformats / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / http - fetch / node_modules / uint8arrays / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / http - fetch / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / tcp / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / websockets / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / autonat / node_modules / protons - runtime / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / autonat / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / crypto / node_modules / protons - runtime / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / crypto / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / interface - internal / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / multistream - select / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / peer - store / node_modules / protons - runtime / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / peer - store / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / libp2p / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / it - peekable / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / is - loopback - addr / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / events / security.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / events / History.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / events / Readme.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / race - event / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / it - all / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / p - queue / readme.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / nanoid / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / fnv1a / readme.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / p - event / readme.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / random - int / readme.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / process / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / it - pushable / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / base64 - js / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / is - regexp / readme.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / netmask / CHANGELOG.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / netmask / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / netmask / LICENSE.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules / cookie / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / node_modules /  / ip - codec / Readme.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - federation - transport / README.md
        . / scripts / substrate / federation - relay / node_modules / delay / readme.md
        . / scripts / substrate / federation - relay / node_modules /  / node / README.md
        . / scripts / substrate / federation - relay / node_modules /  / bun / README.md
        . / scripts / substrate / federation - relay / node_modules / uint8arraylist / README.md
        . / scripts / substrate / federation - relay / node_modules / abort - controller / README.md
        . / scripts / substrate / federation - relay / node_modules / uint8 - varint / README.md
        . / scripts / substrate / federation - relay / node_modules / it - parallel / README.md
        . / scripts / substrate / federation - relay / node_modules / weald / README.md
        . / scripts / substrate / federation - relay / node_modules / it - queue / README.md
        . / scripts / substrate / federation - relay / node_modules / p - defer / readme.md
        . / scripts / substrate / federation - relay / node_modules / p - retry / readme.md
        . / scripts / substrate / federation - relay / node_modules / super. - regex / readme.md
        . / scripts / substrate / federation - relay / node_modules / hashlru / README.md
        . / scripts / substrate / federation - relay / node_modules / time - span / readme.md
        . / scripts / substrate / federation - relay / node_modules / any - signal / README.md
        . / scripts / substrate / federation - relay / node_modules / ieee754 / README.md
        . / scripts / substrate / federation - relay / node_modules / it - drain / README.md
        . / scripts / substrate / federation - relay / node_modules / convert - hrtime / readme.md
        . / scripts / substrate / federation - relay / node_modules / unlimited - timeout / readme.md
        . / scripts / substrate / federation - relay / node_modules / clone - regexp / readme.md
        . / scripts / substrate / federation - relay / node_modules / progress - events / README.md
        . / scripts / substrate / federation - relay / node_modules / function () { } - timeout / readme.md
        . / scripts / substrate / federation - relay / node_modules / it - length - prefixed / README.md
        . / scripts / substrate / federation - relay / node_modules / interface - datastore / README.md
        . / scripts / substrate / federation - relay / node_modules / datastore - core / README.md
        . / scripts / substrate / federation - relay / node_modules / p - timeout / readme.md
        . / scripts / substrate / federation - relay / node_modules / main - event / README.md
        . / scripts / substrate / federation - relay / node_modules / cborg / bench / README.md
        . / scripts / substrate / federation - relay / node_modules / cborg / CHANGELOG.md
        . / scripts / substrate / federation - relay / node_modules / cborg / README.md
        . / scripts / substrate / federation - relay / node_modules / string_decoder / README.md
        . / scripts / substrate / federation - relay / node_modules / race - signal / README.md
        . / scripts / substrate / federation - relay / node_modules / abort - error / README.md
        . / scripts / substrate / federation - relay / node_modules / is - electron / README.md
        . / scripts / substrate / federation - relay / node_modules / safe - buffer / README.md
        . / scripts / substrate / federation - relay / node_modules /  / dns - packet / CHANGELOG.md
        . / scripts / substrate / federation - relay / node_modules /  / dns - packet / README.md
        . / scripts / substrate / federation - relay / node_modules / get - iterator / README.md
        . / scripts / substrate / federation - relay / node_modules / multiformats / README.md
        . / scripts / substrate / federation - relay / node_modules / typescript / SECURITY.md
        . / scripts / substrate / federation - relay / node_modules / typescript / README.md
        . / scripts / substrate / federation - relay / node_modules / undici / types / README.md
        . / scripts / substrate / federation - relay / node_modules / undici / lib / web / subresource - integrity / Readme.md
        . / scripts / substrate / federation - relay / node_modules / undici / README.md
        . / scripts / substrate / federation - relay / node_modules / undici / docs / docs / api / GlobalInstallation.md
        . / scripts / substrate / federation - relay / node_modules / undici / docs / docs / api / Socks5ProxyAgent.md
        . / scripts / substrate / federation - relay / node_modules / undici / docs / docs / api / Dispatcher.md
        . / scripts / substrate / federation - relay / node_modules / undici / docs / docs / api / Pool.md
        . / scripts / substrate / federation - relay / node_modules / undici / docs / docs / api / CacheStore.md
        . / scripts / substrate / federation - relay / node_modules / undici / docs / docs / api / Client.md
        . / scripts / substrate / federation - relay / node_modules / undici / docs / docs / api / PoolStats.md
        . / scripts / substrate / federation - relay / node_modules / undici / docs / docs / api / RetryAgent.md
        . / scripts / substrate / federation - relay / node_modules / undici / docs / docs / api / MockCallHistoryLog.md
        . / scripts / substrate / federation - relay / node_modules / undici / docs / docs / api / RetryHandler.md
        . / scripts / substrate / federation - relay / node_modules / undici / docs / docs / api / EnvHttpProxyAgent.md
        . / scripts / substrate / federation - relay / node_modules / undici / docs / docs / api / MockErrors.md
        . / scripts / substrate / federation - relay / node_modules / undici / docs / docs / api / Errors.md
        . / scripts / substrate / federation - relay / node_modules / undici / docs / docs / api / BalancedPool.md
        . / scripts / substrate / federation - relay / node_modules / undici / docs / docs / api / WebSocket.md
        . / scripts / substrate / federation - relay / node_modules / undici / docs / docs / api / Agent.md
        . / scripts / substrate / federation - relay / node_modules / undici / docs / docs / api / Util.md
        . / scripts / substrate / federation - relay / node_modules / undici / docs / docs / api / Fetch.md
        . / scripts / substrate / federation - relay / node_modules / undici / docs / docs / api / SnapshotAgent.md
        . / scripts / substrate / federation - relay / node_modules / undici / docs / docs / api / api - lifecycle.md
        . / scripts / substrate / federation - relay / node_modules / undici / docs / docs / api / ContentType.md
        . / scripts / substrate / federation - relay / node_modules / undici / docs / docs / api / DiagnosticsChannel.md
        . / scripts / substrate / federation - relay / node_modules / undici / docs / docs / api / ClientStats.md
        . / scripts / substrate / federation - relay / node_modules / undici / docs / docs / api / MockClient.md
        . / scripts / substrate / federation - relay / node_modules / undici / docs / docs / api / Debug.md
        . / scripts / substrate / federation - relay / node_modules / undici / docs / docs / api / EventSource.md
        . / scripts / substrate / federation - relay / node_modules / undici / docs / docs / api / RoundRobinPool.md
        . / scripts / substrate / federation - relay / node_modules / undici / docs / docs / api / CacheStorage.md
        . / scripts / substrate / federation - relay / node_modules / undici / docs / docs / api / MockPool.md
        . / scripts / substrate / federation - relay / node_modules / undici / docs / docs / api / RedirectHandler.md
        . / scripts / substrate / federation - relay / node_modules / undici / docs / docs / api / MockAgent.md
        . / scripts / substrate / federation - relay / node_modules / undici / docs / docs / api / ProxyAgent.md
        . / scripts / substrate / federation - relay / node_modules / undici / docs / docs / api / Connector.md
        . / scripts / substrate / federation - relay / node_modules / undici / docs / docs / api / MockCallHistory.md
        . / scripts / substrate / federation - relay / node_modules / undici / docs / docs / api / Cookies.md
        . / scripts / substrate / federation - relay / node_modules / undici / docs / docs / api / H2CClient.md
        . / scripts / substrate / federation - relay / node_modules / undici / docs / docs / best - practices / proxy.md
        . / scripts / substrate / federation - relay / node_modules / undici / docs / docs / best - practices / writing - tests.md
        . / scripts / substrate / federation - relay / node_modules / undici / docs / docs / best - practices / mocking - request.md
        . / scripts / substrate / federation - relay / node_modules / undici / docs / docs / best - practices / client - certificate.md
        . / scripts / substrate / federation - relay / node_modules / undici / docs / docs / best - practices / undici - vs - builtin - fetch.md
        . / scripts / substrate / federation - relay / node_modules / undici / docs / docs / best - practices / migrating - from - v7 - to - v8.md
        . / scripts / substrate / federation - relay / node_modules / undici / docs / docs / best - practices / crawling.md
        . / scripts / substrate / federation - relay / node_modules / undici / docs / docs / GettingStarted.md
        . / scripts / substrate / federation - relay / node_modules /  / multiaddr / README.md
        . / scripts / substrate / federation - relay / node_modules /  / uri - to - multiaddr / README.md
        . / scripts / substrate / federation - relay / node_modules /  / dns / README.md
        . / scripts / substrate / federation - relay / node_modules /  / multiaddr - to - uri / README.md
        . / scripts / substrate / federation - relay / node_modules /  / multiaddr - matcher / README.md
        . / scripts / substrate / federation - relay / node_modules / it - sort / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - yamux / node_modules / uint8arraylist / node_modules / uint8arrays / node_modules / multiformats / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - yamux / node_modules / uint8arraylist / node_modules / uint8arrays / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - yamux / node_modules / uint8arraylist / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - yamux / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - noise / node_modules / uint8arraylist / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - noise / node_modules / uint8arrays / node_modules / multiformats / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - noise / node_modules / uint8arrays / README.md
        . / scripts / substrate / federation - relay / node_modules /  / libp2p - noise / README.md
        . / scripts / substrate / federation - relay / node_modules /  / as - chacha20poly1305 / README.md
        . / scripts / substrate / federation - relay / node_modules /  / is - ip / CHANGELOG.md
        . / scripts / substrate / federation - relay / node_modules /  / is - ip / README.md
        . / scripts / substrate / federation - relay / node_modules /  / as - sha256 / README.md
        . / scripts / substrate / federation - relay / node_modules /  / netmask / README.md
        . / scripts / substrate / federation - relay / node_modules /  / curves / README.md
        . / scripts / substrate / federation - relay / node_modules /  / ciphers / README.md
        . / scripts / substrate / federation - relay / node_modules /  / hashes / README.md
        . / scripts / substrate / federation - relay / node_modules / it - merge / README.md
        . / scripts / substrate / federation - relay / node_modules / it - queueless - pushable / README.md
        . / scripts / substrate / federation - relay / node_modules / wherearewe / README.md
        . / scripts / substrate / federation - relay / node_modules / protons - runtime / node_modules / uint8arraylist / README.md
        . / scripts / substrate / federation - relay / node_modules / protons - runtime / node_modules / uint8 - varint / README.md
        . / scripts / substrate / federation - relay / node_modules / protons - runtime / node_modules / uint8arrays / node_modules / multiformats / README.md
        . / scripts / substrate / federation - relay / node_modules / protons - runtime / node_modules / uint8arrays / README.md
        . / scripts / substrate / federation - relay / node_modules / protons - runtime / README.md
        . / scripts / substrate / federation - relay / node_modules / ws / README.md
        . / scripts / substrate / federation - relay / node_modules / buffer / AUTHORS.md
        . / scripts / substrate / federation - relay / node_modules / buffer / README.md
        . / scripts / substrate / federation - relay / node_modules / utf8 - codec / README.md
        . / scripts / substrate / federation - relay / node_modules / uint8arrays / README.md
        . / scripts / substrate / federation - relay / node_modules / mortice / README.md
        . / scripts / substrate / federation - relay / node_modules / ms / README.md
        . / scripts / substrate / federation - relay / node_modules / ip - regex / readme.md
        . / scripts / substrate / federation - relay / node_modules / it - reader / README.md
        . / scripts / substrate / federation - relay / node_modules / it - stream - types / README.md
        . / scripts / substrate / federation - relay / node_modules / interface - store / README.md
        . / scripts / substrate / federation - relay / node_modules / it - filter / README.md
        . / scripts / substrate / federation - relay / node_modules / it - map / README.md
        . / scripts / substrate / federation - relay / node_modules / it - pipe / README.md
        . / scripts / substrate / federation - relay / node_modules / is - ip / readme.md
        . / scripts / substrate / federation - relay / node_modules / readable - stream / README.md
        . / scripts / substrate / federation - relay / node_modules / retimeable - signal / README.md
        . / scripts / substrate / federation - relay / node_modules / it - take / README.md
        . / scripts / substrate / federation - relay / node_modules / undici - types / README.md
        . / scripts / substrate / federation - relay / node_modules / it - to - browser - readablestream / README.md
        . / scripts / substrate / federation - relay / node_modules / event - target - shim / README.md
        . / scripts / substrate / federation - relay / node_modules / is - network - error / readme.md
        . / scripts / substrate / federation - relay / node_modules /  / http / README.md
        . / scripts / substrate / federation - relay / node_modules /  / peer - record / node_modules / protons - runtime / README.md
        . / scripts / substrate / federation - relay / node_modules /  / peer - record / README.md
        . / scripts / substrate / federation - relay / node_modules /  / circuit - relay - v2 / node_modules / protons - runtime / README.md
        . / scripts / substrate / federation - relay / node_modules /  / circuit - relay - v2 / README.md
        . / scripts / substrate / federation - relay / node_modules /  / dcutr / node_modules / protons - runtime / README.md
        . / scripts / substrate / federation - relay / node_modules /  / dcutr / README.md
        . / scripts / substrate / federation - relay / node_modules /  / http - peer - id - auth / node_modules / uint8 - varint / node_modules / uint8arraylist / README.md
        . / scripts / substrate / federation - relay / node_modules /  / http - peer - id - auth / node_modules / uint8 - varint / README.md
        . / scripts / substrate / federation - relay / node_modules /  / http - peer - id - auth / node_modules / uint8arrays / node_modules / multiformats / README.md
        . / scripts / substrate / federation - relay / node_modules /  / http - peer - id - auth / node_modules / uint8arrays / README.md
        . / scripts / substrate / federation - relay / node_modules /  / http - peer - id - auth / README.md
        . / scripts / substrate / federation - relay / node_modules /  / identify / node_modules / protons - runtime / README.md
        . / scripts / substrate / federation - relay / node_modules /  / identify / README.md
        . / scripts / substrate / federation - relay / node_modules /  / ping / README.md
        . / scripts / substrate / federation - relay / node_modules /  / utils / README.md
        . / scripts / substrate / federation - relay / node_modules /  / peer - collections / README.md
        . / scripts / substrate / federation - relay / node_modules /  / peer - id / README.md
        . / scripts / substrate / federation - relay / node_modules /  / logger / README.md
        . / scripts / substrate / federation - relay / node_modules /  / http - websocket / node_modules / uint8arrays / node_modules / multiformats / README.md
        . / scripts / substrate / federation - relay / node_modules /  / http - websocket / node_modules / uint8arrays / README.md
        . / scripts / substrate / federation - relay / node_modules /  / http - websocket / README.md
        . / scripts / substrate / federation - relay / node_modules /  / interface / README.md
        . / scripts / substrate / federation - relay / node_modules /  / http - utils / node_modules / uint8arrays / node_modules / multiformats / README.md
        . / scripts / substrate / federation - relay / node_modules /  / http - utils / node_modules / uint8arrays / README.md
        . / scripts / substrate / federation - relay / node_modules /  / http - utils / README.md
        . / scripts / substrate / federation - relay / node_modules /  / http - fetch / node_modules / uint8arrays / node_modules / multiformats / README.md
        . / scripts / substrate / federation - relay / node_modules /  / http - fetch / node_modules / uint8arrays / README.md
        . / scripts / substrate / federation - relay / node_modules /  / http - fetch / README.md
        . / scripts / substrate / federation - relay / node_modules /  / tcp / README.md
        . / scripts / substrate / federation - relay / node_modules /  / websockets / README.md
        . / scripts / substrate / federation - relay / node_modules /  / autonat / node_modules / protons - runtime / README.md
        . / scripts / substrate / federation - relay / node_modules /  / autonat / README.md
        . / scripts / substrate / federation - relay / node_modules /  / crypto / node_modules / protons - runtime / README.md
        . / scripts / substrate / federation - relay / node_modules /  / crypto / README.md
        . / scripts / substrate / federation - relay / node_modules /  / interface - internal / README.md
        . / scripts / substrate / federation - relay / node_modules /  / multistream - select / README.md
        . / scripts / substrate / federation - relay / node_modules /  / peer - store / node_modules / protons - runtime / README.md
        . / scripts / substrate / federation - relay / node_modules /  / peer - store / README.md
        . / scripts / substrate / federation - relay / node_modules / libp2p / README.md
        . / scripts / substrate / federation - relay / node_modules / it - peekable / README.md
        . / scripts / substrate / federation - relay / node_modules / is - loopback - addr / README.md
        . / scripts / substrate / federation - relay / node_modules / events / security.md
        . / scripts / substrate / federation - relay / node_modules / events / History.md
        . / scripts / substrate / federation - relay / node_modules / events / Readme.md
        . / scripts / substrate / federation - relay / node_modules / race - event / README.md
        . / scripts / substrate / federation - relay / node_modules / it - all / README.md
        . / scripts / substrate / federation - relay / node_modules / p - queue / readme.md
        . / scripts / substrate / federation - relay / node_modules / nanoid / README.md
        . / scripts / substrate / federation - relay / node_modules /  / fnv1a / readme.md
        . / scripts / substrate / federation - relay / node_modules / p - event / readme.md
        . / scripts / substrate / federation - relay / node_modules / random - int / readme.md
        . / scripts / substrate / federation - relay / node_modules / process / README.md
        . / scripts / substrate / federation - relay / node_modules / it - pushable / README.md
        . / scripts / substrate / federation - relay / node_modules / base64 - js / README.md
        . / scripts / substrate / federation - relay / node_modules / is - regexp / readme.md
        . / scripts / substrate / federation - relay / node_modules / netmask / CHANGELOG.md
        . / scripts / substrate / federation - relay / node_modules / netmask / README.md
        . / scripts / substrate / federation - relay / node_modules / netmask / LICENSE.md
        . / scripts / substrate / federation - relay / node_modules / cookie / README.md
        . / scripts / substrate / federation - relay / node_modules /  / ip - codec / Readme.md
        . / README.md
        . / CLAUDE.md
        . / substrate / gaps / pull - sync - testgate - baseline - degraded - development - vessel.md
        . / .claude / skills / deploy / SKILL.md
        . / .claude / skills / openspec - archive - change / SKILL.md
        . / .claude / skills / metabob - substrate / SKILL.md
        . / .claude / skills / openspec - apply - change / SKILL.md
        . / .claude / skills / openspec - explore / SKILL.md
        . / .claude / skills / openspec - propose / SKILL.md
        . / .claude / commands / opsx / archive.md
        . / .claude / commands / opsx / explore.md
        . / .claude / commands / opsx / apply.md
        . / .claude / commands / opsx / propose.md
        . / docs / learning / FAILURE_MODES.md
        . / docs / FOUNDATION_COMPLIANCE_CHECKS.md
        . / docs / API_V2_ACTIVITY.md
        . / docs / HUMAN_SURFACE.md
        . / docs / guides / ACTIVITY_LIFECYCLE_DEPRECATION.md
        . / docs / guides / CONCEPT_INTEGRATION_TEMPLATES.md
        . / docs / guides / CONCEPT_DB_INVESTIGATION.md
        . / docs / guides / ACTIVITY_TASK_CONTEXT_PROPAGATION.md
        . / docs / guides / CONDITIONAL_TASKS.md
        . / docs / guides / TEMPLATE_UPKEEP.md
        . / docs / guides / DASHBOARD_ANALYTICS.md
        . / docs / guides / INTERACTIVE_ACTIVITIES_AND_HUMAN_RESOLVER.md
        . / docs / guides / EXTERNAL_VALIDATION.md
        . / docs / operations / CONFIGURATION_SURFACE.md
        . / docs / operations / FEDERATION_GENRES.md
        . / docs / FEDERATION.md
        . / docs / SUBSTRATE_PRESENTATION_2026_06.md
        . / docs / impulse - types / thompson_posterior.md
        . / docs / impulse - types / LEARNING_LOOP_WRITE_RESOLVERS.md
        . / docs / architecture / LITERATURE_COMPARISON.md
        . / docs / architecture / SUBSTRATE_AS_FLEET.md
        . / docs / architecture / SUBSTRATE_AS_SOFTWARE.md
        . / docs / architecture / GOAL_EXECUTION_PATHS_SCHEMA.md
        . / docs / architecture / SUBSTRATE_AS_NETWORK.md
        . / docs / architecture / IMPULSE_STATE_SPACE_SPEC.md
        . / docs / architecture / TYPESCRIPT_VESSEL_TEMPLATE.md
        . / docs / architecture / SUBSTRATE_AS_REPRESENTATION.md
        . / docs / architecture / SUBSTRATE_AS_DYNAMICS.md
        . / docs / architecture / RESOLVER_TRACKING.md
        . / docs / architecture / IMPULSE_ACTIVITY_FOUNDATION.md
        . / docs / architecture / IMPULSE_CONFORMANCE_LEDGER.md
        . / docs / architecture / WORKBENCH_CHAIN_UX_DESIGN.md
        . / docs / architecture / sequences / 3 - resolver - processing.md
        . / docs / architecture / sequences / 2 - impulse - resolution.md
        . / docs / architecture / sequences / 5 - hooks - behavior - injection.md
        . / docs / architecture / sequences / README.md
        . / docs / architecture / sequences / 4 - improvisation - failure - modes.md
        . / docs / architecture / sequences / 1 - activity - selection.md
        . / docs / architecture / SUBSTRATE_AS_DEC.md
        . / docs / architecture / RUNTIME_ACTIVITY_TRACING.md
        . / docs / architecture / SUBSTRATE_AS_SOVEREIGN.md
        . / docs / architecture / SUBSTRATE_AS_MDP.md
        . / docs / architecture / SHAPE_ACTION_EVIDENCE_EXPECTATIONS.md
        . / docs / AUTH_JWT_CLAIMS.md
        . / docs / SUBSTRATE.md
        . / docs / validation / LEARNING_LOOP_SELFTEST.md
        . / docs / RBAC_TROUBLESHOOTING.md
        . / docs / self - development / DOC_INGESTION.md
        . / docs / specs / impulse - write - resolver.md
        . / docs / specs / activity - level - executor - hooks.md
        . / docs / specs / auth - token - source - field.md
        . / docs / RBAC_GUIDE.md
        . / docs / MEMORY_AS_SUBSTRATE.md
        . / docs / GLOSSARY.md
        . / docs / QUALIFICATION.md
        . / docs / SCHEMA_OWNERSHIP.md
        . / docs / README.md
        . / docs / LIVE_DEVELOPMENT.md
        . / docs / CORE_IDIOMS.md
        . / docs / SUBSTRATE_NARRATION_PROTOCOL.md
        . / docs / IDENTITY_VESSEL_CURL_EXAMPLES.md
        . / docs / shapes / README.md
        . / docs / testing / QUICK_VERIFICATION_GUIDE.md
        . / docs / testing / README.md.text().then(stdout => {
        resolve(stdout.trim().split('\n'));
    }).catch(error => reject(error)))
        ;
;
const report = {
    projectThreadScanReport: {
        execute: false,
        items: [],
    },
};
for (const file of files) {
    const content = (0, fs_1.readFileSync)(file, 'utf8');
    const projectName = path_1.default.basename(file, '.md');
    let open = 0;
    let closed = 0;
    let dispatched = 0;
    const lines = content.split('\n');
    for (const line of lines) {
        if (line.includes('[DISPATCHED]')) {
            dispatched++;
        }
        else if (line.startsWith('- [ ]')) {
            open++;
        }
        else if (line.startsWith('- [x]')) {
            closed++;
        }
    }
    report.projectThreadScanReport.items.push({
        project: projectName,
        tasks: {
            open,
            closed,
            dispatched,
        },
    });
}
(0, fs_1.writeFileSync)(reportFile, JSON.stringify(report, null, 2));
console.log();
//# sourceMappingURL=generate_report.js.map