#!/usr/bin/env bash
# a1: root never runs or installs the CANDIDATE's copy of root glue. gate-policy.json gates
# scripts/substrate/* and validation/scripts/* minus an explicit non_root_paths list, so a
# pushed edit to scripts/substrate/render-secret-scope.sh (which converge_units runs as root
# with the secret stores in hand) or gen-env.sh (installed to /usr/local/bin, run at boot) is
# overlaid with the ACCEPTED copy until promoted. The real pull-sync runs as the gate body.
#   must fail   the candidate render-secret-scope.sh runs (its marker appears), or the
#               candidate gen-env.sh is installed
#   control     the ACCEPTED render-secret-scope.sh does run through the same call (its marker
#               appears every tick), and the accepted gen-env.sh is what is installed
# usage: validation/scripts/gate-a1-root-glue.test.sh   (bash, git, jq, flock; no root)
source "$(dirname "$0")/lib/gate-test-lib.sh"
gt_live
echo 'SHARED=1' > "$T/etc/env"   # converge_units runs the renderer only on a node with a shared env
printf '#!/usr/bin/env bash\n: > "%s/ACC-RENDER"\n' "$T" > "$T/seed/scripts/substrate/render-secret-scope.sh"
printf '#!/usr/bin/env bash\necho accepted gen-env\n' > "$T/seed/scripts/substrate/gen-env.sh"
mkdir -p "$T/seed/scripts/substrate/units"   # converge_units returns early without a units dir
printf '[Service]\nExecStart=/bin/true\n' > "$T/seed/scripts/substrate/units/x.service"
A0="$(gt_push "accepted glue")"
gt_live_converged
cp "$T/seed/scripts/substrate/gen-env.sh" "$T/bin/gen-env"   # installed on this image (converge only replaces)

gt_live_tick
[ "$RC" = 0 ] && [ "$(cat "$G/accepted.sha" 2>/dev/null)" = "$A0" ] && ok "bootstrap: gated tick exits 0" || { bad "bootstrap rc $RC"; show; }
[ -e "$T/ACC-RENDER" ] && ok "control: the accepted render-secret-scope.sh runs through converge_units" || { bad "control: the renderer never ran (the probe proves nothing)"; show; }

printf '#!/usr/bin/env bash\n: > "%s/CAND-RENDER"\n: > "%s/ACC-RENDER"\n' "$T" "$T" > "$T/seed/scripts/substrate/render-secret-scope.sh"
printf '#!/usr/bin/env bash\necho CANDIDATE gen-env\n' > "$T/seed/scripts/substrate/gen-env.sh"
gt_push "lane-pushed root glue" >/dev/null
rm -f "$T/ACC-RENDER"; gt_live_tick
[ "$RC" = 0 ] && ok "candidate tick exits 0" || { bad "candidate tick rc $RC"; show; }
[ "$(git -C "$T/super" rev-parse HEAD)" = "$(git -C "$T/seed" rev-parse HEAD)" ] && ok "the clone holds the candidate (fixture replays)" || bad "the clone did not advance"
[ ! -e "$T/CAND-RENDER" ] && ok "the candidate render-secret-scope.sh was NOT run as root" || bad "the CANDIDATE render-secret-scope.sh RAN as root"
[ -e "$T/ACC-RENDER" ] && ok "control: the accepted renderer ran instead (same call)" || bad "control: no renderer ran this tick"
grep -q 'accepted gen-env' "$T/bin/gen-env" && ok "the installed gen-env is the accepted copy" || bad "the CANDIDATE gen-env was installed: $(cat "$T/bin/gen-env")"
[ "$(cat "$G/accepted.sha")" = "$A0" ] && ok "accepted.sha unchanged" || bad "accepted.sha moved"
done_tests
