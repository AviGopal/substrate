## 1. Probe selection (before cutover)

- [ ] 1.1 Read recent successful executions touching the edited vessel's advertised shapes (trace store), dedupe by (shape, pointer signature), cap N per shape.
- [ ] 1.2 Baseline each probe against the running (pre-landing) vessel; store `{shape, pointer, baseline}` on the attempt intent.

## 2. Replay and diff (after restart)

- [ ] 2.1 In the sweep, after the edited vessel's unit restarted onto the landing (8.4a's gate), replay the stored probes.
- [ ] 2.2 Structural diff: success→error, shape change, populated field → empty/null, numeric sign flip. Report "unprobed" when a vessel had no baseline.

## 3. Verdict and learning

- [ ] 3.1 A consumer regression writes `regressed_by` (source consumer_probe), the `#2 regressed` settlement, a posterior miss and an attempt_consequence lesson naming the failing probe (reuse recordFalsifiedAutonomousLanding's write path).
- [ ] 3.2 Register the probe runner as a `jointBinding` (its own liveness watched).

## 4. Falsifier

- [ ] 4.1 Scratch replay: `9cfdea4` → embedding probe regresses; `af2c737` → concept-db contract probe regresses; `a198907` → no delta; `acc184b` (good) → no delta.
