# Data-driven LLM-resolver arms — one config line per (model, provider) arm, rendered at boot, findable fleet-wide within the namespace

**Date:** 2026-07-19
**Vessels:** scripts/substrate (boot render + wiring), llm-resolver-vessel (per-arm provider pin)
**Stage:** SPEC + tested generator (the renderer is built and unit-tested in isolation; the boot cutover + the one src change remain)
**Lever:** operator ask #7, ratified 2026-07-19 — *"one provider per unit, but nothing hardcoded; in the hub setup we should be able to configure that multiple start, and adding new vessels should be simple regardless of where they are so long as they are in the same discovery."*

## Problem

The LLM arms are hand-authored: three static `.service` files (`units/llm-resolver-{opus,haiku,google}.service`) + three `.service.d/model.conf` drop-ins + three `gen-env.sh` lines writing `llm-{opus,haiku,google}.env` + three names in the `Dockerfile.substrate` enable list. Adding a fourth arm touches four places and bakes a new unit into the image. Worse, every arm inherits **all** provider keys from `/etc/substrate/env`, so a "pinned to opus" arm silently serves via a sibling provider when Anthropic credit dies — `vessel_id != served model`, and the arm never de-advertises, so discovery keeps routing to a dead-Anthropic arm (the recurring credit-death class). Live-confirmed 2026-07-19: the running spoke advertises `llm-resolver-{opus,haiku,vessel}` locally + three `@syzygy-hub` mirrors, all undifferentiated — and the `google` arm was absent because it was never in the enable list.

## Approach (built + tested)

A declarative arm list — `scripts/substrate/llm-arms.json`, `{arms:[{id,model,provider,port}], provider_key_env:{...}}` — and a renderer `scripts/substrate/render-llm-arms.sh` that, per arm, writes a **single-provider** `llm-<id>.env` (`LLM_DEFAULT_MODEL` + `LLM_PINNED_PROVIDER`) and one systemd unit gated by `ExecCondition` on that provider's key (keyless host ⇒ clean skip, law 11). The whole list is overridable at deploy time via the `LLM_ARMS` env (JSON array) — nothing about the arm set is hardcoded in a unit. Verified in isolation: the default list renders opus/haiku/google with correct per-provider gating; `LLM_ARMS='[{"id":"kimi",…,"provider":"groq",…}]'` renders a new arm with no code change; unknown providers skip non-fatally.

Because each arm is one `(model, provider)` pinned instance registering through discovery, `vessel_id == llm-resolver-<id>`, its quota == its provider's quota, and — with the src change below — it de-advertises when that provider cools so callers resolve to a live arm (the `interchangeable` genre in the companion `vessel-duplicate-genres` change does the selection). Adding an arm is one config line and it is selectable fleet-wide within the namespace, regardless of host.

## Cutover (remaining)

1. [config] `entrypoint.sh` / boot: call `render-llm-arms.sh` after `gen-env.sh`, then enable the rendered `llm-<id>.service` set (respecting role/inventory subsetting so a spoke can drop local arms and inherit the hub's).
2. [config] Remove the three static `units/llm-resolver-{opus,haiku,google}.service` + their `.d/model.conf`, the three `gen-env.sh` `llm-*.env` writes, and the three `Dockerfile.substrate` enable lines — the renderer supersedes them.
3. [config] Declare the rendered arms in `vessels.inventory.json` (role `compute`, genre `interchangeable`) so `apply-inventory.sh` can enable/disable them by role.
4. [src] `repos/llm-resolver-vessel/src/index.ts`: read `LLM_PINNED_PROVIDER` and gate `hasCompletionQuota` / `syncCompletionAdvertisement` to exactly that provider, so a pinned arm de-advertises on its provider's exhaustion instead of falling back. Remove the hardcoded `DEFAULT_MODEL='claude-sonnet-5'` / `availableModels` literals (derive from the pin + keyed providers).

The cutover is boot-critical and needs a container rebuild to validate end-to-end (`make -C scripts/substrate build` + a boot + a `registry_query llm_completion` showing the rendered arms), which is why it is staged behind the already-tested renderer rather than landed blind.

## Law-1 boundary (added on self-review)

The provider/model **pin** is bootstrap identity — it defines what the vessel *is* (which credential it holds), like `VESSEL_ID` and ports, and is legitimately env/unit-file material. Everything *behavioral* stays shaped: quota state is advertised (and withdrawn) through discovery at use time; selection across arms is the learned `interchangeable` genre policy; nothing routes on the pin directly. **Open gap filed with this change:** the arm *list* itself (`llm-arms.json` / `LLM_ARMS`) is boot-time config the substrate cannot observe as a shaped impulse — the fleet composition should additionally surface as a shape (e.g. an arm-inventory impulse emitted at render time) so the system can see, and eventually steer, its own arm fleet rather than only the operator editing config. Until then this change is materialization-only and must not grow behavioral switches.

## Failure-mints-structure (law 6) — class detectors owed alongside the instance fixes

- **Dead-arm-still-advertised:** an activity that cross-checks each advertised `llm_completion` producer against a probe completion (or its own quota report) and files a gap when an advertiser cannot serve — the class behind every credit-death recurrence.
- **Enable-list omission:** an activity that diffs defined units (rendered arm set / units dir) against the enabled set at boot and files a gap for silently-never-started vessels (the google-arm class).
- **Build/run tag drift:** an activity (or doctor check) that asserts every deploy script's run/save image reference matches the tag the build path produces (the metabob/ vs ghcr.io/ class).

## Non-goals

Cross-provider routing *within* one arm (the whole point is one provider per arm). The `interchangeable` genre selection across arms is the companion genre change, not this one.
