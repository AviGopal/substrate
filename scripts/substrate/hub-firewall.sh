#!/bin/bash
# hub-firewall.sh <user@hub> <apply|undo|status|install-boot|remove-boot> [--go]: operator tool, run by the user.
# A default-deny backstop for a hub's docker-published ports, plus interim containment for activity-api.
#
#   allowed from outside: 18100 discovery, 18101 identity, 18333 relay. sshd 22 is untouched.
#   18080 activity-api: SOURCE-RESTRICTED to ALLOW_18080_SRC (comma-separated IPv4, the attached spokes' egress
#     addresses; empty = closed to every outside source; IPv6 always denied). activity-api's jwtAuth admitted any
#     X-Internal-Api-Key value on its trace, impulse and event writes, so an open 18080 let anyone write the
#     network's learning store. It cannot simply be closed: every hub-attached spoke derives
#     ACTIVITY_API_ENDPOINT=<hub>:18080 (gen-env) and uses it as its trace store.
#   denied: every other NEW inbound connection on eth0/eth1 to a docker-published port (18090 gap writes,
#     18210 goal-host, 18250, 18260 concept-db, 18270, 18310, and anything published later).
# Docker-published ports bypass ufw's INPUT chain, so the filter lives in DOCKER-USER, matched on the ORIGINAL
# destination port (packets there are already DNATed). IPv6 publishes ([::]) are covered in ip6tables, in
# DOCKER-USER if docker manages ip6tables, else in INPUT where the userland proxy listens.
#
# The rules live in kernel tables, so a hub reboot drops them. install-boot installs this same rule body on the
# hub as /usr/local/sbin/substrate-hub-fw with a oneshot unit (After= and PartOf= docker.service, WantedBy=
# multi-user.target and docker.service), and the allowlist in /etc/default/substrate-hub-fw, so the hub re-applies
# its own rules at boot and on every docker start without this host. The unit has no ExecStop, so stopping it
# never opens anything. remove-boot uninstalls it; the rules then stay until the next reboot or `undo`.
#
# RETIRE the 18080 restriction once activity-api no longer admits the header path: the firewall then is defence
# in depth, not the only guard. Proving a change from an allowlisted host needs an A/B: apply an empty list
# (18080 must refuse while 18100 answers), then the real list.
#
# Inputs: ALLOW_18080_SRC; HUB_SSH_KEY (optional identity file). install-boot and remove-boot change the hub
# only with --go.
set -euo pipefail
valid_v4_list() { # comma-separated dotted quads, octets 0-255, no empty item; never a hostname (iptables would resolve it)
  local a o='(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])'   # no leading zeros (octal ambiguity)
  case "$1" in ,*|*,|*,,*|*[[:space:]]*) echo "bad IPv4 list: empty item or whitespace"; return 1 ;; esac
  local IFS=,; for a in $1; do [[ $a =~ ^($o\.){3}$o$ && $a != 0.* ]] || { echo "bad IPv4: $a"; return 1; }; done
}
# The script the hub runs, for apply/undo/status over ssh and as the boot unit's ExecStart. Defined once.
rule_body() { cat <<'BODY'
set -u
CH=SUBSTRATE-HUB-FW; ALLOW="18100 18101 18333"; DENY6="18080 18090 18210 18250 18260 18270 18310"
valid_v4_list() { # comma-separated dotted quads, octets 0-255, no empty item; never a hostname (iptables would resolve it)
  local a o='(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])'   # no leading zeros (octal ambiguity)
  case "$1" in ,*|*,|*,,*|*[[:space:]]*) echo "bad IPv4 list: empty item or whitespace"; return 1 ;; esac
  local IFS=,; for a in $1; do [[ $a =~ ^($o\.){3}$o$ && $a != 0.* ]] || { echo "bad IPv4: $a"; return 1; }; done
}
valid_v4_list "$ALLOW_18080_SRC" || exit 2
v4() {
  iptables -N $CH 2>/dev/null; iptables -F $CH
  iptables -A $CH -m conntrack --ctstate RELATED,ESTABLISHED -j RETURN
  for p in $ALLOW; do iptables -A $CH -p tcp -m conntrack --ctorigdstport $p -j RETURN; done
  [ -n "$ALLOW_18080_SRC" ] && iptables -A $CH -s "$ALLOW_18080_SRC" -p tcp -m conntrack --ctorigdstport 18080 -j RETURN
  # REJECT with a TCP reset, not DROP: a caller still holding an advertised endpoint fails at once instead of
  # hanging for its whole timeout (measured: a dropped connect held a spoke for its full 30 s bound).
  for i in eth0 eth1; do iptables -A $CH -i $i -p tcp -m conntrack --ctstate NEW -j REJECT --reject-with tcp-reset
                         iptables -A $CH -i $i -m conntrack --ctstate NEW -j DROP; done
  iptables -C DOCKER-USER -j $CH 2>/dev/null || iptables -I DOCKER-USER 1 -j $CH
}
v6() {
  if ip6tables -S DOCKER-USER >/dev/null 2>&1; then
    ip6tables -N $CH 2>/dev/null; ip6tables -F $CH
    ip6tables -A $CH -m conntrack --ctstate RELATED,ESTABLISHED -j RETURN
    for p in $ALLOW; do ip6tables -A $CH -p tcp -m conntrack --ctorigdstport $p -j RETURN; done
    for i in eth0 eth1; do ip6tables -A $CH -i $i -p tcp -m conntrack --ctstate NEW -j REJECT --reject-with tcp-reset
                           ip6tables -A $CH -i $i -m conntrack --ctstate NEW -j DROP; done
    ip6tables -C DOCKER-USER -j $CH 2>/dev/null || ip6tables -I DOCKER-USER 1 -j $CH
  fi
  # userland-proxy listeners on [::] are host sockets: deny the closed ports in INPUT as well
  ip6tables -N ${CH}-IN 2>/dev/null; ip6tables -F ${CH}-IN
  # default-deny for the 18xxx block, the same shape as v4: allowed ports return first, everything else drops
  ip6tables -A ${CH}-IN -m conntrack --ctstate RELATED,ESTABLISHED -j RETURN
  for p in $ALLOW; do ip6tables -A ${CH}-IN -p tcp --dport $p -j RETURN; done
  for p in $DENY6; do for i in eth0 eth1; do ip6tables -A ${CH}-IN -i $i -p tcp --dport $p -j REJECT --reject-with tcp-reset; done; done
  for i in eth0 eth1; do ip6tables -A ${CH}-IN -i $i -p tcp --dport 18000:18999 -j REJECT --reject-with tcp-reset; done
  ip6tables -C INPUT -j ${CH}-IN 2>/dev/null || ip6tables -I INPUT 1 -j ${CH}-IN
}
undo() {
  iptables -D DOCKER-USER -j $CH 2>/dev/null; iptables -F $CH 2>/dev/null; iptables -X $CH 2>/dev/null
  ip6tables -D DOCKER-USER -j $CH 2>/dev/null; ip6tables -F $CH 2>/dev/null; ip6tables -X $CH 2>/dev/null
  ip6tables -D INPUT -j ${CH}-IN 2>/dev/null; ip6tables -F ${CH}-IN 2>/dev/null; ip6tables -X ${CH}-IN 2>/dev/null
}
case "$MODE" in
  apply) v4; v6; logger -t hub-firewall "applied: allow $ALLOW; 18080 only from ${ALLOW_18080_SRC:-nobody}; deny other new inbound to docker-published ports"; echo "applied $(date -u +%T)Z" ;;
  undo)  undo; logger -t hub-firewall "removed"; echo "removed $(date -u +%T)Z" ;;
