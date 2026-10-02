# Recovery Bundles

Git bundles stored here are **recovery artifacts** for vessel repos
that exist in `repos/` but are tracked as ghost-submodules (gitlink
mode 160000) without a `.gitmodules` entry, OR whose remotes are not
provisioned on GitHub yet.

Per audit F-138 (inv-054, 2026-05-27): the super-repo previously had
three local-only ias-executor-ts commits at risk of orphan if
`git submodule update` ran. Bundles here are the recoverable backup.

## Restore a bundle

```bash
cd /tmp
git clone /path/to/super-repo/validation/recovery/<bundle> ias-executor-ts-restored
cp -r ias-executor-ts-restored/.git /path/to/super-repo/repos/ias-executor-ts/
```

Or apply to an existing repo:
```bash
cd repos/<vessel>
git fetch /path/to/super-repo/validation/recovery/<bundle> <branch>:<branch>
```

## Bundle index

| Bundle | Vessel | Generated | Heads | Notes |
|---|---|---|---|---|
| `ias-executor-ts-2026-05-27.bundle` | ias-executor-ts | 2026-05-27T11:50Z | `dev` at b6b58a2, `main` at 750f6be | F-138 closure — recovery for 3 commits (161eede, 37a9ddb, b6b58a2) ahead of super-repo gitlink (49bfb43) |
