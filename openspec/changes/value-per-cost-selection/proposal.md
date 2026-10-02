## Why

The substrate spends LLM calls, compute and wall time on actions that cannot solve a
problem, and nothing in its decision making prices that before spending. Selection asks
*what is eligible* and *what scores highest*; it never asks *can this solve a problem, at
what cost, and has a cheaper check already said no*. On one measured day the result was:

- a recursion storm of ~3,080 goal walks in three hours, nearly all one goal, 21 reached;
- ~60% of one node's 210 autonomous composes structurally unable to land: 84 targeted a
  vessel whose landing target was refused at cutover (54 of them drafted and verified in
  full first), 21 targeted gaps with no edit site, 51 were retries of known failures,
  18 targeted a protected vessel;
- a second node composing 117 times unsupervised because a pause written on the first
  node did not exist on it;
- dispatches that kept walking after their own landing, one writing broken code into live
  source and one overwriting a real landing with a false "failed" verdict;
- the LLM provider credits exhausted by evening, with 57 autonomous commits to show for
  the day, several of which had to be reverted.

The system must not spend money, time or cycles on things that will not solve a problem
or produce information later used to solve one. Spend has to be a function of that.

## What Changes

Every expenditure becomes a decision priced before it is made and graded after it is
done, in one currency: **expected problem-solving value per unit of cost**.

- **Value is defined at the top of the ladder.** The terminal value signal is a gap closed
  by its falsifier and staying closed. "Landed", "reached" and "exited cleanly" are
  intermediate. Information has value only when it is new (a failure reason not seen
  before, a lesson with a named reader, a calibration update); a repeat of a known
  failure has zero value.
- **Cost is a shape.** Every LLM call reports tokens, model and an estimated price, and
  every execution and compose records its cost in its trace. Selection posteriors carry
  expected cost alongside expected success, so an activity is chosen on value per cost.
- **Feasibility is checked cheapest-first, before drafting.** Deterministic checks that
  can say "cannot succeed" (target is authorable and its push scope resolves, the gap has
  an edit site, the falsifier is machine-checkable, an LLM producer is advertised, the
  lane has capacity) run at admission, before any LLM call.
- **Negative knowledge is durable.** A deterministic refusal is recorded as a fact with an
  invalidation condition ("cannot land on X until X's push remote changes") and consulted
  before spending; it survives restarts and renamed sibling gaps.
- **A dispatch ends when its value is realized.** When the edit route lands a commit for
  the goal, the dispatch terminates with that verdict, and no later step may overwrite a
  landed verdict.
- **Spend runs inside a budget shape.** A spend envelope per time window is a shaped
  impulse read at use time and resolved by shape through discovery, so every node obeys
  the same budget and the same pauses. Low value-per-cost work waits when it binds; idle is
  a valid state. A spend-rate anomaly detector trips a breaker.
- **Landability is calibrated.** Predicted landability is scored against outcomes per
  (edit site, gap category) and selection reads the calibrated value.
- **Gaps are admitted as compose work only when actionable.** No edit site or no
  machine-checkable falsifier routes to investigation or "needs information", never to a
  draft.

## Measures (baseline 2026-09-26, node 1)

Improvement is claimed only against these, measured the same way (queries in design.md):

| Measure | Definition | Baseline |
|---|---|---|
| Self-development reach | code-change dispatches whose landing is verified by the gap's falsifier ÷ code-change dispatches | to be measured (design.md §Measures) |
| Selection quality | autonomous composes whose target was landable at admission ÷ autonomous composes | ≈ 40% |
| Landing yield | landings ÷ autonomous picks | 57 ÷ 210 (node 1+2 landings over node 1 picks; see design) |
| Walk yield | reached ÷ walk completions | 152 ÷ 713 = 21% |
| Cost per closed gap | LLM tokens (and $) ÷ gaps closed by falsifier | not measurable today (no cost accounting) |

## Capabilities

### New Capabilities
- `spend-accounting`: LLM calls, executions and composes report cost; posteriors carry E[cost].
- `feasibility-admission`: deterministic cannot-succeed checks run at admission, cheapest first.
- `negative-knowledge`: deterministic refusals persist as facts with invalidation conditions.
- `dispatch-termination`: a landed edit ends its dispatch; landed verdicts are never overwritten.
- `spend-budget`: a federated spend-envelope shape gates autonomous selection; a spend-rate breaker.
- `landability-calibration`: predicted landability is scored against outcomes and read at selection.

### Modified Capabilities
- (none; existing specs gain requirements through the new capabilities above)

## Impact

- **goal-host-vessel**: early edit-intent termination, verdict protection, negative-fact
  read before dispatch, per-execution cost stamping, spend-rate breaker.
- **development-vessel**: admission gates and order, calibrated landability at selection,
  actionable-gap routing, budget read at selection, per-compose cost.
- **llm-resolver-vessel**: usage and price reported per call.
- **activity-api**: cost fields on executions and posteriors (migration).
- **Operator tier**: until the budget and gates are live, autonomous picks stay held on
  every node; only directed, pre-validated goals spend.