esac
echo "== status"
echo "v4 DOCKER-USER: $(iptables -S DOCKER-USER | tr '\n' ' ')"
echo "v4 $CH: $(iptables -S $CH 2>/dev/null | grep -c '^-A') rules; 18080 rule: $(iptables -S $CH 2>/dev/null | grep 18080 || echo 'none (closed to all outside sources)')"
echo "v6 DOCKER-USER: $(ip6tables -S DOCKER-USER 2>/dev/null | tr '\n' ' ' || echo absent)"
echo "v6 ${CH}-IN: $(ip6tables -S ${CH}-IN 2>/dev/null | grep -c '^-A') rules"
echo "drops so far: v4 $(iptables -L $CH -v -n -x 2>/dev/null | awk '/DROP|REJECT/ {s+=$1} END {print s+0}') | v6 docker $(ip6tables -L $CH -v -n -x 2>/dev/null | awk '/DROP|REJECT/ {s+=$1} END {print s+0}') | v6 input $(ip6tables -L ${CH}-IN -v -n -x 2>/dev/null | awk '/DROP|REJECT/ {s+=$1} END {print s+0}') packets"
echo "public v6 address: $(ip -6 -o addr show scope global 2>/dev/null | awk '{print $4}' | tr '\n' ' ')"
echo "host 30333 owner: $(ss -Hltnp 2>/dev/null | grep ':30333 ' | grep -oE 'users:\(\("[^"]+"' | head -1) (if docker-proxy, it is now closed from outside; no spoke uses it)"
echo "persistence: boot unit substrate-hub-fw enabled=$(systemctl is-enabled substrate-hub-fw 2>/dev/null || echo no) (install-boot makes the rules survive a reboot)"
BODY
}
HUB="${1:-}"; MODE="${2:-}"; GO="${3:-}"
case "$HUB" in --print-body) rule_body; exit 0 ;; ''|-*) echo "usage: hub-firewall.sh <user@hub> <apply|undo|status|install-boot|remove-boot> [--go]"; exit 2 ;; esac
ALLOW="${ALLOW_18080_SRC:-}"
valid_v4_list "$ALLOW" || exit 2
SSH=(${HUB_FW_SSH:-ssh} -o BatchMode=yes); [ -n "${HUB_SSH_KEY:-}" ] && SSH+=(-o IdentitiesOnly=yes -i "$HUB_SSH_KEY")
hub() { "${SSH[@]}" "$HUB" "$@"; }
UNIT='[Unit]
Description=Substrate hub firewall: default-deny for docker-published ports, activity-api 18080 source-restricted
After=docker.service
PartOf=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
EnvironmentFile=/etc/default/substrate-hub-fw
Environment=MODE=apply
ExecStart=/usr/local/sbin/substrate-hub-fw

