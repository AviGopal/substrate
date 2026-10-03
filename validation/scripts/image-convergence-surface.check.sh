#!/usr/bin/env bash
# image-convergence-surface.check.sh: every file the image bakes from the super-repo has an in-place installer.
# Not a *.test.sh, so the pre-commit glue runner does not run it: its red is intended (check first) until
# pull-sync installs tier A manifest paths, and a glue test's tracked-red exemption depends on the committer's
# client config. The gap the-convergence-surface-is-narrower-than-the-baked-surface-... is armed on this file.
# Shares all logic with image-convergence-surface.test.sh; this wrapper only turns on the installer verdict.
IMAGE_CONVERGENCE_JUDGE_INSTALLERS=1 exec bash "$(dirname "${BASH_SOURCE[0]}")/image-convergence-surface.test.sh" "$@"
