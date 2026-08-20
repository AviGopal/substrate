# Re-mapping the setup surface after the fixes

The prior map (`SETUP_UX_MAP.md`) found 48 defects. A round of fixes was applied,
then four agents re-mapped the surface and an independent judge graded the
result. This is what held, what did not, and where the environment now stands.

The most useful finding is that **two of my own fixes were wrong**, and both were
wrong the same way: verified at the wrong layer.

---

## The two self-inflicted defects

### 1. The ExecCondition repair broke every arm, including keyed ones

The original bug: `grep -Eq "^ANTHROPIC_API_KEY=.+"` matched the two *quote
characters* in `ANTHROPIC_API_KEY=""`, so the guard meant to skip keyless arms
passed on every host.

My repair used a shell-style `'"'"'` escape to match a quote. That is a **bash
concatenation trick** — systemd is not a shell, does not honour it, and handed
`/bin/sh` a string with an unterminated quote:

```
/bin/sh: -c: line 1: unexpected EOF while looking for matching "
zzt-bvalue.service: Skipped due to 'exec-condition'
```

**Old bug: every arm ran on every host. New bug: no arm ran on any host** — and
it failed as a *clean skip*, so units read `inactive (dead)`, nothing went red,
and a substrate with no LLM arms would present as universal reach failure with
no obvious cause.

I tested the regex in bash, which re-processes the quoting and passes. An agent
tested it through **real systemd** with marker units and controls
(`ExecCondition=/bin/true` STARTED, `/bin/false` SKIPPED) and got 11/11 shapes
skipped, including real keys.

The fix now avoids double quotes entirely — `[^=]*[A-Za-z0-9]` requires one
alphanumeric after the `=`, which quotes and whitespace are not. Verified
through systemd across five shapes:

| value | result |
|---|---|
| `="sk-real"` | STARTED |
| `=bare` | STARTED |
| `=""` | skipped |
| `=` | skipped |
| `="   "` | skipped |

The last is a genuine improvement — whitespace-only was accepted before.

### 2. The role split governed unit names that nothing renders

The inventory governs `llm-resolver-*.service`. But `entrypoint.sh` **renders**
the arms that actually run — `llm-opus`, `llm-haiku`, `llm-google` — *after*
`apply-inventory`, under names the inventory never contains, then
wants-symlinked them unconditionally.

So no selection lever reached them: not `ENABLED_ROLES`, not `DISABLED_VESSELS`
(its mask loop iterates inventory-named units only), and not an operator's
`systemctl disable` — the loop re-created the symlink on the next boot.

Moving `llm-resolver-*` to role `models` fixed the names nothing renders, while
the arms that actually run stayed ungoverned. Confirmed live at the time:
`substrate-live` was running `llm-google.service` with `GOOGLE_API_KEY=""`.

The symlink loop now asks the same expander `apply-inventory` used (so the two
cannot drift), skips when role `models` is absent, honours `DISABLED_VESSELS` by
rendered name, and treats `PROFILE` / `ENABLED_VESSELS` as the allow-lists they
are.

**Caught while testing:** the gate first read `apply-inventory` with
`2>/dev/null` — but that script logs to **stderr**, so it discarded the line it
was matching and would have disabled the arms on *every* topology. A third
instance of the same mistake, found by testing rather than reading.

---

## Verified in production

`substrate-live` was recreated from the rebuilt image, so these are measured on
a running fleet, not in the repo:

```
llm-opus     active     key_len=108
llm-haiku    active     key_len=108
llm-google   inactive   key_len=0
```

Keyed arms run, the keyless arm does not. The doctor agrees:
`PASS 2/2 llm arm(s) answered a real completion`.

**`substrate-config` works and immediately earned itself:**

```
ANTHROPIC_API_KEY    env        sk-ant… (108 chars)
METABOB_API_KEY      persisted  mb-b3J… (160 chars)
SURREAL_PASS         persisted  818e6d… (32 chars)
GOOGLE_API_KEY       hardcoded  (empty)
MITOSIS_DIRECT_PUSH  hardcoded  1
```

The `env` vs `persisted` distinction is the question nothing could previously
answer. It shows at a glance that `ANTHROPIC_API_KEY` came from the operator
while `METABOB_API_KEY` is a *prior boot's* value still in force — which is
exactly the invalid key behind the remaining doctor failures.

`identity-seeder` now **fails loudly** instead of reporting success on a rejected
key, which is the `seed-identity.ts` fix working: it reads `data.valid` rather
than treating HTTP 200 as a pass.

---

## What is still broken

**The keyspace in the `substrate-surreal` volume is unrecoverable through
supported paths.** The fleet key is rejected by both identity endpoints, there is
no `API_KEY_SECRET_PREVIOUS`, no `SUBSTRATE_ADMIN_KEY`, and the seed credential
no longer opens the org — the seeder reports this accurately now:

> org exists but the seed credential no longer opens it; the keyspace needs
> manual recovery

Three doctor checks fail from this one cause (seeded API key, hollow registry,
failed `identity-seeder`). The same datastore holds **17 GB** of learning state,
and CLAUDE.md forbids hand-editing the database, so this is left alone and
flagged rather than worked around. It needs an operator decision: recover the
keyspace, or accept a fresh identity namespace against the existing traces.

**Not addressed this round:** `docs/SUBSTRATE.md`'s role enumeration is now stale
— it lists `store, control, api, compute, ui, transport, seed, infra, autonomy`
and omits `models` (new), plus `registry` and `desktop` (pre-existing). The
`hub`/`spoke` group lines omit `registry` too. `deploy-hub-pull.sh` carries a
comment asserting the LLM resolver is masked on a hub, which the `models` role
makes false (the unmask it performs is now a harmless no-op).

---

## The standing lesson

Three defects in one round, all the same shape: **verified one parsing layer
above where the thing actually runs.** A regex checked in bash but consumed by
systemd. A grep matching stdout when the source writes stderr. A role applied to
names that a later render step replaces.

The rule this earns: *test at the layer that consumes the artifact, not the layer
that is convenient to test from.* A passing check one layer up is not weak
evidence — it is evidence about a different system.
