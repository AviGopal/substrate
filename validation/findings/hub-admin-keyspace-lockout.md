# The hub's admin key was never written to disk — it existed once, on a terminal

**Observed on:** `syzygy.host` / container `substrate-live` (hub, up 10 days).
**Symptom:** `substrate-key issue <name>` and `substrate-key list` both fail with
`FORBIDDEN: Minting a 'admin'-role token requires admin entitlement`.

## What is actually true

`SUBSTRATE_ADMIN_KEY` is empty in `/etc/substrate/env` and in the persisted
`/workspace/.substrate-secrets`. But the key itself **exists and is active**:

    substrate-admin   read,write,admin   active=true   created 2026-07-16T11:15:10Z
    org=organizations:substrate  user=users:4544jr3vsin6iyi6h3ar

Same org and user as the operator key, so it would work today — if anyone held its
plaintext. `api_key` stores only a SHA-256 hash, so the row survives while the usable
secret does not.

## Why the value is not on disk

It was never written there. It did not vanish.

`seed-identity.ts` is the **only** code path that round-trips the minted admin key into
`/etc/substrate/env` and `.substrate-secrets` (`:271-273`), and it does so only on the
**genuine first-boot branch**. This hub's first boot was 2026-07-01 — every key from that
sequence (`substrate-default`, `local-tools-vessel`, `goal-host-vessel`, `concept-db`)
carries that timestamp. `substrate-admin` was minted 15 days later, on 07-16, so it did
not come from that path.

It was minted out-of-band, through `/v1/keys/issue` (`substrate-key issue` or the keyctl
CLI). Evidence: `keyctl-flow-probe` was minted **19 seconds after it**, so an operator or
probe session was exercising the key-issue flow at that moment. That endpoint returns the
plaintext in its HTTP response and persists only the hash. Nothing writes it to the env
files. The value existed exactly once — in the response on someone's terminal on
2026-07-16 — and was never persisted.

A `seed-identity.ts` run on 07-16 could not have minted it either: the org already
existed, so signup returns 409 and that branch returns at `:203` without touching the
admin key.

## What is NOT the cause (ruled out)

- **Not clobbered by a rewriting writer.** Both round-trip mechanisms are sound:
  `gen-env.sh:272` recovers the value from the persisted file, and `secrets.env.sh`
  merges rather than truncates, carrying through every key it does not own (`:83-84`).
  They had nothing to carry.
- **Not a wiped secrets file.** `METABOB_API_KEY` is still the original 07-01 credential
  — there is exactly one `substrate-default` row, and the live key validates against it.
  Had `.substrate-secrets` been lost, the 409 branch would have re-issued that key and
  left a second row. The file has carried values continuously since July.

## The class

`/v1/keys/issue` mints admin-scoped credentials with **no durable record of the
plaintext anywhere**, while `SUBSTRATE_ADMIN_KEY` — the variable the SEC-5 gate depends
on — is populated by a completely different code path that runs only on first boot. A key
minted through the supported operator surface therefore does not update the operator
surface's own credential. An empty `SUBSTRATE_ADMIN_KEY` alongside an active
admin-scoped row is a silently-tolerated state that nothing detects, and it becomes a
hard lockout the moment SEC-5 lands.

`BRINGUP_THREE_PATHS.md:1121` recorded the empty variable as an observation.
`PROCESS_MAP_2026-08-24.md:1637` separately recorded a live box where `substrate-admin`
was present and active. Both were true, and neither connected them.

## Consequence for the proposed repair

A bootstrap endpoint gated on "refuse when an active admin key already exists" would
**refuse on this hub** — that is precisely the current state. Any repair must handle
"an active admin row whose plaintext is unrecoverable," which cannot be distinguished
from "an admin key someone still holds" by inspecting the database. Revoking the orphaned
row to mint a replacement is the honest operation only if no one holds the 07-16 value —
an operator question, not a code question.

Durable fixes, independent of this incident:
- Have `/v1/keys/issue` round-trip an admin-scoped mint into `SUBSTRATE_ADMIN_KEY`, so
  the supported surface maintains the credential the gate reads.
- Detect the lockout state at boot: an active admin-scoped row plus an empty
  `SUBSTRATE_ADMIN_KEY` means key management is already unreachable.

## Explicitly not done

Editing the user's role in SurrealDB and forging an admin JWT from `JWT_SECRET` would
both unblock this immediately. Both are refused: CLAUDE.md forbids hand-editing the
database and bypassing PERMISSIONS, and the forged JWT is the exact escalation SEC-5
exists to prevent, on a host already flagged as internet-exposed. Database access here
was read-only diagnosis. Re-running `seed-identity.ts` is safe but useless (no-ops at
`:203`); re-seeding fresh would mint a new org and orphan the hub's data.
