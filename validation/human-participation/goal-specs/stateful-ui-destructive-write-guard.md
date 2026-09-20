# SPEC C-1 — stateful-ui `/resolve` must stop destroying live panels

**Change `repos/stateful-ui-vessel/src/index.ts`** so the `uiPanel_write` /
`uiQuestion_write` branch of its `/resolve` handler preserves omitted fields,
refuses a contentless write over an existing panel, and rejects a non-string
`body` instead of coercing it — in that order, because the coercion rewrite is a
precondition for the guard.

This is the vessel that actually bleeds: every live `uiQuestion_write` lands here,
directly or forwarded verbatim by `repos/development-vessel/src/resolvers/ui-write-passthrough.ts:30-34`.
Observed 2026-09-20: **449 panels** in stateful-ui, **0** in human-surface.

## 1. Current behaviour (quoted)

`repos/stateful-ui-vessel/src/index.ts:325-333` — every field defaulted with `??`,
then unconditionally written:

```ts
const title = String(pointer.title ?? "Untitled");
const panelBody = String(pointer.body ?? "");
const kind = String(pointer.kind ?? (t === "uiQuestion_write" ? "question" : "info"));
const importance = String(pointer.importance ?? "medium");
const asks = Array.isArray(pointer.asks) ? (pointer.asks as Ask[]) : undefined;
const panel = upsertPanel({ id, title, body: panelBody, kind, importance, asks, visibility });
return c.json({ resolved: true, shape: t, body: panel });
```

Strictly worse than human-surface: **no `revision` field** (`src/store.ts:30-40`
has `id,title,body,kind,importance,asks?,visibility,createdAt,updatedAt` only),
**no no-op short-circuit** (`src/store.ts:157-173` always sets `updatedAt: now`,
`persist()`s and emits), and `??` **cannot distinguish absent from null**.
Contrast `repos/human-surface-vessel/src/store.ts:145-146` (deep-equal
short-circuit) and `:140` (`revision: (existing?.revision ?? 0) + 1`).

Executed against a disposable `UI_STORE_PATH`, never the live store
(`validation/human-participation/stateful-ui-c1-red-before.ts`): a defaulted
`{type,id}` over a seeded 6-claim panel returned `200 {"resolved":true}` and left
`title:"Untitled" body:"" importance:"medium"`, `asks` **gone**; `body:{a:1}`
stored `"[object Object]"` with `resolved:true`; explicit `title:null` became
`"Untitled"`.

## 2. Required behaviour

Ordered. A drafter who adds the guard without part (a) produces something that
cannot work: `??` erases the absent/null distinction the guard is defined over.

**(a) Rewrite every `??` default to `Object.hasOwn`.** Look up the existing panel
first — `const existing = listPanels().find((p) => p.id === id)` (`store.ts`
exports no `getPanel`; do not add one in this goal). Then for each of
`title, body, kind, importance, asks, visibility`:

```
Object.hasOwn(pointer, K) ? coerce(pointer[K]) : (existing?.K ?? literalDefault)
```

`id` keeps `String(pointer.id ?? \`panel-${Date.now()}\`)`. Literal defaults are
unchanged and apply **only when `existing` is undefined**: `"Untitled"`, `""`,
`"question"`/`"info"` by shape, `"medium"`, `undefined`, `"public"`. An explicit
`body: ""` (or `title: ""`) still **clears** — presence is information.

**(b) Reject a non-string `body` with `400`.** `Panel.body` is typed `string`
(`store.ts:33`); coercing an object to `"[object Object]"` while returning
`resolved: true` is a success claim over destroyed content. When
`Object.hasOwn(pointer,"body")` and `typeof pointer.body !== "string"`, return
`{resolved:false, shape:t, error:"body must be a string; received <typeof>. Nothing was written."}` at `400`, writing nothing. Preserving structured bodies instead
would require widening `Panel.body` to `unknown` across store/hydrate/UI — a
**separate, later goal**.

**(c) Refuse a contentless write over an existing panel with `409`.** With
`CONTENT_KEYS = ["title","body","kind","importance","asks","visibility"]`:
if `existing && !CONTENT_KEYS.some((k) => Object.hasOwn(pointer, k))`, return
`{resolved:false, shape:t, error:"contentless write refused: panel '<id>' already exists and this <t> carried no content-bearing field (…). Nothing was changed."}` with status **409**, and do not call `upsertPanel`. Without (c), part
(a) turns destruction into a silent green no-op — hollowness traded for
erasure — and, lacking a `revision`, the caller has no way to see nothing moved.
A fresh id with no content still **creates** with the literal defaults.

## 3. What must NOT change

