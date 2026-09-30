# Design — the surface render contract

Read with [`proposal.md`](proposal.md). Rulings inherited and not reopened here:
dispatch on form, not shape; `CONTENT_FORMS` is closed and mirrored byte-identically in
`packages/design-tokens/index.ts` and `repos/human-surface-vessel/src/surface-intent.ts`;
`text` (verbatim) is the designed default; a form fires only on positive evidence.

---

## 1. What is subject to the regime

Every draw site in `ui/src`, classified. The inventory is grep-derived
(`<pre`, `sf-verbatim`, `ContentRender`, `Prose`, `JSON.stringify`, `.message}`,
`walkLogText`) so it can be re-run to prove completeness.

### 1a. Content → `<Rendered>`

| Site | Today | Target |
|---|---|---|
| Trace impulse row (`Trace.tsx` ImpulseRow) | own badge/source/cut marker + `ContentRender` | `Rendered` · full · `fromProvenance` |
| Answer (`Answer.tsx`) | segmenter → `Prose` / `ContentRender` | `Rendered` · full · `fromAnswer` (segments become child `Content`) |
| Question body (`QuestionView.tsx`) | `planContent` + `ContentRender` | `Rendered` · full · `fromPanel` |
| Response history (`QuestionView.tsx:211`) | `<pre>` of `JSON.stringify` | `Rendered` · inline · `fromResponse` (shape `human_contribution`) |
| Issue card (`IssuesDrawer.tsx`) | hand-split lead + `<details>` | `Rendered` · inline · `fromGap` (lead/rest is the prose form's `inline` density) |
| Run reason / error (`RunView.tsx`) | bare string | `Rendered` · inline · `fromText` |
| Walk log (`Trace.tsx:280`) | `walkLogText` string list | `Rendered` · full · `fromLog` → `terminal` |
| Step row (`Trace.tsx` StepRow) | bespoke line | stays bespoke chrome (a step is a decision record, not content); its candidates list is `Rendered` · inline · `record` |
| Dispatch outcome (`TopBar.tsx`) | bespoke per kind | `Rendered` · row · `fromOutcome` |
| Solicitation evidence (`SolicitationPanel.tsx`) | mono string | `Rendered` · inline · `fromText` |
| Nested field values (`ContentRender.tsx` renderValue) | recursive `ContentRender` | unchanged — recursion stays inside the registry |
| Rail rows: run goal, question subject | clamped text | `Rendered` · row (prose/text only) |

### 1b. Input → `Interaction`

| Site | Today | Target |
|---|---|---|
| Question response (`QuestionView.tsx`) | textarea + text/json select + decline | `Interaction` of the question's typed asks; untyped → Text |
| Grade (`GradeGesture.tsx`) | radio set + note | `Interaction` · Choice over `VERDICT_OPTIONS[state]` + optional Text |
| Waiting-walk answer (`SolicitationPanel.tsx`) | textarea + outcome select | `Interaction` · Text + Choice(outcome) |
| Add context (`RunView.tsx` InjectContext) | shape input + textarea | `Interaction` · Text, `submit.shape` user-editable |
| Report a problem (`ComplainButton.tsx`) | kind toggles + textarea | `Interaction` · Choice(kind) + Text |

### 1c. Excluded (chrome, not content)

Tabs and counts, run-filter segmented control, state badges, elapsed clocks, attempt
navigation, starter chips, the Live/Paused control, layout, error lines for the surface's
own fetch failures. These describe the surface, not an impulse; routing them through the
planner would record form decisions about UI chrome and pollute the corpus.

---

## 2. The contract

```ts
/** Everything the surface draws, from any source, normalized. */
interface Content {
  shape: string;                         // routing + pin key; never the renderer key
  origin: "impulse" | "response" | "stream" | "panel" | "text";
  body: string | unknown | readonly Chunk[];
  state: "full" | "truncated" | "streaming" | "closed" | "failed" | "absent";
  size?: { shown: number; total: number };
  meta?: readonly MetaChip[];            // exit code, stderr, HTTP status, content-type
  provenance?: { producedBy?: string; executionId?: string; at?: number; source?: string };
}

type Density = "row" | "inline" | "full";

interface RenderPlan {                   // existing, extended
  form: ContentForm;
  text: string;
  decidedBy: "pin" | "learned" | "jev" | "truncated_envelope" | "heuristic" | "default" | …;
  label?: string; meta?: readonly MetaChip[]; envelopeShape?: string;
  confidence?: number;                   // present only when the deciding tier supplies one
}

interface FormRenderer {
  form: ContentForm;
  render(p: { plan: RenderPlan; content: Content; density: Density }): ReactNode;
}

<Rendered content={c} density="full" region="evidence_ledger" />
```

- **Adapters** (`lib/content/`): `fromProvenance`, `fromAnswer`, `fromPanel`,
  `fromResponse`, `fromOutcome`, `fromLog`, `fromGap`, `fromText`, `fromStream`. An adapter
  never chooses a form; it only states what arrived and how complete it is.
- **Planner:** `plan(content, policy)` → `RenderPlan`. Tier order:
  **pin → learned → jev → envelope unwrap → heuristic → `text`**. The `jev` tier is a
  *read* of a learned answer, never a live call from the browser (§5).
- **Registry:** `Record<ContentForm, FormRenderer>`; `FormBody`'s switch becomes the
  registry lookup. Unknown form → `text`.
- **`<Rendered>`** is the only thing callers use. It owns the frame, calls the renderer,
  records the decision, and wraps the renderer in an error boundary that falls back to
  verbatim with the frame intact.
- **Region labels are preserved.** `region` is passed through to `FormDecisionRecorder`
  unchanged (`evidence_ledger`, `answer_card`, `question_card`, plus new labels for new
  sites: `response_history`, `issue_card`, `run_reason`, `walk_log`, `rail_row`,
  `dispatch_outcome`). Existing labels keep their meaning so the corpus does not fork.
- **Row density does not record** a form decision: a one-line clamp is not a judgment about
  how the content should be read.

---

## 3. Wireframes — `<Rendered>`

### 3a. Frame anatomy (full)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [shape_badge]  source · producedBy            0:54   [completeness] [⧉] │ ← header strip
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   body — drawn by the form renderer, at its natural height              │
│   (never an inner vertical scroller; wide rows/code scroll sideways)    │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│ exit 2 · stderr (128 chars) ▸ · 200 OK · application/json               │ ← envelope meta
└─────────────────────────────────────────────────────────────────────────┘
```

### 3b. One `Content`, three densities

```
row     ● substrate_health_tick  success true · shape substrateHealthReport · body {…}   ⟶ one line, clamped

inline  substrate_health_tick                                    vessel-resolve satisfier
        success  true      shape  substrateHealthReport
        body     generated_at 2026-…  lookback_window_seconds 3600  +5 fields ▸

full    substrate_health_tick   vessel-resolve satisfier (substrate_health_tick)   0:54  ⧉
        success  true
        shape    substrateHealthReport
        body     generated_at             2026-09-30T10:38:59.842Z
                 lookback_window_seconds  3600
                 posterior_confidence     total_pairs 0 · pairs_above_floor 0 · floor 10 …
```

Same form at every density; density changes depth and clamping, never the form.

### 3c. Forms that look different

```
record      key        value                 terminal   $ bun test ...................
            key        value                            171 pass
            nested     k  v                             0 fail          exit 0
                       k  v

rows        │ vessel        │ status │ port │   prose     Both 'substrate_health_tick' and
            │ goal-host     │ ok     │ 8210 │             'learned_topology_snapshot' were
            │ discovery     │ ok     │ 8100 │             produced with substantive content…

scalar      1.003120305422936                 diff       @@ -12,3 +12,4 @@
                                                         - old line
                                                         + new line
```

### 3d. Completeness strip (header-right slot)

```
full        (nothing shown)
truncated   first 2,000 of 498,581 chars
streaming   ● streaming · 3.2 KB
closed      stream closed · 14.8 KB
failed      failed — showing what arrived
absent      no content · step ran
```

---

## 4. Wireframes — `Interaction`

```ts
type Question =
  | { kind: "choice"; options: string[] }                       // one of
  | { kind: "score";  levels: string[]; legend?: string }       // ordered
  | { kind: "noul";   statement: string }                       // is this true?
  | { kind: "text";   format?: "text" | "json" };

interface Interaction {
  id: string;
  prompt: Content;                       // drawn by <Rendered>
  questions: { id: string; label: string; q: Question }[];
  submit: { shape: string };             // the *_write shape the answer becomes
  state: "idle" | "pending" | "sent" | "failed";
}

// A human answer is recorded in the same shape a decision model returns:
type Answer =
  | { type: "choice"; choice: string; probabilities?: Record<string, number>; confidence?: number }
  | { type: "score";  score: string;  probabilities?: Record<string, number>; confidence?: number }
  | { type: "noul";   noul: number }     // no confidence field — by construction, not omission
  | { type: "text";   text: string };
```

A human's choice is recorded as probability 1 on the chosen option with no `confidence`
unless the widget asks for one; nothing downstream may read `confidence` off a `noul`.

### 4a. The four question widgets

```
Choice   Did the fix work?
         ( ) Yes, it fixed it   (•) Inert — nothing changed   ( ) Wrong change   ( ) Can't tell

Score    How legible is this?          legend: 1 unreadable … 5 effortless
         [1] [2] [3] [4] [5]

Noul     "The landed change resolves the gap's condition."
         [ No ]  ───────●──────  [ Yes ]        (slider = probability; buttons = 0 / 1)

Text     ┌──────────────────────────────────────────────┐
         │ Your response                                │   Text ▾ / JSON
         └──────────────────────────────────────────────┘
```

### 4b. Shared footer and states

```
[ Send ]  [ Decline ]                                idle
[ Sending… ]                                         pending   (inputs disabled)
✓ Sent                                               sent      (receipt ▸ id · revision)
✗ Not delivered: <reason> — retry sends the same response   failed (same response id)
```

### 4c. Instances

```
Grade         prompt: the run's verdict
              Choice VERDICT_OPTIONS[state] + Text (note)  → goal_verification_label_write (/api/grade)
Question      prompt: panel body; questions: its typed asks (untyped → one Text)
              → participation response (/api/participation)
Waiting walk  prompt: the solicitation evidence
              Text + Choice(answered | declined | insufficient_context) → solicitationResponse_write
Add context   prompt: none; Text + editable shape                 → poolImpulse_write
Report        prompt: the region; Choice(hard to see | hard to understand | wrong) + Text
              → uiFeedback (/api/feedback)
```

---

## 5. Where Jev fits

Jev (TypeSafe's decisions model, reachable through OpenRouter `/api/alpha/decisions` with
the fleet's existing key) answers Choice / Score / Noul questions constrained to the
supplied options. Two uses, both server-side:

1. **Form choice is a Choice question.** A form-learner activity batches one question per
   (shape, content signature class) over `PINNABLE_FORMS` into one call, gates on
   `confidence` by consequence, and writes the confident answers to
   `renderPolicy.learnedFormByShape` via `renderPolicy_write`. The UI reads that at use time
   as the `learned` tier with `decidedBy: "learned"` (or `"jev"` when the entry records Jev
   provenance). The learner also reads the existing `form_decision` corpus and human pins,
   so a human disagreement outranks a model answer.
2. **Human questions and model questions share one type.** Because §4's `Question` is
   Jev's primitive set, a question can be answered by Jev first and routed to a person only
   when confidence is below a consequence-set threshold.

Constraints carried from the Jev probe's naming ruling: no generic `typedDecision` shape
and no `_vN` shape names; each use is a **variant activity at its decision site producing
that site's existing shape** (here `renderPolicy_write`), with Jev recorded as provenance
in the trace. The key never reaches the browser. `noul` answers carry no `confidence`.

---

## 6. Streams

- **Now:** `/api/stream` emits store events (`panel_added`, `panel_updated`,
  `renderPolicy`, `feedback_received`, `observation_recorded`, …) — a notification channel,
  not content. First use: an `EventSource` that invalidates the matching queries (questions,
  render policy, issues) so those views update on change instead of on a poll.
- **Walk progress** is still polled (goal-host exposes no stream).
- **Content streams:** `fromStream` and the `streaming | closed | failed` states exist in the
  contract so a stream is drawn by the form it already has (text, terminal, prose, rows),
  accumulating chunks. No producer exists in the fleet; adding one (LLM token output, live
  shell output) is goal-host / llm-resolver work.

---

## 7. Phases

| # | Work | Where | Needs outside the UI grant |
|---|---|---|---|
| 1 | `Content` + adapters, `<Rendered>` frame, registry, densities, error boundary; migrate §1a sites; read `learnedFormByShape` as a tier | UI | — |
| 2 | `Interaction` contract + four widgets; migrate §1b sites | UI | — |
| 3 | `/api/stream` → query invalidation | UI | — |
| 4 | Typed asks: `AskType` → `choice \| score \| noul \| text`; fix the `{claim, hint}` writer in `development-vessel/src/resolvers/docs-decision-solicit.ts`; audit other `uiQuestion_write` writers (`gap-to-feature.ts`, `ui-write-passthrough.ts`) | human-surface `src/store.ts` + development-vessel | development-vessel change → gap |
| 5 | Form-learner activity (corpus + optional Jev) → `learnedFormByShape` | substrate activity | gap |
| 6 | Confidence-routed questions (Jev first, human on low confidence) | gap lifecycle | gap; coordinator territory |
| 7 | A content stream source | goal-host / llm-resolver | gap |

Phases 1–3 are independent of 4–7; 4–7 each light up an already-present slot.

---

## 8. Validation (pre-registered)

1. **Completeness of migration.** After phase 1, `grep -rn "<pre\|sf-verbatim" ui/src`
   matches only files under the registry (`components/forms/`, `Prose`). Any other hit is an
   unmigrated site.
2. **Error boundary.** A renderer that throws produces the frame intact and a verbatim body
   of the same text (unit test with a throwing stub renderer).
3. **Tier attribution.** Every `form_decision` observation carries
   `decidedBy ∈ {pin, learned, jev, truncated_envelope, truncated, heuristic, unparsed, default, …}`
   and never an empty value; with `learnedFormByShape = {X: "rows"}` and no pin, a shape-X
   impulse records `decidedBy: "learned"` (positive control), and a pin on X overrides it.
4. **Density invariance.** One `Content` rendered at row, inline and full yields the same
   `plan.form` (unit test over the form fixtures).
5. **Corpus continuity.** `region` labels for the three existing sites are unchanged; a
   `form_decision` from the trace still carries `region: "evidence_ledger"`.
6. **Interaction parity.** Each migrated widget writes the same shape and payload it wrote
   before (payload snapshot tests), plus the typed `Answer` alongside.
7. **No row-density recording.** Rendering the rail produces zero `form_decision` rows.
