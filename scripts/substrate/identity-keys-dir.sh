#!/usr/bin/env bash
# identity-keys-dir.sh — create identity's key directory (org keys 1a), before any unit starts.
#
# WHY. The org root's private part lives in one directory on the state volume. Every service masks it
# (units/service.d/07-identity-keys-out-of-reach.conf: InaccessiblePaths=-<dir>), and identity-vessel reaches it only
# through a bind (units/identity-vessel.service.d/30-identity-keys-bind.conf). A mask on a path that is absent when a
# unit starts is skipped ('-'), so the directory must exist before systemd starts anything (the entrypoint calls this
# first). A mask names a PATH: if the directory or any directory above it were a symlink, the mask would name one place
# while the key lived at another, so a symlink anywhere on the path is refused, and nothing is created. That is the
# refusal identity itself cannot see from inside its namespace, where the directory is masked too; identity's create
# then stays refused (no directory).
#
# It creates the directory once (mkdir, never -p, never over a symlink), and only ever chmods it in place: it never
# removes, renames or recreates it, and never reads what is inside. It is excluded from every backup and copy of the
# state volume (see the commit body): losing it means a new generation, by a person, never a restore.
#
# usage: identity-keys-dir.sh [dir]     (default /workspace/.substrate-identity-keys)
# exit 0: the directory exists as a real directory, mode 0700. exit 1: refused, said on stderr.
set -uo pipefail
DIR="${1:-/workspace/.substrate-identity-keys}"
case "$DIR" in /*) ;; *) echo "identity-keys-dir: refused: $DIR is not absolute" >&2; exit 1 ;; esac
p=""
IFS=/ read -ra parts <<< "${DIR#/}"
for part in "${parts[@]}"; do
  [ -n "$part" ] || continue
  p="$p/$part"
  if [ -L "$p" ]; then echo "identity-keys-dir: refused: $p is a symlink" >&2; exit 1; fi
done
parent="$(dirname "$DIR")"
[ -d "$parent" ] || { echo "identity-keys-dir: refused: $parent does not exist" >&2; exit 1; }
if [ -e "$DIR" ]; then
  [ -d "$DIR" ] || { echo "identity-keys-dir: refused: $DIR exists and is not a directory" >&2; exit 1; }
  chmod 0700 "$DIR" || exit 1
else
  mkdir -m 0700 "$DIR" || exit 1
fi
echo "identity-keys-dir: ready"
