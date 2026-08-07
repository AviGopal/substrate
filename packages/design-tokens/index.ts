/**
 * @avigopal/design-tokens — typed handles on the CSS custom properties in
 * tokens.css.
 *
 * These exist so the conformance checker and the runtime probe can assert
 * against a token IDENTITY rather than a colour string. A probe that asserts
 * "the row rendered #9E2B2B" breaks the moment the palette is retuned and
 * proves nothing about intent; a probe that asserts "the row rendered
 * var(--sf-not-reached)" is checking the thing that matters.
 */

/** The six states a dispatched run can be in, as the surface renders them. */
export const RUN_STATES = [
  "reached",
  "not-reached",
  "running",
  "waiting",
  "accepted",
  "stalled",
] as const;

export type RunState = (typeof RUN_STATES)[number];

/**
 * `accepted` and `stalled` are deliberately present and deliberately distinct
 * from `running` (rule P10).
 *
 * A dispatch returns 202 with an id; that is `accepted`, and it means the walk
 * was received — not that anything happened. A run that was accepted and then
 * stopped emitting is `stalled`, which is a liveness failure rather than a
 * verdict. Collapsing either into `running` is how a surface shows a spinner
 * for work that died.
 */
export const NON_TERMINAL_STATES = [
  "running",
  "waiting",
  "accepted",
  "stalled",
] as const satisfies readonly RunState[];

/** Only these two are verdicts. Everything else is a stage. */
export const TERMINAL_STATES = ["reached", "not-reached"] as const satisfies readonly RunState[];

export function isTerminal(state: RunState): boolean {
  return (TERMINAL_STATES as readonly RunState[]).includes(state);
}

interface StateTokens {
  /** Foreground custom property, e.g. `var(--sf-reached)`. */
  readonly fg: string;
  /** Background custom property. */
  readonly bg: string;
  /**
   * The human-readable label. State is never carried by colour alone, so every
   * state ships a word as well as a hue.
   */
  readonly label: string;
}

export const STATE_TOKENS: Readonly<Record<RunState, StateTokens>> = {
  reached: { fg: "var(--sf-reached)", bg: "var(--sf-reached-bg)", label: "reached" },
  "not-reached": {
    fg: "var(--sf-not-reached)",
    bg: "var(--sf-not-reached-bg)",
    label: "not reached",
  },
  running: { fg: "var(--sf-running)", bg: "var(--sf-running-bg)", label: "running" },
  waiting: { fg: "var(--sf-waiting)", bg: "var(--sf-waiting-bg)", label: "waiting" },
  accepted: { fg: "var(--sf-accepted)", bg: "var(--sf-accepted-bg)", label: "accepted" },
  stalled: { fg: "var(--sf-stalled)", bg: "var(--sf-stalled-bg)", label: "stalled" },
};

/**
 * The forms an impulse's content can take at the surface.
 *
 * The shape vocabulary is open — the registry advertises hundreds of shapes and
 * the set grows by observation, so no renderer-per-shape is possible. Content,
 * however, arrives in a small closed set of forms. Dispatch on the form; treat
 * the shape as a badge.
 *
 * `text` is the DEFAULT branch and the designed common case, not an error
 * state: most shapes will never earn a bespoke renderer and do not need one.
 */
export const CONTENT_FORMS = ["prose", "text", "rows", "diff", "empty"] as const;
export type ContentForm = (typeof CONTENT_FORMS)[number];

export const DEFAULT_CONTENT_FORM: ContentForm = "text";

/**
 * Verdict options offered when a human grades a terminal run.
 *
 * Mutually exclusive and collectively exhaustive, and there is deliberately no
 * agree-affordance: a correct outcome needs no feedback, and soliciting praise
 * pollutes a corpus that is already a biased failure sample.
 */
export const VERDICT_OPTIONS: Readonly<Record<"reached" | "not-reached", readonly string[]>> = {
  reached: ["Didn't do it", "Did the wrong thing", "Right idea, wrong change", "Unsafe"],
  "not-reached": [
    "It actually worked",
    "Failed for a different reason",
    "Shouldn't have been tried",
  ],
};

export const TOKENS_CSS_PATH = "@avigopal/design-tokens/tokens.css";
