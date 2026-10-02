#!/usr/bin/env bash
# vessel-tree-hash — one content hash over the part of a vessel that pull-sync can change.
#
#   vessel-tree-hash <vessel-dir>     prints 16 hex characters
#
# The image records it per vessel at build time (vessel-tree.sha256) and substrate-status
# recomputes it on the running /vessels/<v>, so "does this node still run the code its
# image baked" is answered by one command on both sides. Its surface follows what
# pull-sync converges (content_hash and tracked_output_dirs in substrate-pull-sync.sh,
# copied by mirror-to-live): the src/, sql/ and scripts/ trees, package.json and bun.lock
# (a dependency change triggers a clean install), and build output under a NESTED dist/
# (ui/dist), committed because nothing rebuilds it on pull. A top-level dist/ is the
# image's own build output and pull-sync never ships one, so it is left out, as are
# node_modules. Every file under those paths counts, whatever its extension: an asset
# left behind is drift too.
#
# It reads only the tree on disk (the runtime has no .git), so it cannot tell a tracked
# nested dist from an untracked one; at build time and at run time it sees the same
# tree, which is all a comparison needs.
set -euo pipefail
d="${1:?usage: vessel-tree-hash <vessel-dir>}"
cd "$d"
{
  find src sql scripts -type f -not -path '*/node_modules/*' 2>/dev/null || true
  for f in package.json bun.lock; do [ -f "$f" ] && printf '%s\n' "$f"; done
  find . -path '*/node_modules' -prune -o -type f -path './*/dist/*' -print 2>/dev/null \
    | sed 's|^\./||' | awk '!/^dist\//' || true
} | LC_ALL=C sort -u | tr '\n' '\0' | xargs -0 -r sha256sum | sha256sum | cut -c1-16
