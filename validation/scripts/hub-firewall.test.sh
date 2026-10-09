#!/usr/bin/env bash
# hub-firewall.test.sh: scripts/substrate/hub-firewall.sh, with ssh stubbed (HUB_FW_SSH), so nothing reaches a hub.
# The 18080 allowlist accepts only strict IPv4 and refuses before any ssh. The rule body that apply sends is the
# same body install-boot installs. 18080 is never in the open-port list. Dry runs write nothing. The relay 18333
# allowlist (ALLOW_18333_SRC) is judged by hub-firewall-18333.check.sh, run here as one case.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
F="$HERE/../../scripts/substrate/hub-firewall.sh"
T="$(mktemp -d "${TMPDIR:-/tmp}/hub-fw.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
cat > "$T/ssh" <<STUB
#!/usr/bin/env bash
# records the remote command and its stdin, one call per file
n=\$(ls "$T"/call.* 2>/dev/null | wc -l); for a; do last="\$a"; done
printf '%s\n' "\$last" > "$T/call.\$n.cmd"; cat > "$T/call.\$n.in"
STUB
chmod +x "$T/ssh"
run() { rm -f "$T"/call.*; HUB_FW_SSH="$T/ssh" bash "$F" "$@" >"$T/out" 2>&1; }
calls() { ls "$T"/call.*.cmd 2>/dev/null | wc -l; }

# 1. allowlist validation refuses before any ssh
for v in 1.2.3 1..2.3.4 , 1.2.3.4, 256.1.1.1 example.com '1.2.3.4 ,5.6.7.8' 01.2.3.4 0.0.0.0 '$(id)' '1.2.3.4;id'; do
  ALLOW_18080_SRC="$v" run root@hub apply; rc=$?
  [ "$rc" = 2 ] && [ "$(calls)" = 0 ] && ok "refused before ssh: '$v'" || bad "'$v' rc=$rc calls=$(calls)"
done
for v in 98.234.161.172 1.2.3.4,5.6.7.8 10.0.0.1; do
  ALLOW_18080_SRC="$v" run root@hub apply; [ "$(calls)" = 1 ] && grep -qF "ALLOW_18080_SRC='$v'" "$T/call.0.cmd" && ok "accepted and passed through: $v" || bad "valid '$v' not sent"
done

# 2. apply sends the rule body; install-boot installs the SAME body
ALLOW_18080_SRC=98.234.161.172 run root@hub apply
cmp -s "$T/call.0.in" <(bash "$F" --print-body) && ok "apply sends exactly the rule body" || bad "apply stdin differs from the rule body"
ALLOW_18080_SRC=98.234.161.172 run root@hub install-boot --go
in_sbin=$(grep -l 'usr/local/sbin/substrate-hub-fw' "$T"/call.*.cmd | head -1)
[ -n "$in_sbin" ] && cmp -s <(tail -n +3 "${in_sbin%.cmd}.in") <(bash "$F" --print-body) && ok "install-boot installs the same body (after its 2-line header)" || bad "installed body differs"
grep -qx 'ALLOW_18080_SRC=98.234.161.172' "$(grep -l '/etc/default/substrate-hub-fw' "$T"/call.*.cmd | head -1 | sed 's/cmd$/in/')" && ok "the allowlist file carries the list" || bad "allowlist file content"
unit_in="$(grep -l 'substrate-hub-fw.service' "$T"/call.*.cmd | head -1 | sed 's/cmd$/in/')"
grep -qx 'After=docker.service' "$unit_in" && grep -qx 'PartOf=docker.service' "$unit_in" && grep -qx 'WantedBy=multi-user.target docker.service' "$unit_in" \
  && ! grep -q '^ExecStop' "$unit_in" && ok "unit: after/part-of docker, wanted at boot and by docker, no ExecStop" || bad "unit wiring"

# 3. 18080 is never an open port; only the source-restricted rule admits it
grep -qE '^CH=SUBSTRATE-HUB-FW; ALLOW="[^"]*\b18080\b' <(bash "$F" --print-body) && bad "18080 in the open-port list" || ok "18080 is not in the open-port list"
grep -qE 'DENY6="[^"]*\b18080\b' <(bash "$F" --print-body) && ok "IPv6 18080 denied" || bad "IPv6 18080 not denied"
bash "$F" --print-body | bash -n && ok "the rule body parses" || bad "rule body syntax"

# 3b. the relay 18333 allowlist: its own stubbed check (controls: unset/empty byte-identical, 18080 unchanged)
bash "$HERE/hub-firewall-18333.check.sh" > "$T/c18333" 2>&1 < /dev/null && ok "the 18333 allowlist check passes ($(grep -c '^ok' "$T/c18333") cases)" \
  || { bad "the 18333 allowlist check: $(grep -c '^FAIL' "$T/c18333") failing"; grep '^FAIL' "$T/c18333" | sed 's/^/     /'; }

# 4. dry runs write nothing
ALLOW_18080_SRC=98.234.161.172 run root@hub install-boot; [ "$(calls)" = 0 ] && ok "install-boot without --go: no ssh" || bad "install-boot dry run touched the hub"
run root@hub remove-boot; [ "$(calls)" = 0 ] && ok "remove-boot without --go: no ssh" || bad "remove-boot dry run touched the hub"
echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
