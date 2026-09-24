#!/usr/bin/env bash
# substrate-manifest.sh — print the launch manifest this image was built with.
#
#   docker run --rm --entrypoint substrate-manifest <image> > docker-compose.yml
#
# The bytes are the repository's root docker-compose.yml, baked at build time (the
# build fails if the baked copy differs), so a host with only a container engine
# gets the same declaration a checkout has. Needs nothing a running substrate
# provides: no env file, no systemd.
set -euo pipefail
MANIFEST="${SUBSTRATE_MANIFEST:-/usr/local/share/substrate/docker-compose.yml}"
case "${1:-}" in
  --path) printf '%s\n' "$MANIFEST"; exit 0 ;;
  "") ;;
  *) echo "usage: substrate-manifest [--path]" >&2; exit 2 ;;
esac
[ -f "$MANIFEST" ] || { echo "[manifest] $MANIFEST is missing from this image" >&2; exit 1; }
cat "$MANIFEST"
