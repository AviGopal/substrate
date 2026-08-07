# @avigopal/design-tokens

The single source for the human surface's design values.

**The contract: a colour literal written anywhere outside this package is a conformance
violation** (rule `P11`, enforced by `@avigopal/interaction-conformance`). Surfaces consume
these custom properties; they do not re-author them. This package exists because the same
values were previously authored in three places — a Tailwind config, a `design-token`
component, and a `:root` block inside a template literal — and a value re-authored in three
places cannot be checked in one.

## Usage

```ts
import "@avigopal/design-tokens/tokens.css";
import { STATE_TOKENS, isTerminal, type RunState } from "@avigopal/design-tokens";
```

Tailwind 4 picks the tokens up through the `@theme inline` block in `tokens.css`, so
utilities resolve to them. CSS-first config is the reason Tailwind 4 was chosen: the tokens
live in CSS, where a checker can read them, rather than in a JavaScript config object.

## The semantic state palette

This is the load-bearing part of the package.

`reached` and `not-reached` are defined at **equal visual weight** — matched lightness and
chroma magnitude, in both themes. Neither may be quieter than the other. That pair is the
entire design thesis encoded as two tokens: a surface cannot render a hollow completion as a
success when failure is as loud as success.

Six states, all mutually distinguishable, none carried by colour alone — every state ships a
`--*-label` token as well as a hue:

| Token | Meaning |
|---|---|
| `reached` | the goal was met |
| `not-reached` | the walk finished and did not meet it |
| `running` | in flight, emitting |
| `waiting` | blocked on a human answer |
| `accepted` | a dispatch id exists and nothing else does |
| `stalled` | accepted, then silent — a liveness failure, not a verdict |

`accepted` and `stalled` are deliberately distinct from `running` and from each other
(rule `P10`). A dispatch returns 202 with an id; that means the walk was *received*, not that
anything happened. Collapsing either into `running` is how a surface shows a spinner for work
that has already died.

## The accent is deliberately recessive

On a surface whose job is honest verdicts, the loudest colour must be state, not brand. If
the accent ever competes with a state colour, the accent is wrong. This inverts the usual
arrangement, and it is the point rather than an oversight.

## Type

Three roles, because this surface carries three kinds of content that must not look alike:

- `--sf-font-sans` — UI chrome
- `--sf-font-serif` — human prose rationale
- `--sf-font-mono` — machine record

System stacks only. There is no `@font-face` and no webfont URL anywhere in this package: a
surface that fetches a font from the public internet is not location-independent, and would
fail closed in an air-gapped deployment.

## Themes

Light is the base on `:root`. Dark arrives two ways, and both are required:

1. `@media (prefers-color-scheme: dark)` — the OS signal.
2. `:root[data-theme="dark"]` / `:root[data-theme="light"]` — an explicit toggle, which must
   beat the media query **in both directions**. That is why the light values are repeated
   under an explicit `data-theme="light"` block rather than left to the base cascade.

Every state token meets AA contrast against its own background token in both themes.

## Why typed constants

`index.ts` exports token identities so the conformance checker and the runtime probe can
assert against a token *name* rather than a colour string. A probe asserting "the row
rendered `#9E2B2B`" breaks the moment the palette is retuned and proves nothing about intent;
a probe asserting "the row rendered `var(--sf-not-reached)`" checks the thing that matters.
