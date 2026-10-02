#!/usr/bin/env bash
# kind: known-invalid (replay of 847025e2's run-on-arrival)
# A gated pull-sync (PULLSYNC_ACCEPTED_DIR set) must NOT install or execute the pull-sync it
# pulls: that one is a candidate. Scratch layout only: the candidate runs once, as the
# accepted body would, against a super-repo whose origin is one commit ahead with a pushed
# pull-sync that drops a marker when executed. Must fail: the marker appears, the pushed
# copy reaches BIN_DIR, or the tick re-executes. Positive control through the same address:
# the pushed copy run directly DOES drop the marker (else the probe proves nothing).
set -uo pipefail
T="$(mktemp -d "${TMPDIR:-/tmp}/fx-847025e2.XXXXXX")"; trap 'rm -rf "$T"' EXIT
g() { git -C "$1" -c user.name=t -c user.email=t@t "${@:2}" >/dev/null 2>&1; }
rew() { sed -e "s#/usr/local/share/substrate#$T/share#g" -e "s#/usr/local/bin#$T/bin#g" -e "s#/usr/local/libexec/substrate#$T/libexec#g" \
            -e "s#/usr/lib/systemd/system#$T/unit#g" -e "s#/etc/substrate#$T/etc#g" -e "s#/workspace#$T/ws#g" "$1"; }
rew "$PULLSYNC_BIN" > "$T/cand.sh"
{ head -n1 "$T/cand.sh"; echo ": > \"$T/PUSHED-RAN\""; tail -n +2 "$T/cand.sh"; } > "$T/pushed.sh"
mkdir -p "$T/stub" "$T/bin" "$T/unit" "$T/etc" "$T/share" "$T/rt" "$T/ws/git/vessels" "$T/ws/.pull-sync" "$T/ws/.last-good" "$T/o" "$T/seed/scripts/substrate"
printf '#!/bin/sh\ncase "$1" in is-active) exit 3;; is-enabled) echo enabled;; esac\nexit 0\n' > "$T/stub/systemctl"
printf '#!/bin/sh\nexit 7\n' > "$T/stub/curl"; chmod +x "$T/stub/"*
git init -q --bare "$T/o/super.git"; git -C "$T/o/super.git" symbolic-ref HEAD refs/heads/dev
cp "$T/cand.sh" "$T/seed/scripts/substrate/substrate-pull-sync.sh"
git -C "$T/seed" init -q -b dev; g "$T/seed" add -A; g "$T/seed" commit -m base
g "$T/seed" remote add origin "$T/o/super.git"; g "$T/seed" push origin dev
git clone -q --branch dev "$T/o/super.git" "$T/ws/git/super-repo"
git -C "$T/seed" rev-parse HEAD > "$T/ws/.pull-sync/super-repo.sha"
cp "$T/pushed.sh" "$T/seed/scripts/substrate/substrate-pull-sync.sh"; g "$T/seed" commit -am push; g "$T/seed" push origin dev
install -m 0755 "$T/cand.sh" "$T/bin/substrate-pull-sync"
A="$T/ws/.gate/accepted"; mkdir -p "$A/scripts/substrate"; cp "$T/cand.sh" "$A/scripts/substrate/substrate-pull-sync.sh"
echo "$(git -C "$T/ws/git/super-repo" rev-parse HEAD)" > "$T/ws/.gate/accepted.sha"
printf '{"gate_paths":["scripts/substrate/substrate-pull-sync.sh","scripts/substrate/gate/*"],"files":{}}\n' > "$A/MANIFEST.json"
( env -u SUBSTRATE_UPDATE_CHANNEL PATH="$T/stub:$PATH" MITOSIS_PUSH_CLONE_DIR="$T/ws/git/vessels" MITOSIS_RUNTIME_DIR="$T/rt" \
    SUPER_REPO_DIR="$T/ws/git/super-repo" STAGGER_SECONDS=0 GATE_BUDGET_SECONDS=0 DEV_VESSEL_ENDPOINT=http://127.0.0.1:9 \
    PULLSYNC_ACCEPTED_DIR="$A" PULLSYNC_GATE_DIR="$T/ws/.gate" timeout 240 bash "$A/scripts/substrate/substrate-pull-sync.sh" ) > "$T/out" 2>&1
rc=0
[ -e "$T/PUSHED-RAN" ] && { echo "FAIL - the pulled pull-sync was EXECUTED by the gated tick (run-on-arrival)"; rc=1; }
grep -q 're-executing this tick' "$T/out" && { echo "FAIL - the gated tick re-executed"; rc=1; }
cmp -s "$T/bin/substrate-pull-sync" "$T/pushed.sh" && { echo "FAIL - the pulled pull-sync was installed to BIN_DIR"; rc=1; }
[ "$(git -C "$T/ws/git/super-repo" rev-parse HEAD)" = "$(git -C "$T/seed" rev-parse HEAD)" ] || { echo "FAIL - the fixture did not replay (the clone never pulled the pushed commit)"; rc=1; }
# positive control: the marker is reachable through the same file
( cd "$T" && timeout 20 bash -c "head -n2 '$T/pushed.sh' | bash" ) >/dev/null 2>&1
[ -e "$T/PUSHED-RAN" ] || { echo "FAIL - positive control: the pushed copy's marker never fires"; rc=1; }
[ "$rc" = 0 ] || tail -15 "$T/out"
exit $rc
