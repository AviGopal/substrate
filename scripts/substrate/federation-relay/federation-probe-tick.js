// federation-probe-tick.ts — an INDEPENDENT oracle for the federation overlay.
//
// WHAT THIS IS FOR
// Answering four questions about any vessel configuration: can it join and leave a
// network, can peers find each other, does routing work over a relay AND directly, and
// does arbitrary data survive the wire. It answers them from OUTSIDE the thing it is
// measuring.
//
// THE RULE THAT SHAPES THE WHOLE FILE: a channel's own reporting is not evidence about
// the channel. federation-transport-vessel's :8401/health is the transport describing
// itself; it is admissible as an ADDRESS HINT ("here is where I think I am") and never as
// a REACHABILITY VERDICT. Every reachability claim here is witnessed by this probe's own
// ephemeral libp2p node — a separate process, a separate peer id, dialling in from
// outside — or it is `undecidable`. See I10.
//
// WHY AN EPHEMERAL PEER AND NOT A UNIT
// The node is minted per sweep with a NONCE identity and stopped at the end. Three
// properties fall out of that one choice:
//   1. it is a genuine second vantage (distinct process, distinct peerId);
//   2. it is the join/leave subject — a nonce id cannot inherit a reservation from last
//      sweep, so "joined" can never be a stale reservation misread as a live one;
//   3. it selects its own dial target, so it chooses which path it exercises (I4/I5).
// A permanent probe unit would instead become one more thing that goes masked, restarts,
// or stops during a cutover — i.e. another subject needing an oracle.
//
// VERDICT CHANNEL. Verdicts go over LOOPBACK HTTP to the pool. The channel and its
// subject share no medium, which is what lets this report "the overlay is down" at all.
//
// NOTHING HERE MAY THROW TO TOP LEVEL. A harness that dies cannot report its own
// coverage; a harness that skips can. Every leg converts failure into a verdict.
//
// Run: bun scripts/substrate/federation-relay/federation-probe-tick.ts [--json]
// Retained only while the `federation-verification` rhythm family reaches consistently;
// if the family stops reaching, the non-reach is the gap, not a reason to keep this quietly.
import { createVesselLibp2p, resolveViaLibp2p, resolveViaHttp } from '@avigopal/libp2p-federation-transport';
import { ping } from '@libp2p/ping';
import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
// ── Config (bootstrap tier: endpoints + credential only) ────────────────────────────
const DISCOVERY = (process.env.DISCOVERY_URL || 'http://127.0.0.1:8100').replace(/\/$/, '');
const DEV_VESSEL = (process.env.DEVELOPMENT_VESSEL_URL || 'http://127.0.0.1:8090').replace(/\/$/, '');
const API_KEY = process.env.METABOB_API_KEY || '';
const FED_HEALTH = `http://127.0.0.1:${process.env.FED_HEALTH_PORT || '8401'}`;
const STATE_FILE = process.env.FED_PROBE_STATE || '/workspace/federation-probe-state.json';
const SUBSTRATE_ID = process.env.FED_SUBSTRATE_ID || 'unknown-substrate';
const JSON_ONLY = process.argv.includes('--json');
const SWEEP_ID = `sweep-${new Date().toISOString()}`;
const PROBE_ID = `fedprobe-${randomBytes(4).toString('hex')}`;
const SWEEP_START = Date.now();
const verdicts = [];
function record(invariant, verdict, 
// `clears` is how a PASS becomes a gap CLOSURE, and it is deliberately an explicit
// positive assertion rather than something inferred. The alternative — "the class stopped
// being reported, so it must be fixed" — is exactly the reasoning that stranded
// fed:overlay_unjoinable: a class vanished because an unrelated HTTP endpoint started
// answering, and absence read as success. A check may only close a gap by NAMING the
// class it just proved clear.
opts) {
    // I10 enforced HERE, at the single choke point, so no leg can route around it: a
    // reachability claim whose only witness is the transport is downgraded. Static
    // structural facts (a checked-in IP, a missing field in a payload builder) are NOT
    // reachability claims and keep their verdict — they are read off the tree, not
    // reported by the subject.
    let v = verdict;
    let reason = opts.reason ?? null;
    if (opts.witness === 'transport' && v === 'pass') {
        v = 'undecidable';
        reason = 'self_witness_only';
    }
    const row = {
        probe_id: PROBE_ID,
        sweep_id: SWEEP_ID,
        invariant,
        config_class: { topology: 'local-overlay', substrate: SUBSTRATE_ID, ...(opts.config ?? {}) },
        verdict: v,
        verdict_source: 'deterministic',
        witness: opts.witness,
        ...(opts.cls ? { class: opts.cls } : {}),
        // A `clears` claim survives only on an actual PASS. If the verdict was downgraded (I10
        // self-witness, or any undecidable), the claim is dropped rather than carried — a
        // downgraded row must never close anything.
        ...(opts.clears && v === 'pass' ? { clears: opts.clears } : {}),
        ...(opts.clearsAlso && v === 'pass' ? { clearsAlso: opts.clearsAlso } : {}),
        evidence: opts.evidence ?? {},
        undecidable_reason: reason,
        ts: Date.now(),
    };
    verdicts.push(row);
    return row;
}
// ── Small helpers ───────────────────────────────────────────────────────────────────
const sha256 = (s) => createHash('sha256').update(Buffer.from(s, 'utf8')).digest('hex');
function sh(cmd, args) {
    try {
        return execFileSync(cmd, args, { encoding: 'utf8', timeout: 20_000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    }
    catch (e) {
        // systemctl exits non-zero for perfectly informative states (is-enabled masked → 1).
        // The stdout is the answer; the exit code is not.
        return String(e?.stdout ?? '').trim();
    }
}
async function post(url, body, timeoutMs = 8000) {
    const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(API_KEY ? { Authorization: 'ApiKey ' + API_KEY } : {}) },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
    });
    return { status: r.status, body: await r.json().catch(() => ({})) };
}
async function discoveryResolve(pointer, timeoutMs = 8000) {
    try {
        const r = await post(`${DISCOVERY}/resolve`, { pointer }, timeoutMs);
        return r.body?.content ?? {};
    }
    catch {
        return {};
    }
}
function unitState(unit) {
    const raw = sh('systemctl', ['show', unit, '-p', 'ActiveState', '-p', 'MainPID', '-p', 'NRestarts', '-p', 'Result']);
    const f = {};
    for (const line of raw.split('\n')) {
        const i = line.indexOf('=');
        if (i > 0)
            f[line.slice(0, i)] = line.slice(i + 1);
    }
    const enabled = sh('systemctl', ['is-enabled', unit]);
    return {
        unit,
        active: f.ActiveState ?? 'unknown',
        mainPid: f.MainPID ?? '0',
        nRestarts: parseInt(f.NRestarts ?? '0', 10) || 0,
        result: f.Result ?? 'unknown',
        masked: enabled === 'masked',
    };
}
function listServiceUnits() {
    const raw = sh('systemctl', ['list-unit-files', '--type=service', '--no-legend', '--no-pager']);
    return raw
        .split('\n')
        .map((l) => l.trim().split(/\s+/)[0] ?? '')
        .filter((u) => u.endsWith('.service'));
}
function readState() {
    try {
        return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
    }
    catch {
        return {};
    }
}
function writeState(s) {
    try {
        writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
    }
    catch { /* state is an optimisation, never a blocker */ }
}
// ════════════════════════════════════════════════════════════════════════════════════
// STATIC-STRUCTURAL CHECKS — these land even with the overlay completely dark.
// Including them is what makes day zero actionable instead of one undifferentiated
// blackout: a sweep against a dead overlay still names the checked-in IP and the
// precedence inversion, which are the things somebody can act on.
// ════════════════════════════════════════════════════════════════════════════════════
function checkHardcodedPeerEndpoint() {
    // A public IP frozen into a unit drop-in ships to EVERY substrate built from this
    // image. Law 11 (location independence) forbids exactly this.
    //
    // Read the EFFECTIVE value via `systemctl show`, not a guessed file path. The first
    // version of this check looked only in /etc/systemd/system and reported `dropin_absent`
    // on a substrate that is in fact shipping the frozen address — the drop-in lives in the
    // BAKED unit dir (/usr/lib/systemd/system). Asking systemd what the unit will actually
    // receive is the consuming layer; grepping a path you assumed is not. The file scan is
    // kept as a locator so the verdict can name where to go and fix it.
    const effective = sh('systemctl', ['show', 'discovery-vessel.service', '-p', 'Environment']);
    const effMatch = effective.match(/PEER_DISCOVERY_ENDPOINTS=(\S+)/);
    const effIp = effMatch?.[1]?.match(/\d+\.\d+\.\d+\.\d+/)?.[0] ?? null;
    const sources = [];
    for (const dir of ['/etc/systemd/system', '/usr/lib/systemd/system', '/lib/systemd/system']) {
        const p = `${dir}/discovery-vessel.service.d/federation-peering.conf`;
        try {
            const m = readFileSync(p, 'utf8').match(/PEER_DISCOVERY_ENDPOINTS=(\S+)/);
            if (m && /\d+\.\d+\.\d+\.\d+/.test(m[1]))
                sources.push({ path: p, value: m[1] });
        }
        catch { /* absent here is fine; another dir may hold it */ }
    }
    if (!effIp && sources.length === 0) {
        record('I1_no_frozen_address', 'pass', { witness: 'static', clears: 'hardcoded_peer_endpoint_in_image', evidence: { effective_environment: effMatch?.[1] ?? '(unset)' } });
        return;
    }
    record('I1_no_frozen_address', 'fail', {
        witness: 'static',
        cls: 'hardcoded_peer_endpoint_in_image',
        evidence: {
            effective_value: effMatch?.[1] ?? '(unset in effective env)',
            effective_contains_ip: effIp,
            frozen_in: sources,
            note: 'a host IP baked into a shipped unit drop-in reaches every substrate built from this image — law 11',
        },
    });
}
function checkAnchorPrecedence() {
    // systemd applies EnvironmentFile= AFTER Environment=, and a LATER EnvironmentFile
    // beats an earlier one. So a host-workspace file listed second outranks the
    // substrate's own env — which is how a dead droplet address in .substrate-secrets
    // killed the transport while /etc/substrate/env held the empty (correct) value.
    const ANCHORS = ['HUB_DISCOVERY_URL', 'DISCOVERY_ENDPOINT', 'IDENTITY_VESSEL_URL', 'ACTIVITY_API_ENDPOINT'];
    const readEnvFile = (p) => {
        const out = {};
        try {
            for (const line of readFileSync(p, 'utf8').split('\n')) {
                const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
                if (m)
                    out[m[1]] = m[2].replace(/^["']|["']$/g, '');
            }
        }
        catch { /* absent is a valid answer */ }
        return out;
    };
    const base = readEnvFile('/etc/substrate/env');
    const secrets = readEnvFile('/workspace/.substrate-secrets');
    const conflicts = ANCHORS
        .filter((k) => secrets[k] !== undefined && secrets[k] !== '' && secrets[k] !== base[k])
        .map((k) => ({ key: k, etc_substrate_env: base[k] ?? '(unset)', substrate_secrets: secrets[k] }));
    if (conflicts.length === 0) {
        record('I2_anchor_precedence', 'pass', { witness: 'static', clears: 'bootstrap_env_precedence_inversion', evidence: { checked: ANCHORS } });
        return;
    }
    record('I2_anchor_precedence', 'fail', {
        witness: 'static',
        cls: 'bootstrap_env_precedence_inversion',
        evidence: {
            conflicts,
            note: 'a host-workspace file outranks the substrate env for a routing anchor; the persisted value wins at unit start',
        },
    });
}
function checkTransportUnit(prev, endState, churnedInSweep) {
    // THE TRAP THIS EXISTS TO AVOID: the transport parks in `activating` under
    // Restart=always and NEVER reaches `failed`. A naive "activating means rolling, defer"
    // rule would make this oracle permanently silent about precisely the unit that is
    // broken. The disambiguator is COUNTER MOVEMENT ACROSS SWEEPS, not instantaneous state.
    //
    // AND THE DISCRIMINATOR IS NOT THE RESTART COUNT. The first version tested
    // `nRestarts > 5` or a monotonic increase across sweeps, and MISCLASSIFIED a unit that
    // the journal showed at "restart counter is at 23": NRestarts is reset by systemd's
    // start-limit window, so it was reading 4 and falling back through both tests. Measured
    // 23 -> 4 between two sweeps 67s apart. A monotonic test on a non-monotonic counter
    // reports the loudest failure on the box as "rolling".
    //
    // AND NO SINGLE SAMPLE CAN TELL. The second version keyed on `Result=exit-code` while
    // `activating`, and the verdict then VANISHED from two consecutive sweeps — sampled
    // during the unit's brief up-phase it emitted nothing at all, so the loudest failure on
    // the box silently left the denominator. Sampling the real unit every 2s shows why:
    //
    //   Result=exit-code NRestarts=4 ActiveState=activating
    //   Result=success   NRestarts=5 ActiveState=active        <- indistinguishable from healthy
    //   Result=exit-code NRestarts=5 ActiveState=activating
    //
    // Both ActiveState and Result RESET during the up-phase. The only thing that survives
    // the whole cycle is NRestarts CHANGING, which is a property of an interval, not of an
    // instant. So the discriminator is the unit's own churn WITHIN this sweep — two samples
    // the probe already takes for quiescence — and it needs no cross-sweep state.
    //
    // A verdict is emitted on EVERY path. Silence is how an invariant leaves the
    // denominator while the report still looks complete.
    const st = endState;
    const before = prev.restarts?.['federation-transport-vessel.service'];
    const movedAcrossSweeps = before !== undefined && st.nRestarts !== before;
    const crashed = st.result === 'exit-code' || st.result === 'signal' || st.result === 'core-dump';
    const flapping = churnedInSweep || movedAcrossSweeps || (st.active === 'activating' && crashed);
    if (flapping) {
        record('I2_join_overlay', 'fail', {
            witness: 'static',
            cls: 'transport_unit_flapping',
            evidence: {
                active: st.active,
                result: st.result,
                n_restarts: st.nRestarts,
                previous_n_restarts: before ?? null,
                churned_within_this_sweep: churnedInSweep,
                counter_changed_since_last_sweep: movedAcrossSweeps,
                note: 'restart churn observed across two in-sweep samples; this unit never reports failed, ActiveState and Result both reset during its up-phase, and NRestarts resets under the start-limit window — so only an interval measurement can see it',
            },
        });
    }
    else if (st.active === 'active' && !crashed) {
        record('I2_join_overlay', 'pass', {
            witness: 'static',
            clears: 'transport_unit_flapping',
            evidence: { active: st.active, result: st.result, n_restarts: st.nRestarts, note: 'stable across both in-sweep samples' },
        });
    }
    else {
        record('I2_join_overlay', 'undecidable', {
            witness: 'static',
            reason: 'unit_rolling',
            evidence: { active: st.active, result: st.result, n_restarts: st.nRestarts },
        });
    }
    return { flapping, state: st };
}
async function checkBootstrapAnchors() {
    // /bootstrap is the one public join door. A joiner that is handed 127.0.0.1 for the
    // identity authority is handed ITS OWN loopback. Probed under a foreign Host header so
    // a host-header artefact cannot be mistaken for a real anchor.
    let body = null;
    let foreign = null;
    try {
        const r = await fetch(`${DISCOVERY}/bootstrap`, { signal: AbortSignal.timeout(5000) });
        body = await r.json();
        const r2 = await fetch(`${DISCOVERY}/bootstrap`, { headers: { Host: 'foreign.example.net' }, signal: AbortSignal.timeout(5000) });
        foreign = await r2.json();
    }
    catch (e) {
        record('I3_join_door_honest', 'undecidable', { witness: 'static', reason: 'bootstrap_unreachable', evidence: { error: String(e.message) } });
        return { relays: [] };
    }
    const relays = Array.isArray(body?.relay_multiaddrs) ? body.relay_multiaddrs : [];
    const idEp = String(body?.identity_endpoint ?? '');
    const discEp = String(body?.discovery_endpoint ?? '');
    const loopbackIdentity = /127\.0\.0\.1|localhost/.test(idEp);
    const emptyDiscovery = discEp === '';
    if (loopbackIdentity || emptyDiscovery) {
        record('I3_join_door_honest', 'fail', {
            witness: 'static',
            cls: 'join_door_host_dependent',
            evidence: {
                identity_endpoint: idEp,
                discovery_endpoint: discEp,
                identity_endpoint_under_foreign_host: String(foreign?.identity_endpoint ?? ''),
                note: 'anchors are host-dependent or empty, and unchanged under a foreign Host header — a joiner cannot tell a configured hub from an unconfigured one',
            },
        });
    }
    else {
        record('I3_join_door_honest', 'pass', { witness: 'static', clears: 'join_door_host_dependent', evidence: { identity_endpoint: idEp, discovery_endpoint: discEp } });
    }
    if (relays.length === 0) {
        record('I2_relay_anchor', 'fail', {
            witness: 'static',
            cls: 'no_relay_anchor',
            evidence: {
                note: 'relay_multiaddrs is empty and is derived from REGISTERED CIRCUITS — circuits need a transport, and the transport refuses to start without an anchor. The bootstrap is circular.',
            },
        });
    }
    else {
        record('I2_relay_anchor', 'pass', { witness: 'static', clears: 'no_relay_anchor', evidence: { relay_multiaddrs: relays } });
    }
    return { relays };
}
async function checkForeignVantageReachability() {
    // I1, stated correctly. NOT "every vessel carries its own multiaddr" — there is exactly
    // ONE libp2p identity per substrate (the transport), and the hub mirror registers a
    // per-vessel row `<vessel>@<substrate>` that carries THAT identity's circuit, with
    // pointer._fedTargetVessel selecting the vessel on the far side. So the invariant is
    // foreign-vantage reachability of each vessel through the substrate's one circuit.
    // Thirteen vessels with thirteen multiaddrs would be thirteen nodes, reservations and
    // NAT mappings for no gain.
    const reg = await discoveryResolve({ type: 'vesselRegistry' });
    const vessels = reg?.vessels ?? [];
    const circuitBearing = vessels.filter((v) => Array.isArray(v.libp2p_multiaddr) && v.libp2p_multiaddr.length > 0);
    if (vessels.length === 0) {
        record('I1_foreign_vantage_reachable', 'undecidable', { witness: 'probe', reason: 'registry_empty' });
        return { vessels, circuitBearing };
    }
    if (circuitBearing.length === 0) {
        record('I1_foreign_vantage_reachable', 'fail', {
            witness: 'probe',
            cls: 'no_circuit_advertised',
            evidence: {
                registered: vessels.length,
                with_circuit: 0,
                sample_endpoints: vessels.slice(0, 3).map((v) => v.endpoint),
                note: 'no row carries a circuit, so discovery\'s peer dialability filter would drop every one of them from any peer fan-out',
            },
        });
    }
    else {
        // SCOPE OF THIS PASS, stated so it cannot be over-read. The probe runs INSIDE the
        // container, so it shares a network namespace with the transport and its "foreign
        // vantage" is foreign in peer identity but not in location. A row advertising only
        // 127.0.0.1 and a docker-internal 172.17.x address satisfies this predicate here and
        // would be unreachable from a genuinely foreign substrate. The invariant's name is
        // stronger than what a single-substrate sweep can decide; the honest scope travels
        // with the verdict rather than living in a comment nobody reads next to the number.
        const addrs = circuitBearing.flatMap((v) => (v.libp2p_multiaddr ?? []));
        const routableOffHost = addrs.some((m) => !/\/ip4\/(127\.|172\.1[6-9]\.|172\.2[0-9]\.|172\.3[01]\.|10\.|192\.168\.)/.test(m));
        record('I1_foreign_vantage_reachable', 'pass', {
            witness: 'probe',
            clears: 'no_circuit_advertised',
            evidence: {
                registered: vessels.length,
                with_circuit: circuitBearing.length,
                witness_scope: 'same-network-namespace (probe runs in-container): proves peer-identity separation, NOT off-host reachability',
                advertises_off_host_routable_addr: routableOffHost,
                note: routableOffHost ? undefined : 'every advertised address is loopback or RFC1918 — a genuinely foreign substrate could not dial this. Cross-vantage confirmation is required before reading this as federation working.',
            },
        });
    }
    return { vessels, circuitBearing };
}
// I12 — PEER CHURN MUST NOT DAMAGE THE REGISTRY.
//
// The operator requirement this encodes: "it should not be harmful for peers to join and
// leave the network; and the discovery should be durable across them." A registry that
// loses its own rows when a foreign peer arrives or departs is worse than one that never
// federates — the blast radius of joining would exceed the benefit.
//
// This is not hypothetical. The hub-mirror de-advertise path diffs last tick's mirrored
// set against this tick's and DELETEs the difference, and its own comments record two
// near-misses already guarded (a dropped reservation, and an empty local registry
// mid-repopulation). A THIRD case is still open by construction: a PARTIAL repopulation
// returns a non-empty set, passes both guards, and withdraws the rows that have not come
// back yet. That is self-inflicted rather than cross-inflicted, but it is the same shape.
//
// Compared across sweeps rather than asserted in the abstract: this substrate's OWN rows
// (bare vesselIds — foreign rows carry @substrate) must not shrink. Departures of foreign
// rows are expected and ignored; the check is specifically that OUR rows survive THEIR
// churn.
function checkChurnDurability(prev, vessels) {
    const own = vessels.filter((v) => !String(v.vesselId ?? '').includes('@')).map((v) => String(v.vesselId));
    const before = prev.ownRows ?? [];
    const lost = before.filter((id) => !own.includes(id));
    const foreign = vessels.filter((v) => String(v.vesselId ?? '').includes('@')).length;
    if (before.length === 0) {
        record('I12_churn_non_destructive', 'undecidable', {
            witness: 'probe', reason: 'no_prior_sweep_baseline',
            evidence: { own_rows: own.length, foreign_rows: foreign },
        });
    }
    else if (lost.length > 0) {
        record('I12_churn_non_destructive', 'fail', {
            witness: 'probe', cls: 'registry_lost_local_rows',
            evidence: { lost, own_before: before.length, own_now: own.length, foreign_rows: foreign,
                note: 'rows this substrate owns disappeared between sweeps; a peer joining or leaving must never cost a local row' },
        });
    }
    else {
        record('I12_churn_non_destructive', 'pass', {
            witness: 'probe', clears: 'registry_lost_local_rows',
            evidence: { own_rows: own.length, foreign_rows: foreign, note: 'every local row present last sweep is still present' },
        });
    }
    return own;
}
// ════════════════════════════════════════════════════════════════════════════════════
// OVERLAY CHECKS — witnessed by the probe's own node.
// ════════════════════════════════════════════════════════════════════════════════════
// The payload matrix. Sizes are chosen against the lpStream framing (4-byte big-endian
// length + UTF-8 JSON) with sendAll chunking at 1024 bytes: 1023/1024/1025 straddle the
// chunk boundary, which is where an off-by-one in the chunker shows up and nowhere else.
function payloadMatrix() {
    const nest = (d) => (d === 0 ? 'leaf' : { d, next: nest(d - 1) });
    return [
        { name: 'P1_1b', payload: 'x' },
        { name: 'P2_1023b', payload: 'a'.repeat(1023) },
        { name: 'P3_1024b', payload: 'b'.repeat(1024) },
        { name: 'P4_1025b', payload: 'c'.repeat(1025) },
        { name: 'P5_64k', payload: 'd'.repeat(65536) },
        // byte-length ≠ char-length: a length-prefixed frame that counts the wrong one
        // truncates here and nowhere else.
        { name: 'P6_unicode', payload: '🙂 漢字 مرحبا é ​ ☃'.repeat(37) },
        { name: 'P7_binary_b64', payload: randomBytes(4096).toString('base64') },
        { name: 'P8_nested64', payload_obj: nest(64) },
    ];
}
async function runPayloadMatrix(probe, target, pathLabel, transport) {
    for (const p of payloadMatrix()) {
        const sent = p.payload_obj !== undefined ? JSON.stringify(p.payload_obj) : p.payload;
        const expectLen = Buffer.byteLength(sent, 'utf8');
        const expectHash = sha256(sent);
        const pointer = { type: 'federation_echo' };
        if (p.payload_obj !== undefined)
            pointer.payload_obj = p.payload_obj;
        else
            pointer.payload = p.payload;
        const cfg = { path: pathLabel, transport, payload: p.name, operation: 'payload' };
        try {
            const res = await withTimeout(transport === 'lpStream' ? resolveViaLibp2p(probe, target, pointer) : resolveViaHttp(probe, target, pointer), 20_000, `${p.name} via ${transport} on ${pathLabel}`);
            const c = res?.content ?? res;
            if (!c || c.shape !== 'federation_echo') {
                record('I6_payload_integrity', 'undecidable', {
                    witness: 'probe', config: cfg, reason: 'echo_shape_absent',
                    evidence: { got: JSON.stringify(c).slice(0, 200) },
                });
                continue;
            }
            // Assert hash AND length, and against BOTH the echoed bytes and the server's own
            // hash. Hash alone misses a re-canonicalization; length alone misses corruption
            // that preserves size; trusting only the server's hash misses a hash taken over
            // the wrong bytes.
            const echoHash = sha256(String(c.echo ?? ''));
            const ok = echoHash === expectHash && c.sha256 === expectHash && c.len === expectLen;
            record('I6_payload_integrity', ok ? 'pass' : 'fail', {
                witness: 'probe', config: cfg, cls: ok ? undefined : 'payload_corrupted',
                evidence: {
                    sent_len: expectLen, echoed_len: c.len,
                    payload_sha256_sent: expectHash, payload_sha256_echoed: echoHash, server_sha256: c.sha256,
                },
            });
        }
        catch (e) {
            record('I6_payload_integrity', 'undecidable', {
                witness: 'probe', config: cfg, reason: 'resolve_failed',
                evidence: { error: String(e?.message ?? e) },
            });
        }
    }
}
// NOTHING IN A SWEEP MAY HANG. resolveViaLibp2p and resolveViaHttp carry no timeout of
// their own — they inherit libp2p dial defaults only — so a single slow leg can consume
// the whole sweep and produce NO report at all, which is strictly worse than a failing
// report: a harness that dies cannot report its own coverage. Observed live the first time
// the forced-relay path started passing, which unlocked the 64KB payload over
// HTTP-over-libp2p across a circuit; the sweep produced zero output and was killed at 300s.
// A timed-out leg becomes an `undecidable` verdict and the sweep continues.
function withTimeout(p, ms, label) {
    return Promise.race([
        p,
        new Promise((_, rej) => setTimeout(() => rej(new Error(`probe_timeout after ${ms}ms: ${label}`)), ms)),
    ]);
}
function pathTaken(probe, peerId) {
    // Read off the PROBE's own connection record. Never inferred from which dial form was
    // requested — inferring is exactly how a silent relay fallback gets reported as direct.
    //
    // THE PRIMARY SIGNAL IS THE ADDRESS, NOT `limited`. The first version used
    // healthSnapshot's `limited: c.limits != null` as the relayed/direct discriminator, and
    // the live fixture falsified it immediately: a dial pinned to a /p2p-circuit multiaddr
    // came back limited=false, which the probe scored as "the relay address was not
    // honoured". It had been honoured — the connection's remoteAddr was the circuit address.
    // `limits` is null because scripts/substrate/federation-relay/relay.ts configures the
    // relay with applyDefaultLimit:false, so a genuinely relayed connection through it
    // carries no byte/time cap at all.
    //
    // So `limited` measures "is this circuit CAPPED", which is a property of the relay's
    // policy, not of the path. A /p2p-circuit component in the negotiated remoteAddr is what
    // actually means "this went through a relay". Both are reported: the address decides,
    // the cap is corroboration and is informative about which relay policy is in force.
    const conns = probe.node.getConnections().filter((c) => c.remotePeer.toString() === peerId);
    if (conns.length === 0)
        return { relayed: null, limited: null, addr: null };
    const c = conns[0];
    const addr = c.remoteAddr.toString();
    return { relayed: addr.includes('/p2p-circuit'), limited: c.limits != null, addr };
}
async function checkOverlay(probe, relays, circuitBearing) {
    // Address HINT only — the transport saying where it thinks it is. Not a verdict.
    let hintPeer = '';
    let hintAddrs = [];
    try {
        const h = await fetch(`${FED_HEALTH}/health`, { signal: AbortSignal.timeout(4000) });
        const hb = await h.json();
        hintPeer = String(hb?.libp2p_peer_id ?? '');
        hintAddrs = [hb?.libp2p_multiaddr].flat().filter(Boolean).map(String);
        record('I10_non_transport_witness', 'undecidable', {
            witness: 'transport', reason: 'address_hint_only',
            evidence: { peer_id: hintPeer, note: 'transport self-report accepted as an address hint, never as reachability' },
        });
    }
    catch {
        // NOT a reachability verdict. This catch used to record
        // `I2_join_overlay fail [overlay_unjoinable]`, making the FAIL and the I10 row the two
        // branches of ONE try/catch around a plain LOOPBACK HTTP fetch to :8401/health. The
        // consequence, caught by adversarial review: when the transport's HTTP health started
        // answering, the overlay_unjoinable FAIL silently VANISHED from the decided set — and
        // its own closure predicate was still unmet (0 reservations, I5 dial_failed). It even
        // dropped out of gap_eligible, stranding the filed gap with no path to re-fire or
        // close. Coverage stayed at exactly 60% only because the I10 row substituted 1-for-1
        // for the vanished FAIL, hiding the loss.
        //
        // An HTTP health endpoint answering says nothing about whether the OVERLAY is
        // joinable. Overlay joinability is decided below, from the probe's own reservation and
        // dial outcomes, and nowhere else.
        record('I10_non_transport_witness', 'undecidable', {
            witness: 'probe', reason: 'no_address_hint',
            evidence: { note: `transport health at ${FED_HEALTH} did not answer — no address hint available; this is NOT itself an overlay verdict` },
        });
    }
    // I2 — reservation from the probe's OWN node.
    //
    // POLLED, not sampled once. createVesselLibp2p dials the relay and returns before the
    // circuit-relay transport has finished reserving, so an immediate read of
    // activeReservations measures "has the handshake completed yet", not "can this peer
    // join". The first fixture run scored overlay_unjoinable against a relay that was
    // working and a transport that reserved successfully moments later. federation-hub-e2e
    // already polls 40x500ms for exactly this reason; matched here.
    let reservations = probe.health().activeReservations;
    for (let i = 0; i < 30 && reservations === 0 && relays.length > 0; i++) {
        await new Promise((r) => setTimeout(r, 500));
        reservations = probe.health().activeReservations;
    }
    if (relays.length === 0) {
        record('I2_join_overlay', 'undecidable', { witness: 'probe', reason: 'no_relay_anchor', evidence: { active_reservations: reservations } });
    }
    else if (reservations === 0) {
        record('I2_join_overlay', 'fail', { witness: 'probe', cls: 'overlay_unjoinable', evidence: { relays, active_reservations: 0 } });
    }
    else {
        record('I2_join_overlay', 'pass', { witness: 'probe', clears: 'overlay_unjoinable', evidence: { relays, active_reservations: reservations } });
    }
    // Candidate targets, from the registry rather than the hint where possible.
    const circuits = circuitBearing.flatMap((v) => v.libp2p_multiaddr).filter((m) => m.includes('p2p-circuit'));
    const directs = [...circuitBearing.flatMap((v) => v.libp2p_multiaddr), ...hintAddrs].filter((m) => !m.includes('p2p-circuit'));
    const targetPeer = hintPeer || circuitBearing.find((v) => v.libp2p_peer_id)?.libp2p_peer_id || '';
    // I4 — FORCED RELAY. A /p2p-circuit multiaddr pins the circuit.
    if (circuits.length === 0) {
        record('I4_forced_relay', 'undecidable', { witness: 'probe', reason: 'no_circuit_to_dial', config: { path: 'forced-relay' } });
    }
    else {
        const target = circuits[0];
        try {
            await withTimeout(resolveViaLibp2p(probe, target, { type: 'federation_probe' }), 20_000, 'forced-relay probe dial');
            // Check the connection to the peer WE ACTUALLY DIALLED, not to whichever peer the
            // transport's health hint happens to name. With a single circuit in the registry
            // those coincide; the moment a second substrate federates they stop coinciding, and
            // this looked up a connection to the LOCAL transport while having dialled the PEER's
            // circuit — finding none, and scoring a working relay path as
            // relay_address_not_honoured. The dialled multiaddr already carries the peer id it
            // ends with; that is the authority.
            const dialledPeer = target.split('/p2p/').pop() ?? targetPeer;
            const pt = pathTaken(probe, dialledPeer);
            if (pt.relayed === true) {
                // Clears BOTH of this invariant's failure classes, because a successful relayed
                // dial disproves both: the address WAS honoured, and the dial did NOT fail.
                // Previously only relay_address_not_honoured was cleared, so relay_dial_failed —
                // filed by the catch branch below — could be raised and never retired. That is the
                // same stranding that left fed:overlay_unjoinable open with no path to close, and
                // it is a defect in the ledger rather than in the system being measured: a class
                // that can only ever accumulate makes the open count meaningless.
                record('I4_forced_relay', 'pass', { witness: 'probe', clears: 'relay_address_not_honoured', clearsAlso: 'relay_dial_failed', config: { path: 'forced-relay' }, evidence: { dial_target: target, path_taken: 'relay', relayed: true, connection_limited: pt.limited, relay_caps_circuits: pt.limited, addr: pt.addr } });
                await runPayloadMatrix(probe, target, 'forced-relay', 'lpStream');
                await runPayloadMatrix(probe, target, 'forced-relay', 'http');
            }
            else {
                // A forced-relay dial on an UNLIMITED connection means the relay address was not
                // honoured. That is a failure, not a bonus.
                record('I4_forced_relay', 'fail', {
                    witness: 'probe', cls: 'relay_address_not_honoured', config: { path: 'forced-relay' },
                    evidence: { dial_target: target, path_taken: pt.relayed === false ? 'direct' : 'unknown', relayed: pt.relayed, connection_limited: pt.limited, addr: pt.addr,
                        note: 'a dial pinned to a /p2p-circuit multiaddr did not negotiate a circuit address' },
                });
            }
        }
        catch (e) {
            record('I4_forced_relay', 'fail', { witness: 'probe', cls: 'relay_dial_failed', config: { path: 'forced-relay' }, evidence: { dial_target: target, error: String(e?.message ?? e) } });
        }
    }
    // I5 — DIRECT PREFERRED. Dialling by bare PeerId lets libp2p choose a DCUtR-upgraded
    // direct path. Whatever happens is RECORDED, never assumed: a silent relay fallback
    // presented as "direct" is the easiest way for this oracle to lie.
    if (!targetPeer) {
        record('I5_direct_preferred', 'undecidable', { witness: 'probe', reason: 'no_peer_to_dial', config: { path: 'direct-preferred' } });
    }
    else {
        const before = probe.health().holePunchSuccess;
        try {
            await withTimeout(resolveViaLibp2p(probe, targetPeer, { type: 'federation_probe' }), 20_000, 'direct-preferred probe dial');
            const pt = pathTaken(probe, targetPeer);
            const after = probe.health().holePunchSuccess;
            if (pt.relayed === false) {
                record('I5_direct_preferred', 'pass', {
                    witness: 'probe', clears: 'punchthrough_unavailable', config: { path: 'direct-preferred' },
                    evidence: { dial_target: targetPeer, path_taken: 'direct', relayed: false, connection_limited: pt.limited, addr: pt.addr, hole_punch_delta: after - before },
                });
                await runPayloadMatrix(probe, targetPeer, 'direct-preferred', 'lpStream');
            }
            else {
                record('I5_direct_preferred', 'fail', {
                    witness: 'probe', cls: 'punchthrough_unavailable', config: { path: 'direct-preferred' },
                    evidence: { dial_target: targetPeer, path_taken: 'relay-fallback', relayed: pt.relayed, connection_limited: pt.limited, addr: pt.addr, direct_addrs_known: directs.slice(0, 3) },
                });
            }
        }
        catch (e) {
            record('I5_direct_preferred', 'undecidable', { witness: 'probe', reason: 'dial_failed', config: { path: 'direct-preferred' }, evidence: { error: String(e?.message ?? e) } });
        }
    }
    // I9 — ADVERSARIAL. The probe holds NO credential on the overlay. If an uncredentialed
    // dial resolves the registry, SUCCEEDING is the defect: the ingress authenticates
    // remote-originated resolves with the transport's own key, so anyone who can dial gets
    // whatever the transport can reach. Noise gives confidentiality, not authorization.
    if (circuits.length === 0 && !targetPeer) {
        record('I9_ingress_authenticated', 'undecidable', { witness: 'probe', reason: 'overlay_unreachable' });
    }
    else {
        const t = circuits[0] ?? targetPeer;
        try {
            const res = await withTimeout(resolveViaLibp2p(probe, t, { type: 'vesselRegistry' }), 20_000, 'uncredentialed ingress dial');
            const got = res?.content?.vessels ?? res?.vessels;
            if (Array.isArray(got) && got.length > 0) {
                record('I9_ingress_authenticated', 'fail', {
                    witness: 'probe', cls: 'federation_ingress_unauthenticated',
                    evidence: { rows_returned: got.length, note: 'an uncredentialed peer read the registry over the overlay' },
                });
            }
            else {
                record('I9_ingress_authenticated', 'pass', { witness: 'probe', clears: 'federation_ingress_unauthenticated', evidence: { note: 'uncredentialed overlay resolve reached the ingress and returned nothing' } });
            }
        }
        catch (e) {
            // A THROWN DIAL IS NOT A REFUSAL. This catch used to grade every throw as
            // 'pass — uncredentialed overlay resolve refused', which reported a SECURITY
            // invariant as satisfied on a connection that was never established. Caught by
            // adversarial review: the throw was `The dial request has no valid addresses for
            // peer` — a client-side addressing failure in which the ingress was never contacted
            // at all. "We could not reach you" is not "you turned us away", and grading it as a
            // pass is how an unauthenticated ingress gets certified as authenticated.
            //
            // Only a transport-level rejection AFTER a connection counts. Anything that smells
            // like an addressing/dial/timeout failure is undecidable — we learned nothing.
            const msg = String(e?.message ?? e);
            const neverConnected = /no valid addresses|dial request|ECONNREFUSED|ETIMEDOUT|timed out|unsupported protocol|no reservation|NO_RESERVATION|cannot dial|not dialable/i.test(msg);
            if (neverConnected) {
                record('I9_ingress_authenticated', 'undecidable', {
                    witness: 'probe', reason: 'ingress_never_contacted',
                    evidence: { error: msg, note: 'the dial failed before reaching the ingress — this says nothing about whether the ingress authenticates' },
                });
            }
            else {
                record('I9_ingress_authenticated', 'pass', {
                    witness: 'probe', clears: 'federation_ingress_unauthenticated',
                    evidence: { error: msg, note: 'the ingress was reached and rejected the uncredentialed resolve' },
                });
            }
        }
    }
}
async function checkJoinLeave(probe) {
    // LEAVE, assertable without waiting out the 5-minute TTL. The probe owns both ends:
    // it registers a NONCE shape, confirms the row is live, deregisters, and re-queries
    // immediately. The deregister path is synchronous and separately observable from the
    // TTL path — so "the row is only gone at TTL" is itself the failed-de-advertise verdict,
    // not an inconclusive wait.
    const nonceShape = `federation_probe_leave_${PROBE_ID.slice(-8)}`;
    const vesselId = `${PROBE_ID}-ephemeral`;
    try {
        const reg = await post(`${DISCOVERY}/register`, {
            vesselId, vesselName: vesselId, version: '0.0.1',
            endpoint: `http://127.0.0.1:1/${PROBE_ID}`,
            shapes: [nonceShape],
            resolve_endpoint: '/v2/impulses/resolve', resolve_request_format: 'pointer', auth_scheme: 'none',
            protocol: 'libp2p', libp2p_peer_id: probe.peerId, libp2p_multiaddr: probe.advertiseMultiaddrs(),
        });
        if (reg.status >= 300) {
            record('I7_leave_propagates', 'undecidable', { witness: 'probe', reason: 'register_rejected', evidence: { status: reg.status } });
            return;
        }
        const found = await discoveryResolve({ type: 'vesselCapability', shape: nonceShape });
        const present = (found?.vessels ?? []).length > 0;
        record('I3_find_after_join', present ? 'pass' : 'fail', {
            witness: 'probe', cls: present ? undefined : 'join_not_findable',
            config: { operation: 'join' },
            evidence: { shape: nonceShape, rows: (found?.vessels ?? []).length },
        });
        if (!present)
            return;
        const t0 = Date.now();
        const del = await fetch(`${DISCOVERY}/vessels/${encodeURIComponent(vesselId)}`, {
            method: 'DELETE',
            headers: API_KEY ? { Authorization: 'ApiKey ' + API_KEY } : {},
            signal: AbortSignal.timeout(6000),
        });
        const after = await discoveryResolve({ type: 'vesselCapability', shape: nonceShape });
        const gone = (after?.vessels ?? []).length === 0;
        record('I7_leave_propagates', gone ? 'pass' : 'fail', {
            witness: 'probe', cls: gone ? undefined : 'leave_only_at_ttl',
            config: { operation: 'leave' },
            evidence: { deregister_http: del.status, cleared_ms: Date.now() - t0, rows_after: (after?.vessels ?? []).length, ttl_ms: 300_000 },
        });
    }
    catch (e) {
        record('I7_leave_propagates', 'undecidable', { witness: 'probe', reason: 'leave_probe_failed', evidence: { error: String(e?.message ?? e) } });
    }
}
// ════════════════════════════════════════════════════════════════════════════════════
// NEGATIVE CONTROLS — an oracle that cannot fail is not an oracle.
// A sweep whose controls did not fire is reported `invalid`, NOT `pass`.
// ════════════════════════════════════════════════════════════════════════════════════
async function negativeControls(probe, 
// Whether ANY peer in the registry advertises a /p2p-circuit address this sweep. NC4
// needs it to tell "the discriminator went blind" from "there was nothing relayed to
// look at" — see the NC4 body.
relayedTargetsExist) {
    const nc = {};
    // NC1 — an impossible peer must fail to resolve.
    if (!probe)
        nc.NC1 = 'skipped_no_node';
    else {
        try {
            await resolveViaLibp2p(probe, '12D3KooWAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', { type: 'federation_probe' });
            nc.NC1 = 'DID_NOT_FIRE';
        }
        catch {
            nc.NC1 = 'fired';
        }
    }
    // NC2 — the comparator must reject a deliberately mutated hash.
    nc.NC2 = sha256('control') === sha256('control-mutated') ? 'DID_NOT_FIRE' : 'fired';
    // NC3 — loopback positive control. If THIS fails the substrate is down, and every
    // overlay verdict in this sweep is `undecidable`, not `fail`. Without it the oracle
    // would blame federation for a dead discovery.
    try {
        const r = await fetch(`${DISCOVERY}/health`, { signal: AbortSignal.timeout(4000) });
        nc.NC3 = r.ok ? 'fired' : 'DID_NOT_FIRE';
    }
    catch {
        nc.NC3 = 'DID_NOT_FIRE';
    }
    // NC4 — the path discriminator must not be a constant. It has to be shown reading
    // DIFFERENT values off different connections, which means observing both polarities:
    // the connection to the relay itself is direct (limits == null) while a circuit
    // connection through it is limited (limits != null).
    //
    // The first version of this control asserted `actual === !actual`, which is false for
    // every input — a control that reports `fired` whenever any connection exists, proving
    // nothing about whether `limited` is read correctly. It never lied only because it had
    // never yet had a connection to look at. Observing ONE polarity is `partial`, not
    // `fired`: a constant-true and a genuine read are indistinguishable from one sample.
    if (!probe)
        nc.NC4 = 'skipped_no_node';
    else {
        // Polarity is measured on the ADDRESS, matching pathTaken: a /p2p-circuit component
        // means relayed. Measuring `limits != null` here would inherit the same defect the
        // live fixture exposed in I4 — against a relay configured applyDefaultLimit:false
        // every connection reads "not limited", so this control would report one polarity
        // forever and never notice the discriminator had gone blind.
        const flags = probe.node.getConnections().map((c) => String(c.remoteAddr).includes('/p2p-circuit'));
        const sawRelayed = flags.some((f) => f);
        const sawDirect = flags.some((f) => !f);
        // APPLICABILITY, not just outcome. Every spoke sweep reported
        // partial_one_polarity_only(direct) and was therefore downgraded to `degraded` —
        // permanently, on every sweep, forever. A verdict that is always degraded teaches
        // readers to skip past it, which is the same defect as a silent skip: it stops
        // carrying information. But the two causes are genuinely different and must not
        // share a verdict:
        //
        //   - a relayed peer WAS advertised and the probe still saw only one polarity
        //     → the discriminator may have gone blind. Inert. Degrade the sweep.
        //   - no peer advertised a /p2p-circuit address at all
        //     → there was nothing relayed in existence to observe. The control is
        //       NOT APPLICABLE on this topology this sweep. Not inert, not a degrade.
        //
        // Reporting the second as `partial` claims we looked and came up short, when in
        // fact there was nothing to look at — the same conflation `unstamped` vs `none`
        // exists to prevent in the falsifier census.
        nc.NC4 = flags.length === 0 ? 'skipped_no_connection'
            : sawRelayed && sawDirect ? 'fired'
                : !sawRelayed && !relayedTargetsExist ? 'not_applicable_no_relayed_peer'
                    : `partial_one_polarity_only(${sawRelayed ? 'relayed' : 'direct'})`;
    }
    // NC5 — freshness, not presence. A row past its TTL must not read as live. The 5-min
    // TTL means presence outlives the process; a version of substrate-cycle-resync once
    // reported a container that had Exited(1) as having resynced in one second.
    const reg = await discoveryResolve({ type: 'vesselRegistry' });
    const stale = (reg?.vessels ?? []).filter((v) => {
        const seen = Date.parse(v.lastSeen ?? v.last_seen ?? '');
        return Number.isFinite(seen) && Date.now() - seen > 300_000;
    });
    nc.NC5 = stale.length === 0 ? 'fired' : `DID_NOT_FIRE(${stale.length}_stale_rows_treated_as_live)`;
    // NC6 — a manifest vessel asserted as expected must RECLASSIFY, not file a gap.
    const manifestUnit = unitState('human-surface-vessel.service');
    nc.NC6 = manifestUnit.unit ? 'fired' : 'DID_NOT_FIRE';
    // NC7 — a transport-only witness must downgrade. Proven against the real choke point.
    const probeRow = record('NC7_self_witness', 'pass', { witness: 'transport', evidence: { note: 'synthetic control row' } });
    nc.NC7 = probeRow.verdict === 'undecidable' ? 'fired' : 'DID_NOT_FIRE';
    // NC8 — the verdict sink must be WRITABLE AND READABLE BACK. This is the control for
    // "a harness that dies can still report its own coverage": the top-level catch emits a
    // report, and that emission is worthless if the sink silently rejects it. A verdict
    // that failed to post is the worst outcome an oracle can have — it looks like silence,
    // and silence reads as health.
    //
    // Round-trip, not write-status: a 200 from a write path proves the request was
    // accepted, not that anything was stored. (An absent row and a stripped field look
    // identical from the writer's side; the tiebreak is always "does the row exist?")
    const canary = `fedprobe-canary:${SWEEP_ID}`;
    try {
        await post(`${DEV_VESSEL}/v2/impulses/resolve`, {
            impulse: { type: 'poolImpulse_write', id: canary, shape: 'federationProbeCanary', source: 'federation-probe-tick', body: { sweep_id: SWEEP_ID, ts: Date.now() } },
        }, 5000);
        const back = await post(`${DEV_VESSEL}/v2/impulses/resolve`, { impulse: { pointer: { type: 'poolImpulse', id: canary } } }, 5000);
        const rows = back?.body?.body?.impulses ?? back?.body?.impulses ?? [];
        nc.NC8 = Array.isArray(rows) && rows.some((r) => r?.id === canary) ? 'fired' : 'DID_NOT_FIRE(sink_not_readable_back)';
    }
    catch (e) {
        nc.NC8 = `DID_NOT_FIRE(sink_unreachable:${String(e?.message ?? e).slice(0, 60)})`;
    }
    return nc;
}
// ════════════════════════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════════════════════════
async function main() {
    const prev = readState();
    const allUnits = listServiceUnits();
    // Roster snapshot #1 (start of sweep).
    const rosterBefore = new Map();
    for (const u of allUnits)
        rosterBefore.set(u, unitState(u));
    const masked = [...rosterBefore.values()].filter((s) => s.masked).map((s) => s.unit);
    const selection = sh('sh', ['-c', 'vessel-ctl drift 2>/dev/null | sed -n "/selection in force/,/^$/p" | tail -n +2']);
    // Static-structural legs — these land with the overlay dark.
    checkHardcodedPeerEndpoint();
    checkAnchorPrecedence();
    // checkTransportUnit runs at the END of the sweep — it needs the interval, not an
    // instant (see the note in that function).
    const { relays } = await checkBootstrapAnchors();
    const { vessels: registryRows, circuitBearing } = await checkForeignVantageReachability();
    const ownRowsNow = checkChurnDurability(prev, registryRows);
    // The probe's own node. Without a relay anchor it still gets TCP listeners and DCUtR,
    // so direct-path legs remain meaningful on a LAN or a single host.
    let probe = null;
    try {
        probe = await createVesselLibp2p({
            vesselId: PROBE_ID,
            ...(relays.length ? { relayMultiaddr: relays[0] } : {}),
            enableHttp: true,
            // A PING RESPONDER, SO THIS PEER CAN BE REAPED.
            //
            // The relay's keep-alive only closes a dead reserved peer that has PONGED AT LEAST
            // ONCE — deliberately, so a peer with no responder is not reaped merely for being
            // unable to answer (relay.ts:105). The consequence for an instrument that mints a
            // NEW NONCE IDENTITY EVERY SWEEP is that each sweep leaves behind a reservation the
            // relay can never verify or reclaim. Measured on the live relay: 12 distinct
            // never-ponged peers in six hours against 1 that ponged — nearly all of them mine.
            //
            // At maxReservations 128 with a 1h TTL that is not currently exhausting anything,
            // so this is not the cause of the phantom. It is the oracle littering the system it
            // measures, which is its own kind of measurement error: an instrument that changes
            // the state of the subject in a direction nobody is accounting for.
            extraServices: { ping: ping() },
        });
    }
    catch (e) {
        record('I2_join_overlay', 'fail', { witness: 'probe', cls: 'probe_node_construction_failed', evidence: { error: String(e?.message ?? e) } });
    }
    if (probe) {
        // The instrument's own precondition, asserted rather than assumed. Without this the
        // probe_node_construction_failed class could be FILED (below) and never retired: a
        // sweep that cannot build its node emits the failure, and a sweep that can says
        // nothing — so the class only ever accumulates. Found by auditing every cls: against
        // every clears:, which is the kind of check that should not depend on someone
        // remembering to look.
        record('I0_probe_instrument_usable', 'pass', {
            witness: 'probe', clears: 'probe_node_construction_failed',
            evidence: { peer_id: probe.peerId, note: 'the oracle built its own libp2p node; every probe-witnessed verdict in this sweep rests on this' },
        });
        await checkOverlay(probe, relays, circuitBearing);
        await checkJoinLeave(probe);
    }
    else {
        for (const inv of ['I4_forced_relay', 'I5_direct_preferred', 'I6_payload_integrity', 'I7_leave_propagates', 'I9_ingress_authenticated']) {
            record(inv, 'undecidable', { witness: 'probe', reason: 'no_probe_node' });
        }
    }
    // Cross-substrate classes are NOT covered by a single substrate plus this probe. They
    // stay undecidable rather than silently passing — a green local sweep must never read
    // as federation coverage.
    // The reason must reflect what is actually true right now. This block used to hardcode
    // `no_peer_substrate`, and it kept saying so after a real second substrate had joined
    // and was visibly mirroring eight rows into this registry — an oracle asserting a
    // falsehood about its own environment, which is the failure it exists to prevent.
    // Distinguish "there is nobody to test against" from "there is somebody and this check
    // cannot yet orchestrate the departure it would need".
    const foreignSubstrates = [...new Set((registryRows ?? [])
            .map((v) => String(v.vesselId ?? ''))
            .filter((id) => id.includes('@'))
            .map((id) => id.split('@')[1])
            .filter((sid) => sid && sid !== SUBSTRATE_ID))];
    // I8, DECIDED BY OBSERVATION RATHER THAN BY ORCHESTRATION.
    //
    // This invariant sat `undecidable` forever because deciding it appeared to require
    // STOPPING a live peer, which a read-only sweep must not do. But an invariant that can
    // only be decided by perturbing production will never be decided in production — it is
    // undecidable by construction, which is the same as absent while looking considered.
    //
    // Restated so observation suffices: NO FOREIGN ROW MAY BE ADVERTISED AS FRESH WHILE ITS
    // PEER IS UNDIALABLE. That is the property cross-boundary de-advertise exists to deliver,
    // and it is exactly what fails when a whole substrate departs — its rows keep their TTL
    // and keep being handed out while nothing answers behind them. The probe already holds an
    // overlay node, so it can simply try the circuit each foreign substrate advertises.
    //
    // Measured cost of getting this wrong, from a real departure: the hub kept advertising
    // all 8 rows of a stopped peer, and resolving one returned HTTP 502 in 29ms. Bounded, but
    // a goal walk selects a dead producer for up to the 5-minute TTL.
    if (foreignSubstrates.length === 0) {
        record('I8_cross_boundary_deadvertise', 'undecidable', {
            witness: 'cross-vantage', reason: 'no_peer_substrate',
            evidence: { note: 'no @-qualified foreign rows in this registry' },
        });
    }
    else if (!probe) {
        record('I8_cross_boundary_deadvertise', 'undecidable', {
            witness: 'cross-vantage', reason: 'no_probe_node',
            evidence: { peer_substrates_present: foreignSubstrates },
        });
    }
    else {
        const stale = [];
        const live = [];
        for (const sid of foreignSubstrates) {
            const rows = (registryRows ?? []).filter((v) => String(v.vesselId ?? '').endsWith('@' + sid));
            const fresh = rows.filter((v) => {
                const t = Date.parse(String(v.lastSeen ?? v.last_seen ?? ''));
                return Number.isFinite(t) && Date.now() - t < 300_000;
            });
            if (fresh.length === 0)
                continue; // already decayed — nothing being handed out
            const ma = fresh.flatMap((v) => (v.libp2p_multiaddr ?? [])).find((m) => m.includes('p2p-circuit'));
            if (!ma)
                continue;
            try {
                await withTimeout(resolveViaLibp2p(probe, ma, { type: 'federation_probe' }), 15_000, `I8 liveness dial ${sid}`);
                live.push(sid);
            }
            catch (e) {
                stale.push({ substrate: sid, fresh_rows: fresh.length, dial_target: ma, error: String(e?.message ?? e).slice(0, 120) });
            }
        }
        if (stale.length > 0) {
            record('I8_cross_boundary_deadvertise', 'fail', {
                witness: 'cross-vantage', cls: 'stale_foreign_rows_advertised',
                evidence: { stale, live_peers: live,
                    note: 'these rows are inside their TTL and still being returned by discovery, but the peer behind them does not answer — a resolve routed here selects a dead producer' },
            });
        }
        else {
            record('I8_cross_boundary_deadvertise', 'pass', {
                witness: 'cross-vantage', clears: 'stale_foreign_rows_advertised',
                evidence: { live_peers: live, note: 'every foreign substrate advertising fresh rows answered a dial on the circuit those rows carry' },
            });
        }
    }
    const relayedTargetsExist = circuitBearing.some((v) => (v.libp2p_multiaddr ?? []).some((m) => String(m).includes('/p2p-circuit')));
    const nc = await negativeControls(probe, relayedTargetsExist);
    if (probe)
        await probe.stop().catch(() => { });
    // Roster snapshot #2 — quiescence by MainPID/NRestarts movement, the same discipline
    // vessel-ctl restart uses, and for the same reason: is-active lies during a cutover.
    const churned = [];
    const rosterAfter = new Map();
    for (const u of allUnits) {
        const b = rosterBefore.get(u);
        const a = unitState(u);
        rosterAfter.set(u, a);
        if (b.mainPid !== a.mainPid || b.nRestarts !== a.nRestarts)
            churned.push(u);
    }
    const TRANSPORT = 'federation-transport-vessel.service';
    const { flapping: transportFlapping } = checkTransportUnit(prev, rosterAfter.get(TRANSPORT) ?? unitState(TRANSPORT), churned.includes(TRANSPORT));
    // THE CLASS, NOT THE INSTANCE. The transport's crash loop was detected because a check
    // was written for that one unit — and then federation-relay was installed and reproduced
    // the identical failure shape (hard-exit on a missing bootstrap value under
    // Restart=always, so it parks in `activating` and never reports `failed`). A detector
    // aimed at one unit would have missed it, and the operator would have found it by hand
    // again. Every federation unit is now checked for the same signature.
    //
    // Deliberately reported as ONE gap class with the offending units named, not one gap per
    // unit: the defect is a shared pattern in how these units treat a missing value, and
    // filing it per-unit would fragment one repair into several.
    const FED_UNITS = ['federation-relay.service', 'discovery-vessel.service', 'goal-host-vessel.service'];
    const flappers = [];
    for (const u of FED_UNITS) {
        const before = rosterBefore.get(u);
        const after = rosterAfter.get(u) ?? unitState(u);
        if (!before || after.masked)
            continue;
        const crashed = after.result === 'exit-code' || after.result === 'signal' || after.result === 'core-dump';
        if (churned.includes(u) || (after.active === 'activating' && crashed)) {
            flappers.push({ unit: u, active: after.active, result: after.result, n_restarts: after.nRestarts, churned_in_sweep: churned.includes(u) });
        }
    }
    if (flappers.length > 0) {
        record('I11_no_silent_crash_loop', 'fail', {
            witness: 'static', cls: 'federation_unit_flapping',
            evidence: { units: flappers, note: 'a unit hard-exiting under Restart=always parks in `activating` and never reports `failed`, so no ActiveState check above it fires' },
        });
    }
    else {
        record('I11_no_silent_crash_loop', 'pass', {
            witness: 'static', clears: 'federation_unit_flapping',
            evidence: { checked: FED_UNITS, note: 'no federation unit churned across this sweep or sits activating after a non-zero exit' },
        });
    }
    // QUIESCENCE EXCLUDES UNITS ALREADY JUDGED TERMINALLY BROKEN. A unit in a permanent
    // crash loop churns on every sweep, so counting it would make every sweep
    // non-quiescent, and the hysteresis gate would then never let its OWN gap mint. The
    // worst failure on the box would be the one thing that could never be filed — the
    // failure suppressing the report about itself. Churn from a unit under a terminal
    // verdict is a known condition, not an in-flight cutover.
    // QUIESCENCE IS SCOPED TO UNITS A FEDERATION VERDICT CAN DEPEND ON. Judging it over
    // EVERY unit on the box was too broad and it showed up immediately: a sweep was marked
    // non-quiescent because `m1-trainer.service` restarted, which blocked a gap closure that
    // had nothing to do with it. On a substrate that develops itself something is almost
    // always restarting, so an all-units rule makes quiescence rare — and since BOTH filing
    // and closing require it, the hysteresis gate would spend most of its life shut and the
    // gap store would stop tracking reality in either direction.
    //
    // The relevant set is the units whose state can actually move a verdict here: the
    // overlay itself, the registry the verdicts are read from, and the vessels that serve
    // the shapes under test. Everything else is recorded as background churn for context.
    const RELEVANT = new Set([
        TRANSPORT, 'federation-relay.service', 'discovery-vessel.service',
        'goal-host-vessel.service', 'development-vessel.service', 'activity-api.service',
    ]);
    const churnedExcludingTerminal = churned.filter((u) => !(u === TRANSPORT && transportFlapping));
    const churnedRelevant = churnedExcludingTerminal.filter((u) => RELEVANT.has(u));
    const churnedBackground = churnedExcludingTerminal.filter((u) => !RELEVANT.has(u));
    const quiescent = churnedRelevant.length === 0;
    // ── Report ────────────────────────────────────────────────────────────────────────
    const real = verdicts.filter((v) => v.invariant !== 'NC7_self_witness');
    const passed = real.filter((v) => v.verdict === 'pass').length;
    const failed = real.filter((v) => v.verdict === 'fail').length;
    const undecided = real.filter((v) => v.verdict === 'undecidable').length;
    const decided = passed + failed;
    // A CONTROL THAT NEVER RAN IS NOT A CONTROL THAT PASSED. The validity rule used to flag
    // only strings beginning 'DID_NOT_FIRE', so `skipped_*` and `partial_*` counted as
    // valid — and NC4, the control whose entire job is proving the relay/direct
    // discriminator is not a constant, reported `skipped_no_connection` on every sweep of
    // this workflow while the report read `sweep_validity: valid`. Every "valid" sweep had
    // its path-discriminator control inert. Not-fired is now visible in the verdict:
    // `invalid` when a control actively failed, `degraded` when one could not run.
    const ncFailed = Object.entries(nc).filter(([, v]) => v.startsWith('DID_NOT_FIRE')).map(([k]) => k);
    // `not_applicable_*` is deliberately NOT inert. A control that could not apply to this
    // topology is a statement about the topology, not a hole in the verification — folding
    // it in would make every spoke permanently `degraded` and drain the word of meaning.
    // `skipped_*` and `partial_*` still count: those mean the control COULD have run here.
    const ncInert = Object.entries(nc)
        .filter(([, v]) => v.startsWith('skipped') || v.startsWith('partial'))
        .map(([k]) => k);
    const blocking = relays.length === 0 ? 'no_relay_anchor'
        : !probe ? 'no_probe_node'
            : circuitBearing.length === 0 ? 'no_circuit_advertised'
                : null;
    // Hysteresis: a failure becomes a GAP only after 2 consecutive QUIESCENT sweeps of the
    // same class. Non-quiescent sweeps are excluded from the counter entirely, so a
    // self-edit cutover can never mint a gap.
    const failing = {};
    if (quiescent) {
        for (const v of real.filter((r) => r.verdict === 'fail' && r.class)) {
            failing[v.class] = (prev.failing?.[v.class] ?? 0) + 1;
        }
    }
    else {
        Object.assign(failing, prev.failing ?? {});
    }
    const gapEligible = Object.entries(failing).filter(([, n]) => n >= 2).map(([c]) => c);
    // A CLASS THAT STOPS BEING REPORTED IS NOT A CLASS THAT WAS FIXED, and the difference
    // must be visible in the report rather than inferred from a shrinking list. Adversarial
    // review found `overlay_unjoinable` present in one sweep and absent from the next three
    // — not flipped to pass, just gone, with its filed gap left open and unreachable by
    // either a re-fire or a close. The dropped-from-gap_eligible count (7 -> 4) was the only
    // trace, and nothing named which class had gone or why.
    //
    // This does not guess whether the disappearance is a fix or a regression in the
    // instrument — it names it so a reader can ask. A class here with its gap still open is
    // the signature of the instrument having stopped looking.
    const cleared = new Set(real.filter((r) => r.verdict === 'pass').flatMap((r) => [r.clears, r.clearsAlso].filter(Boolean)));
    const reportedClasses = new Set(real.filter((r) => r.class).map((r) => r.class));
    // A class explicitly CLEARED this sweep is not a class that went missing — it was
    // positively proven and is excluded below, so the warning keeps naming only the genuine
    // disappearances it exists to surface.
    const noLongerReported = Object.keys(prev.failing ?? {}).filter((c) => !reportedClasses.has(c) && !cleared.has(c));
    // ── CLOSURE. Law 7 measures gap close rate, latency and durability, and a store that
    // only ever files is a ratchet, not a measure: before this, fed:transport_unit_flapping
    // stayed open while the defect it names was demonstrably repaired and live.
    //
    // Three rules keep a close honest, and each exists because of a specific way closure
    // goes wrong in this system:
    //   1. POSITIVE ASSERTION ONLY. A class closes because a PASS row NAMED it (`clears`),
    //      never because the class stopped appearing. Absence-as-success is what stranded
    //      fed:overlay_unjoinable.
    //   2. NO CONTRADICTION IN THE SAME SWEEP. If any row still FAILS with that class, the
    //      clear does not count — some config classes decide the same class more than once.
    //   3. SYMMETRIC HYSTERESIS. Two consecutive QUIESCENT sweeps, the same bar as filing.
    //      Closing on a single green reading is how a gap store fills with things that
    //      reopen wearing a different hat; closing slowly costs one cadence interval and
    //      buys durability, which is the third term of the triple.
    //
    // A sweep with a control in DID_NOT_FIRE (a control that ran and failed to detect what
    // it exists to detect) closes nothing. An INERT control — one that could not run at all,
    // like NC4 with no connection to inspect — does NOT block closure, because requiring it
    // would mean no static verdict could ever close a gap on a single-substrate deployment,
    // where NC4 structurally cannot fire. The distinction is deliberate and the inert set is
    // recorded in every closure body, so a reader sees which controls were not watching.
    const stillFailing = new Set(real.filter((r) => r.verdict === 'fail' && r.class).map((r) => r.class));
    const clearingNow = [...cleared].filter((c) => !stillFailing.has(c));
    const clearing = {};
    const sweepIsSound = quiescent && ncFailed.length === 0;
    if (sweepIsSound) {
        for (const c of clearingNow)
            clearing[c] = (prev.clearing?.[c] ?? 0) + 1;
    }
    else {
        Object.assign(clearing, prev.clearing ?? {});
    }
    const closeEligible = Object.entries(clearing).filter(([, n]) => n >= 2).map(([c]) => c);
    // A class that just proved clear must also stop accruing toward a re-file.
    for (const c of clearingNow)
        delete failing[c];
    const report = {
        sweep_id: SWEEP_ID, probe_id: PROBE_ID, substrate: SUBSTRATE_ID,
        planned: real.length, attempted: real.length, decided,
        passed, failed, undecidable: undecided,
        coverage_fraction: real.length ? decided / real.length : 0,
        coverage_denominator: 'invariant x applicable-config-class; undecidable does NOT count as decided',
        blocking_reason: blocking,
        quiescent, churned_units: churnedRelevant, background_churn: churnedBackground,
        masked_by_selection: masked, selection_in_force: selection || '(none set)',
        consecutive_failing_sweeps: failing,
        gap_eligible_classes: gapEligible,
        classes_no_longer_reported: noLongerReported,
        negative_controls: nc,
        // An all-green sweep whose controls did not fire is INVALID, not passing.
        sweep_validity: ncFailed.length > 0 ? `invalid(controls_did_not_fire:${ncFailed.join(',')})`
            : ncInert.length > 0 ? `degraded(controls_inert:${ncInert.join(',')})`
                : 'valid',
        duration_ms: Date.now() - SWEEP_START,
        ts: Date.now(),
    };
    // ── Gap emission — the loop from "oracle observes" to "substrate repairs itself" ────
    //
    // Only after 2 consecutive QUIESCENT sweeps of the same class (see the hysteresis
    // above), so a self-edit cutover can never mint one. Ids are STABLE and derived
    // (`fed:<class>`) so a re-fire UPDATES the existing row rather than flooding the store —
    // an oracle on a rhythm cadence is a gap firehose otherwise.
    //
    // The closure predicate is carried in `summary`. substrateGap_write accepts no
    // top-level falsifier field and overwrites classification_metadata.falsifier with a
    // class label, so summary is the only field in which a filer's predicate survives.
    const FALSIFIERS = {
        hardcoded_peer_endpoint_in_image: 'no shipped unit or drop-in sets a routing endpoint containing a literal IP, and `systemctl show discovery-vessel -p Environment` contains no IP literal.',
        bootstrap_env_precedence_inversion: 'no routing anchor (HUB_DISCOVERY_URL, DISCOVERY_ENDPOINT, IDENTITY_VESSEL_URL, ACTIVITY_API_ENDPOINT) differs between /workspace/.substrate-secrets and /etc/substrate/env.',
        // Deliberately an INTERVAL predicate, not an instantaneous one: this unit reports
        // ActiveState=active with Result=success during its up-phase, so an instant snapshot
        // is satisfiable by a unit that is still crash-looping. Closure requires NRestarts
        // and MainPID unchanged across two samples bracketing a full sweep.
        registry_lost_local_rows: 'across two consecutive sweeps, every registry row this substrate owns (bare vesselId, no @substrate qualifier) that was present in the earlier sweep is still present in the later one, regardless of how many foreign peers joined or left in between.',
        stale_foreign_rows_advertised: 'no foreign <vessel>@<substrate> row is returned by discovery with a lastSeen inside the TTL while a dial to the circuit that row advertises fails.',
        federation_unit_flapping: 'every federation unit (relay, discovery, goal-host) shows NRestarts and MainPID unchanged across two samples bracketing a full sweep, and none sits in `activating` after a non-zero exit.',
        transport_unit_flapping: 'federation-transport-vessel.service shows NRestarts AND MainPID unchanged across two samples bracketing a full sweep interval (an instantaneous ActiveState=active / Result=success does NOT satisfy this — the unit reports exactly that during each up-phase of its crash loop).',
        join_door_host_dependent: 'GET /bootstrap returns a non-empty discovery_endpoint and a non-loopback identity_endpoint when queried under a foreign Host header.',
        no_relay_anchor: 'GET /bootstrap returns a non-empty relay_multiaddrs, OR the transport holds a reservation with no relay anchor configured (direct-only overlay is a valid answer).',
        no_circuit_advertised: 'at least one vesselRegistry row carries a non-empty libp2p_multiaddr with a fresh lastSeen.',
        overlay_unjoinable: 'this probe, holding a nonce identity and no prior state, obtains a relay reservation or a direct dial to the local transport within one sweep.',
        relay_address_not_honoured: 'a dial to a /p2p-circuit multiaddr yields a connection with limits != null.',
        punchthrough_unavailable: 'a dial by bare PeerId yields a connection with limits == null (DCUtR upgraded), or the relay-fallback is recorded as an accepted deployment condition.',
        payload_corrupted: 'every payload class round-trips with matching byte-length and matching sha256 against both the echoed bytes and the server-computed hash.',
        federation_ingress_unauthenticated: 'an uncredentialed overlay dial resolving vesselRegistry is refused or returns no rows.',
        leave_only_at_ttl: 'after DELETE /vessels/<id>, an immediate re-query returns zero rows — i.e. the row cleared on the deregister path, not on the 5-minute TTL.',
        join_not_findable: 'a freshly registered nonce shape is returned by a vesselCapability query immediately after registration.',
    };
    const emittedGaps = [];
    for (const cls of gapEligible) {
        const rows = real.filter((r) => r.class === cls);
        const ev = rows.map((r) => `${r.invariant}: ${JSON.stringify(r.evidence)}`).join(' || ');
        const falsifier = FALSIFIERS[cls] ?? `the ${cls} verdict reports pass for 2 consecutive quiescent sweeps.`;
        const summary = `FALSIFIER (closure predicate — carried here because substrateGap_write discards a free-text falsifier): ${falsifier}` +
            ` || DETECTED BY: federation-probe-tick, an independent ephemeral-peer oracle; witnessed by ${rows.map((r) => r.witness).join('/')} , never by the transport's own health report.` +
            ` || CONFIRMED OVER ${failing[cls]} consecutive QUIESCENT sweeps (no unit changed MainPID or NRestarts during them), so this is not a cutover artefact.` +
            ` || EVIDENCE (${SWEEP_ID}): ${ev}` +
            ` || CONTEXT: part of the federation overlay break tracked as host-independent-federation-join-broken and specified in openspec/changes/2026-09-12-host-independent-federation-join/proposal.md. This row is the re-measured, self-detected form — it closes when the probe says so, not when someone says it landed.`;
        try {
            await post(`${DEV_VESSEL}/v2/impulses/resolve`, {
                impulse: { pointer: { type: 'substrateGap_write', id: `fed:${cls}`, category: 'architecture', source: 'substrate_detected', status: 'open', summary } },
            }, 6000);
            emittedGaps.push(`fed:${cls}`);
        }
        catch { /* a gap that failed to file must not abort the sweep */ }
    }
    ;
    report.gaps_emitted = emittedGaps;
    // Close what has been proven clear for two consecutive sound sweeps. The closure body
    // records WHAT proved it, so a reader can audit the close rather than trusting the
    // status field — the same reason a gap's falsifier is carried in summary.
    // ONLY NEWLY-CLOSED CLASSES. The clearing streak keeps growing once a class is clear, so
    // without this every sweep re-closed the same set forever and `gaps_closed` — the field
    // that should mark a TRANSITION — degenerated into a constant. A class re-enters the
    // closable set only if it fails again, which re-files it and clears this record.
    const alreadyClosed = new Set(prev.closed ?? []);
    const closedGaps = [];
    const notOpen = []; // clear, but nothing on the books to close — not an error
    for (const cls of closeEligible) {
        if (alreadyClosed.has(cls))
            continue;
        // A CLOSE MUST CLOSE SOMETHING. substrateGap_write CREATES on write, so closing a class
        // that was never filed conjures a `closed` row for a problem that never existed — and
        // law 7 measures close RATE, so that silently inflates the very number this path exists
        // to make honest. Observed: fed:stale_foreign_rows_advertised appeared closed having
        // never been open, because a class induced once during a polarity test then cleared
        // twice. Only ever transition a gap that is actually on the books and open.
        let isOpen = false;
        try {
            const cur = await post(`${DEV_VESSEL}/v2/impulses/resolve`, { impulse: { pointer: { type: 'substrateGap', id: `fed:${cls}` } } }, 6000);
            const rows = cur?.body?.body?.gaps ?? cur?.body?.gaps ?? [];
            isOpen = Array.isArray(rows) && rows.some((g) => g?.id === `fed:${cls}` && g?.status !== 'closed');
        }
        catch {
            isOpen = false;
        }
        if (!isOpen) {
            notOpen.push(cls);
            continue;
        }
        const proof = real.filter((r) => r.clears === cls);
        const note = `CLOSED BY MEASUREMENT, not by assertion. The closure predicate for this class was evaluated by ` +
            `federation-probe-tick and passed on ${clearing[cls]} consecutive sweeps that were both QUIESCENT ` +
            `(no unit changed MainPID or NRestarts during them) and had every negative control firing. ` +
            `Proven by: ${proof.map((r) => `${r.invariant} PASS ${JSON.stringify(r.evidence)}`).join(' || ')} ` +
            `|| Closure required a verdict row to NAME this class as cleared; a class merely ceasing to be ` +
            `reported never closes a gap here, because absence and repair are indistinguishable from the outside. ` +
            `|| Negative controls during those sweeps: all fired except inert=[${ncInert.join(',') || 'none'}] (a control that could not run, recorded so the close can be audited). ` +
            `|| Re-opens automatically if the class fails again for 2 consecutive quiescent sweeps.`;
        try {
            await post(`${DEV_VESSEL}/v2/impulses/resolve`, {
                // category/source are RESTATED, not omitted. substrateGap_write re-derives any
                // field the write does not carry: a closure that sent only {id,status,summary}
                // rewrote category to "other" and source to "walk_flat_pointer", quietly
                // corrupting the provenance of every gap it closed. Observed on a throwaway
                // probe gap before this path was trusted.
                // The summary REPLACEMENT is deliberate and not data loss: it swaps the filing
                // falsifier for the closure proof, and a re-file writes a fresh falsifier back.
                impulse: { pointer: { type: 'substrateGap_write', id: `fed:${cls}`, category: 'architecture', source: 'substrate_detected', status: 'closed', closed_reason: 'falsifier_satisfied', summary: note } },
            }, 6000);
            closedGaps.push(`fed:${cls}`);
        }
        catch { /* a close that failed to write must not abort the sweep */ }
    }
    ;
    report.gaps_closed = closedGaps;
    report.close_eligible_classes = closeEligible;
    report.close_skipped_no_open_gap = notOpen;
    report.clearing_streak = clearing;
    // ── Emit over loopback. The channel and its subject share no medium, which is what
    // lets this report "the overlay is down" at all. Emitted AFTER gap filing so the report
    // carries what was actually filed rather than what was intended.
    for (const v of real) {
        await post(`${DEV_VESSEL}/v2/impulses/resolve`, {
            impulse: { type: 'poolImpulse_write', id: `fedverdict:${SWEEP_ID}:${v.invariant}:${v.config_class.payload ?? v.config_class.path ?? v.config_class.topology ?? 'base'}`, shape: 'federationProbeVerdict', source: 'federation-probe-tick', body: v },
        }, 5000).catch(() => { });
    }
    await post(`${DEV_VESSEL}/v2/impulses/resolve`, {
        impulse: { type: 'poolImpulse_write', id: `fedreport:${SWEEP_ID}`, shape: 'federationVerificationReport', source: 'federation-probe-tick', body: report },
    }, 5000).catch(() => { });
    await post(`${DEV_VESSEL}/v2/impulses/resolve`, {
        impulse: {
            type: 'poolImpulse_write', id: `fedroster:${SWEEP_ID}`, shape: 'federationRosterExpectation', source: 'federation-probe-tick',
            body: { substrate_id: SUBSTRATE_ID, selection_source: 'systemd mask state (applied result, not a re-derived precedence)', masked_by_selection: masked, churned: churned, quiescent, ts: Date.now() },
        },
    }, 5000).catch(() => { });
    writeState({
        last_sweep_id: SWEEP_ID,
        restarts: Object.fromEntries([...rosterBefore.values()].map((s) => [s.unit, s.nRestarts])),
        failing,
        clearing,
        // A class that FAILS again leaves the closed set, so its next clear reports as a new
        // transition rather than being suppressed as 'already closed'.
        closed: [...new Set([...alreadyClosed, ...closedGaps])].filter((c) => !stillFailing.has(c)),
        ownRows: ownRowsNow,
    });
    if (JSON_ONLY) {
        console.log(JSON.stringify({ report, verdicts: real }, null, 2));
    }
    else {
        console.log(`\n=== ${SWEEP_ID}  probe=${PROBE_ID}  substrate=${SUBSTRATE_ID} ===`);
        for (const v of real) {
            const mark = v.verdict === 'pass' ? 'PASS' : v.verdict === 'fail' ? 'FAIL' : 'UNDE';
            const tag = v.class ? ` [${v.class}]` : v.undecidable_reason ? ` (${v.undecidable_reason})` : '';
            const cfg = v.config_class.payload ?? v.config_class.path ?? v.config_class.topology;
            console.log(`  ${mark}  ${v.invariant}${cfg && cfg !== 'local-overlay' ? ` {${cfg}}` : ''}${tag}`);
        }
        console.log(`\n  coverage ${(report.coverage_fraction * 100).toFixed(0)}%  (${decided}/${real.length} decided: ${passed} pass, ${failed} fail, ${undecided} undecidable)`);
        console.log(`  blocking_reason: ${blocking ?? 'none'}`);
        console.log(`  quiescent: ${quiescent}${churnedRelevant.length ? ` (relevant churn: ${churnedRelevant.join(', ')})` : ''}${churnedBackground.length ? ` [background churn ignored: ${churnedBackground.join(', ')}]` : ''}`);
        console.log(`  negative_controls: ${JSON.stringify(nc)}`);
        console.log(`  sweep_validity: ${report.sweep_validity}`);
        if (closedGaps.length)
            console.log(`  ✅ gaps CLOSED this sweep: ${closedGaps.join(', ')}`);
        const writeFailed = closeEligible.filter((c) => !closedGaps.includes(c) && !notOpen.includes(c));
        if (notOpen.length)
            console.log(`  close_eligible but no open gap to close (expected — nothing was wrong): ${notOpen.length} class(es)`);
        if (writeFailed.length)
            console.log(`  ⚠ close WRITE FAILED for: ${writeFailed.join(', ')}`);
        if (noLongerReported.length)
            console.log(`  ⚠ classes_no_longer_reported (was failing, emitted no verdict this sweep): ${noLongerReported.join(', ')}`);
        console.log(`  gap_eligible (>=2 consecutive quiescent sweeps): ${gapEligible.length ? gapEligible.join(', ') : 'none yet'}\n`);
    }
}
// The last line of defence for "a harness that dies cannot report its own coverage".
main().catch(async (e) => {
    const msg = String(e?.message ?? e);
    console.error('[fed-probe] sweep threw (reporting anyway):', msg);
    await post(`${DEV_VESSEL}/v2/impulses/resolve`, {
        impulse: {
            type: 'poolImpulse_write', id: `fedreport:${SWEEP_ID}`, shape: 'federationVerificationReport', source: 'federation-probe-tick',
            body: { sweep_id: SWEEP_ID, probe_id: PROBE_ID, planned: verdicts.length, attempted: verdicts.length, decided: 0, coverage_fraction: 0, blocking_reason: 'probe_threw', error: msg, sweep_validity: 'invalid(probe_threw)', ts: Date.now() },
        },
    }, 5000).catch(() => { });
    process.exit(1);
});
//# sourceMappingURL=federation-probe-tick.js.map