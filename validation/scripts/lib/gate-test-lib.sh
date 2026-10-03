# gate-test-lib.sh — shared scratch layout for validation/scripts/gate-*.test.sh (sourced).
#
# A scratch "super-repo": a bare origin, a seed worktree that commits and pushes, and the
# node's clone ($T/super) that the gate runner stages from. The seed carries the REAL gate
# pieces under test (gate-runner.sh, candidate.sh, shadow-eval.sh, the parses fixture), a
# policy with the soak lowered for the test, and a STUB gate body that records each run to
# $GT_RUNS (its own path and PULLSYNC_ACCEPTED_DIR) and exits $GT_BODY_RC. No container, no
# root, no live state: every path is under $T.
set -uo pipefail
GT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
GT_RUNNER="$GT_ROOT/scripts/substrate/gate/gate-runner.sh"
T="$(mktemp -d "${TMPDIR:-/tmp}/gate-test.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
done_tests() { echo; [ "$FAILS" = 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS FAILED"; exit 1; }; }
g() { git -C "$1" -c user.name=t -c user.email=t@t "${@:2}" >/dev/null 2>&1; }
export GT_RUNS="$T/runs.txt" GT_BODY_RC=0
G="$T/gate"

gt_stub_body() { # [extra line] -> a stub gate body on stdout
  printf '#!/usr/bin/env bash\n%s\necho "body $0 acc=${PULLSYNC_ACCEPTED_DIR:-}" >> "$GT_RUNS"\nexit ${GT_BODY_RC:-0}\n' "${1:-}"
}
gt_repo() { # [soak] -> $T/o (origin), $T/seed (author), $T/super (the node's clone)
  local soak="${1:-1}"
  rm -rf "$T/o" "$T/seed" "$T/super" "$G"; : > "$GT_RUNS"
  git init -q --bare "$T/o/super.git"; git -C "$T/o/super.git" symbolic-ref HEAD refs/heads/dev
  mkdir -p "$T/seed/scripts/substrate/gate" "$T/seed/validation/scripts/gate/fixtures"
  cp "$GT_ROOT"/scripts/substrate/gate/{gate-runner.sh,candidate.sh,shadow-eval.sh} "$T/seed/scripts/substrate/gate/"
  jq --argjson n "$soak" '.soak_ticks.default=$n' "$GT_ROOT/scripts/substrate/gate/gate-policy.json" > "$T/seed/scripts/substrate/gate/gate-policy.json"
  cp "$GT_ROOT/validation/scripts/gate/fixtures/parses.sh" "$T/seed/validation/scripts/gate/fixtures/"
  gt_stub_body > "$T/seed/scripts/substrate/substrate-pull-sync.sh"
  mkdir -p "$T/seed/docs"; echo "not a gate path" > "$T/seed/docs/other.md"
  git -C "$T/seed" init -q -b dev; g "$T/seed" add -A; g "$T/seed" commit -m base
  g "$T/seed" remote add origin "$T/o/super.git"; g "$T/seed" push origin dev
  git clone -q --branch dev "$T/o/super.git" "$T/super"
}
gt_push() { # message -> commit everything in the seed, push, fast-forward the node's clone
  g "$T/seed" add -A; g "$T/seed" commit -m "$1"; g "$T/seed" push origin dev
  g "$T/super" pull -q --ff-only origin dev
  git -C "$T/seed" rev-parse HEAD
}
gt_runner() { # args... -> RC, output in $T/out.txt
  env GATE_DIR="$G" GATE_SUPER_DIR="$T/super" GATE_IMAGE_DIR="$T/image" GATE_IMAGE_REVISION_FILE="$T/image-revision" \
    timeout 120 sh "$GT_RUNNER" "$@" > "$T/out.txt" 2>&1; RC=$?
}
gt_records() { # kind -> count of ledger records of that kind
  jq -r --arg k "$1" 'select(.kind==$k) | .kind' "$G/ledger.jsonl" 2>/dev/null | wc -l | tr -d ' '
}
gt_runs() { wc -l < "$GT_RUNS" | tr -d ' '; }
show() { sed 's/^/    /' "$T/out.txt" | tail -20; }

# ── live layout: the REAL pull-sync as the gate body, fixed paths moved under $T ────────────
gt_rew() { sed -e "s#/usr/local/share/substrate#$T/share#g" -e "s#/usr/local/bin#$T/bin#g" -e "s#/usr/local/libexec/substrate#$T/libexec#g" \
               -e "s#/usr/lib/systemd/system#$T/unit#g" -e "s#/etc/substrate#$T/etc#g" -e "s#/workspace#$T/ws#g" "$1"; }
gt_live() { # -> gt_repo 1 whose body is the rewritten real pull-sync; systemctl/curl stubbed; G under $T/ws
  mkdir -p "$T/stub" "$T/bin" "$T/unit" "$T/etc" "$T/share" "$T/rt" "$T/ws/git/vessels" "$T/ws/.pull-sync" "$T/ws/.last-good"
  printf '#!/bin/sh\ncase "$1" in is-active) exit 3;; is-enabled) echo enabled;; esac\nexit 0\n' > "$T/stub/systemctl"
  printf '#!/bin/sh\nexit 7\n' > "$T/stub/curl"; chmod +x "$T/stub/"*
  gt_repo 1
  gt_rew "$GT_ROOT/scripts/substrate/substrate-pull-sync.sh" > "$T/seed/scripts/substrate/substrate-pull-sync.sh"
  # The accepted archive carries the body's tracked-red predicate beside it (a body that cannot
  # source it is a no-op tick, and the gate's lib-sources fixture refuses to promote it).
  mkdir -p "$T/seed/scripts/substrate/lib" && cp "$GT_ROOT/scripts/substrate/lib/gap-tracked-red.sh" "$T/seed/scripts/substrate/lib/"
  G="$T/ws/.gate"
}
gt_live_tick() { # -> RC; output in $T/out.txt
  ( env -u SUBSTRATE_UPDATE_CHANNEL PATH="$T/stub:$PATH" GATE_DIR="$G" GATE_SUPER_DIR="$T/super" SUPER_REPO_DIR="$T/super" \
      MITOSIS_PUSH_CLONE_DIR="$T/ws/git/vessels" MITOSIS_RUNTIME_DIR="$T/rt" STAGGER_SECONDS=0 GATE_BUDGET_SECONDS=0 \
      DEV_VESSEL_ENDPOINT=http://127.0.0.1:9 timeout 240 sh "$GT_RUNNER" tick ) > "$T/out.txt" 2>&1; RC=$?
}
gt_live_converged() { # the node's markers say the clone's HEAD is already converged
  git -C "$T/super" rev-parse HEAD > "$T/ws/.pull-sync/super-repo.sha"
  install -m 0755 "$T/seed/scripts/substrate/substrate-pull-sync.sh" "$T/bin/substrate-pull-sync"
}