[Install]
WantedBy=multi-user.target docker.service'
case "$MODE" in
  apply|undo|status)
    [ "$MODE" = apply ] && [ -z "$ALLOW" ] && echo "note: ALLOW_18080_SRC is empty, so 18080 is closed to every outside source"
    rule_body | hub "MODE=$MODE ALLOW_18080_SRC='$ALLOW' bash -s" ;;
  install-boot)
    echo "install-boot: rule body -> /usr/local/sbin/substrate-hub-fw; ALLOW_18080_SRC=${ALLOW:-<empty: 18080 closed>}"
    [ "$GO" = --go ] || { echo "DRY RUN (pass --go)"; exit 0; }
    { printf '#!/bin/bash\n# Installed by scripts/substrate/hub-firewall.sh install-boot. Remove with remove-boot.\n'; rule_body; } \
      | hub 'install -m 0700 /dev/stdin /usr/local/sbin/substrate-hub-fw'
    printf 'ALLOW_18080_SRC=%s\n' "$ALLOW" | hub 'install -m 0644 /dev/stdin /etc/default/substrate-hub-fw'
    printf '%s\n' "$UNIT" | hub 'install -m 0644 /dev/stdin /etc/systemd/system/substrate-hub-fw.service'
    hub 'systemctl daemon-reload && systemctl enable substrate-hub-fw >/dev/null 2>&1 && systemctl restart substrate-hub-fw \
      && echo "unit: enabled=$(systemctl is-enabled substrate-hub-fw) active=$(systemctl is-active substrate-hub-fw)" \
      && echo "18080 rule: $(iptables -S SUBSTRATE-HUB-FW | grep 18080 || echo none)" \
      && echo "jumps in DOCKER-USER: $(iptables -S DOCKER-USER | grep -c SUBSTRATE-HUB-FW)"'
    echo "The boot path itself is proven only by the next hub reboot: then run status (want enabled, the 18080 rule, 1 jump)." ;;
  remove-boot)
    [ "$GO" = --go ] || { echo "DRY RUN: would disable and delete the boot unit, its allowlist file and script (pass --go)"; exit 0; }
    hub 'systemctl disable --now substrate-hub-fw >/dev/null 2>&1; rm -f /etc/systemd/system/substrate-hub-fw.service /etc/default/substrate-hub-fw /usr/local/sbin/substrate-hub-fw; systemctl daemon-reload; echo "boot unit removed; current rules stay until reboot or undo"' ;;
  *) echo "usage: hub-firewall.sh <user@hub> <apply|undo|status|install-boot|remove-boot> [--go]"; exit 2 ;;
esac
