# vault-cleanup

One-shot scripts that repair vault corruption caused by sync-loop bugs in the
obsidian-vessel ⇄ concept-db pipeline. Each script is dry-run by default and
requires an explicit `--apply` flag to mutate the vault.

## `dedupe-concept-notes.ts`

Repairs the writeback echo loop documented in
[`concept_kxeA7gRK7NEW` (`writeback_echo_loop`)](../../vault/concept-db/) and
the round-trip invariant [`concept_HqdWDywYZzK3`
(`round_trip_idempotence_contract`)](../../vault/concept-db/). The render path
in `obsidian-vessel/src/formatters/concept-formatter.ts` prepends `# <title>`
and three callouts (`> [!abstract] Summary`, `> [!info] Stats`,
`> [!quote] Source`) to `concept.content` before writing the note; the prior
`stripRelated` in `concept-writeback.ts` stripped only the trailing
`## Related` block, so the wrap rode back into `concept.content` and each
subsequent pull re-rendered on top of the accumulated wrap. Verified
manifestation: `vault/concept-db/extracted/Api Contract Validation Failure.md`
contained four copies of the heading + abstract + info + quote block. The
inline write-side fix lives in
`repos/obsidian-vessel/src/sync/concept-writeback-strip.ts`
(`stripWritebackEnvelope`); this script repairs the ~511 vault notes that
accumulated wrap copies before that fix shipped.

The script keeps the FIRST heading + callout block, drops every subsequent
duplicate, and leaves all other note content (including user-authored
callouts of other types) untouched.

```bash
# Default = dry-run; prints a per-file summary and a header total.
bun scripts/vault-cleanup/dedupe-concept-notes.ts

# Apply the rewrite to the live vault. Run only after reviewing the
# dry-run output.
bun scripts/vault-cleanup/dedupe-concept-notes.ts --apply

# Override the default vault root.
bun scripts/vault-cleanup/dedupe-concept-notes.ts --vault /path/to/vault/concept-db
```
