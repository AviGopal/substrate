# Vault — Operator's view into the substrate

This vault is a live, read+write Obsidian view of the local substrate's
concept-db (port 18260, host-mapped from substrate-live's 8260). It
exists in the super-repo so that the development loop is one step
shorter: edit a vessel → see what concepts accumulate → write notes that
become substrate concepts → see the substrate use them.

## What gets mirrored here

The metabob-vessel plugin (symlinked into `.obsidian/plugins/metabob-vessel/`
from `repos/obsidian-vessel/`) periodically pulls every concept-db row
visible to the substrate-users org and materializes it under:

```
concept-db/
  vessel_construction_pattern/   # canonical patterns from CLAUDE.md and operator
  extracted/                     # patterns learned from code/usage
  memo/                          # findings, percolations, environmental facts
  impulse_activity_pattern/      # foundation-model concepts
  human_input/                   # operator preferences, corrections
  ...
```

Each note's frontmatter carries the concept's substrate ids and metadata;
the body is the concept's `content`; the `## Related` section renders
typed edges as wikilinks. Obsidian's graph view (`Ctrl+G`) becomes the
substrate's concept graph.

## What you can do here

- **Browse**: file tree, full-text search (`Ctrl+Shift+F`), graph view.
  Quick switcher (`Ctrl+O`) finds notes by short_id, by shape (snake or
  Title Case), or by summary head — all four are in `aliases`.
- **Author**: create a new note under `concept-db/<source_type>/` with
  `concept-db: true` in frontmatter. On save, the writeback service
  upserts to concept-db — your edit becomes a substrate concept.
- **Edit existing concepts**: modify body text or add wikilinks under
  `## Related`. Save propagates back via `/concepts/upsert-by-signature`
  and `/concepts/:id/link`.
- **Watch**: when the substrate's boredom loop or any vessel mints a
  new concept, it appears here within one sync interval (default
  5 min; Phase 4 WS push reduces this to ~5 s).

## What is and isn't committed to git

| Path | Committed? | Why |
|---|---|---|
| `vault/.obsidian/plugins/metabob-vessel/` (symlinks + settings) | yes | so the vault is reproducible across clones |
| `vault/.obsidian/app.json`, `community-plugins.json`, `core-plugins.json` | yes | default Obsidian config |
| `vault/concept-db/**` | **no** | auto-mirrored from substrate; would churn constantly |
| `vault/.obsidian/workspace*`, `cache`, `graph.json` | no | per-machine UI state |
| Other `vault/*.md` notes (operator-authored) | yes | these are your additions |

If you want to commit a substrate-authored concept as a stable snapshot,
copy it out of `concept-db/` into the vault root (or another folder)
under its own filename. Once outside `concept-db/`, the auto-sync leaves
it alone and git tracks it.

## How to open

Obsidian → Open folder as vault → select
`/home/avi/documents/work/exp-repo/metabob-devbob/vault/`.

**First-time setup** (per clone — the API key is not committed):

```bash
# from the super-repo root
KEY=$(jq -r .metabob.apiKey ~/.metabob/config.json)
jq --arg key "$KEY" '.apiKey=$key | .conceptDbApiKey=$key' \
  vault/.obsidian/plugins/metabob-vessel/data.json \
  > /tmp/data.json && mv /tmp/data.json vault/.obsidian/plugins/metabob-vessel/data.json
```

Or just open the vault, go to **Settings → Metabob Vessel**, paste the
key from `~/.metabob/config.json → metabob.apiKey` into both
`apiKey` and `conceptDbApiKey`, reload the plugin.

First sync takes ~5 s and populates `concept-db/` with ~240 notes.

If the plugin's port (27183) collides with another tool, change
`serverPort` in `.obsidian/plugins/metabob-vessel/data.json`. The
other in-tree vault at `/home/projects/minibob/minibob/` uses 27182.

## See also

- `repos/obsidian-vessel/` — plugin source. The `main.js` in this vault
  is a symlink; rebuild via `bun run build` in the repo and the change
  propagates automatically.
- Concept `concept_uleEcEFJvM1Q` — `obsidian_vessel_install_walkthrough`
  in the substrate. Use `mcp__metabob__concept_search` to read it.
- Concept `concept_UA9qz6NRN8z9` — `bidirectional_vault_mirror_pattern`
  for the architectural rationale.
