#!/usr/bin/env bun
/**
 * learning-liveness-probe — is the learning loop ALIVE, right now, with no operator?
 *
 * Learning has been demonstrated by hand many times: snapshot a posterior, dispatch
 * one goal, snapshot again, diff. It had never once been demonstrated WITHOUT an
 * operator, and that gap is not academic — "the substrate's credit channel is
 * one-directional" was published twice from this workstation, both times by reading
 * a field instead of intervening. The only continuously-available signals were the
 * ones that lie. This probe is that intervention, standing.
 *
 * ─── THE FOUR WAYS A NAIVE VERSION OF THIS IS WORSE THAN NOTHING ───────────────
 *
 * Each of these was measured on this substrate, and each would make the probe agree
 * with a broken loop:
 *
 * 1. DO NOT ASSERT AN AMOUNT. The update is graded, not binary:
 *    posterior-update.ts returns `{alphaDelta: y, betaDelta: 1 - y}` with a floor of
 *    0.5, so a free low-output success moves α by ~0.75 and β by ~0.25. Asserting
 *    "α += 1" FAILS ON A WORKING SYSTEM. Assert direction and the sample-count
 *    increment; never the magnitude.
 *
 * 2. DO NOT COMPARE AGAINST alphaBetaDelta. That field describes a POST to
 *    impulse_shape_activity_score, which nothing reads. Grading goes through
 *    POST /reach into variant_performance_metrics, which is what thompson_posterior
 *    returns. Neither number describes the other, BY DESIGN. A checker built on that
 *    comparison reports permanent divergence and is useless. This probe reads the
 *    STORE and treats the dispatch's self-report as commentary.
 *
 * 3. A MISSING ROW IS NOT A VIRGIN ARM. thompson_posterior used to answer an unknown
 *    id with a fabricated Beta(1,1) and loaded:true — and Beta(1,1) is the maximally
 *    explorable posterior, so a typo read as an enticing untried arm rather than an
 *    error. The shape now reports posterior_source; anything other than "stored" is
 *    UNKNOWN and must abort the probe rather than count as evidence.
 *
 * 4. IDENTICAL GOAL TEXT COALESCES. A coalesced dispatch runs nothing, moves nothing,
 *    and is indistinguishable from a dead learning channel. Every probe goal carries a
 *    nonce, and a run where the sample count did NOT increment is reported as
 *    inconclusive — never as failure, and never as success.
 *
 * Plus the one that decides which numbers you are even reading: a spoke MASKS
 * activity-api, so :18080 answers 000 locally and an empty read there looks exactly
 * like "nothing was recorded". The store endpoint is resolved from the RUNNING
 * goal-host process (/proc/<pid>/environ), not from the env file a live process may
 * predate.
 *
 * 5. DECAY MAKES THE RAW DELTA'S SIGN MEANINGLESS. Learned by this probe failing on
 *    itself: decay accumulated since the arm's last write is applied BEFORE the graded
 *    delta, so a single success after an idle gap moves α and β DOWN. Assert on
 *    success_count (a monotonic counter) and on the mean α/(α+β) (decay scales both
 *    parameters, so it cancels) — never on the raw deltas.
 *
 * Exit codes: 0 = learning verified alive · 2 = inconclusive · 3 = FAILED (gap filed).
 */
export {};
//# sourceMappingURL=learning-liveness-probe.d.ts.map