* `repos/stateful-ui-vessel/src/store.ts` — **byte-identical**, `upsertPanel`
  at `157-173` included. No `revision`, no short-circuit in this goal.
* The `uiQuestion` **read** branch (`index.ts:334-345`) and its kind filter.
* `app.post("/api/panels")` (`index.ts:102-120`) — a second write path that keeps
  the old `??` defaulting. Out of scope; residual hole, see §6.
* `asVisibility` (`index.ts:75-77`), the unsupported-type `400` at
  `index.ts:346`, and the success shape `{resolved:true, shape, body}` for
  legitimate writes.

## 4. Falsifier

Port `repos/human-surface-vessel/test/blocker4-repro.test.ts` to
`repos/stateful-ui-vessel/test/blocker-c1-repro.ts`, **dropping every `revision`
assertion** (this vessel has none). `src/index.ts` exports no Hono `app` and
`startDiscoveryRegistration` fires on import, so the harness **spawns the
vessel** rather than calling `app.request`:

```
UI_STORE_PATH=$(mktemp -d)/ui-panel-store.json PORT=<free> HOST=127.0.0.1 \
DISCOVERY_VESSEL_ENDPOINT=http://127.0.0.1:1 bun run src/index.ts
```

`STORE_PATH` is captured at module load (`store.ts:104`, default
`/workspace/state/ui-panel-store.json`) and `hydrate()` runs on import, so
`UI_STORE_PATH` must be set **before the process starts**, and **must never point
at the live store file**: `writeNow()` (`store.ts:111-112`) snapshot-writes the
*whole* store, so a test aimed there replaces 449 real human escalations with the
test's handful, with no history to recover from.

Cases, all behavioural (no literal match — a comment cannot satisfy any):

1. Seed a panel with a 6-claim body + one ask; send `{type,id}` only.
   Assert `[400,409].includes(status)`; assert the record read back from
   `GET /api/state` is **deep-equal to the pre-write snapshot**.
2. `body:""` after a seeded body → `200`, stored `body === ""`, `title` and
   `kind` preserved.
3. Title-only update → `200`, new title, `body`/`asks`/`kind`/`importance`
   preserved.
4. `body:{a:1}` → `400`, and the id has **no** stored record (or the prior one
   unchanged). Fails today: currently `200 resolved:true` / `"[object Object]"`.
5. `title:null` on an existing panel → title is **not** `"Untitled"`.
6. **Positive control:** a fresh id with `{type,id}` only → `200` and
   `title:"Untitled" body:"" kind:"question" importance:"medium"
   visibility:"public"`; via `uiPanel_write`, `kind:"info"`. This is what stops
   the fix degenerating into "refuse everything" — without it, a handler that
   409s unconditionally passes cases 1-5.

## 5. Circularity, and the two required mitigations

Dispatching this goal runs the very walk that is currently destructive, against
449 live panels that are real human escalations. Both mitigations are required:

1. **Route away from the satisfier branch.** The lead sentence names
   `repos/stateful-ui-vessel/src/index.ts`, so the goal takes the
   edit-intent/`feature_compose` path instead of the ACTION-THEN-READ satisfier
   branch that issues defaulted `uiQuestion_write`s.
2. **Snapshot immediately before dispatch.** Verified read-only — `/api/state`
   (`index.ts:88-97`) is a `GET` composed purely of `listPanels()` /
   `recent*()` readers:

```
docker exec substrate-live sh -lc \
  'curl -s -m 15 http://127.0.0.1:8270/api/state' \
  > validation/human-participation/snapshots/stateful-ui-prerepair.json
```

Observed at capture: `{"panels":449,"feedback":5,"newest":"needs-human-reach-gap-test-report"}`;
`/health` reports `panels:449`. The store keeps no history, so this snapshot is
the **only** recoverability that exists — without it, destruction during the
repair is invisible. Host port `18270` is **unmapped** (`000`, while `18080` and
`18210` return `200`), so the container address above is the working one.

## 6. Risks and blast radius

* Callers that today send an object `body` begin receiving `400`. Intended
  loudness; it replaces a silent `"[object Object]"`. `gap-to-feature.ts` and
  other producers should be surveyed after landing.
* `ui-write-passthrough.ts:38-45` maps a non-2xx to `{ok:false, error:"stateful-ui-vessel 409"}`
  but still returns a `ResolverResult`, so whether the walk reads that as
  unresolved is **unverified** (gated file, observation only) — follow-up gap.
* `POST /api/panels` keeps the old defaulting; the browser UI is its only caller
  today, so it cannot be driven by a defaulted satisfier — still a residual hole
  worth its own gap.
* A visibility-only write stays legitimate: `visibility` is content-bearing.
