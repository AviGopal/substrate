# Substrate-authored artifacts — manifest

Append-only log of substrate-authored commits landed on origin/dev. Each
entry records the commit, the version identifier (`{ISO timestamp full
Z (dashes)}-{variant-id}-{vessel}`), and one-line description.

Maintained by substrate-authored manifest-bump commits. Every new
substrate-authored merge to dev follows up with a manifest entry of
its own (also substrate-authored, also published via the composition).

| Commit | Version identifier | Description |
|---|---|---|
| ac67e366 | 2026-06-01-first-substrate-merge-0326 | First end-to-end substrate-published artifact. Documented the composition mechanism. |
| 4ef55761 | 2026-06-01T10-45-30Z-vessel-heartbeat-starvation-scan-development-vessel | Proposed `vessel_heartbeat_starvation_scan` detector — substrate's first authored CAPABILITY artifact (vs documentation). |
| 34410d71 | 2026-06-01T10-49-24Z-substrate-authored-manifest-bump-super-repo | Manifest bump recording 4ef55761 (heartbeat detector). |
| 8cffdce4 | 2026-06-01T10-59-19Z-substrate-self-observation-report-development-vessel | Substrate composed 5 self-detection resolvers + LLM synthesis; published the report. Demonstrated composition + adjustment to unexpected detector counts. |
| _this commit_ | 2026-06-01T11-08-33Z-substrate-authored-manifest-bump-super-repo | Manifest bump recording 8cffdce4. |

## Version identifier format

```
{YYYY-MM-DD}T{HH-MM-SS}Z-{variant-id}-{vessel}
```

- ISO 8601 UTC with colons replaced by dashes (git-safe in refs)
- variant-id: kebab-case identifier of the authored artifact or operation
- vessel: the vessel whose family the artifact belongs to (or `super-repo`
  for super-repo-level operations like this manifest bump)

The combination is globally unique and traceable to the exact authoring
moment without ambiguity. Branch names, proposal subdirectory names, PR
titles, and manifest entries all share the format.

## Reading the manifest

To find what landed when, sort entries by version identifier
lexicographically — the ISO prefix sorts chronologically. To find what
each substrate vessel has authored, filter by the `-{vessel}` suffix.

## Not part of git versioning

These identifiers do not replace semver in vessel `package.json` files —
those continue to follow semver for npm dependency resolution. The
manifest identifies substrate-authoring events, which is a distinct
concern.
