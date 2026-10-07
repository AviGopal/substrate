#!/usr/bin/env bash
# secret-scope-names.test.sh: the names-only scope report lists each unit's secret NAMES from its EnvironmentFile=
# list, merges a shared file with a scoped one, and never prints a value.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$HERE/../../scripts/substrate/secret-scope-names.sh"
T="$(mktemp -d "${TMPDIR:-/tmp}/scope-names.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
V1=valueONE-should-never-print; V2=valueTWO-should-never-print
printf 'METABOB_API_KEY="%s"\nSUBSTRATE_ENDPOINT=http://x\nJWT_SECRET=%s\n' "$V1" "$V2" > "$T/env"
printf 'export SURREAL_PASS=%s\nIDENTITY_ADMIN_KEY=%s\n' "$V1" "$V2" > "$T/scoped.env"
cat > "$T/systemctl" <<STUB
#!/usr/bin/env bash
case "\$1" in
  list-unit-files) printf 'a.service enabled\nb.service enabled\nc.service disabled\nd.service enabled\nt@.service static\n' ;;
  show) p="\$4"
        case "\$2:\$p" in
          a.service:EnvironmentFiles) echo "$T/env (ignore_errors=no)" ;;
          b.service:EnvironmentFiles) echo "$T/env (ignore_errors=no) $T/scoped.env (ignore_errors=no)" ;;
          d.service:Environment) echo "INLINE_API_KEY=$V1 \"QUOTED_TOKEN=$V2\" PLAIN=x" ;;
          d.service:PassEnvironment) echo "PASSED_SECRET OTHER WATCHDOG_ACTIVITY_PATHS SUBSTRATE_GIT_PAT" ;;
          *) echo "" ;; esac ;;
esac
STUB
chmod +x "$T/systemctl"
out="$(SECRET_SCOPE_SYSTEMCTL="$T/systemctl" bash "$SCRIPT")"
[ "$(printf '%s\n' "$out" | awk -F'\t' '$1=="a.service"{print $2}')" = "JWT_SECRET,METABOB_API_KEY" ] && ok "shared file: secret names only (SUBSTRATE_ENDPOINT is not a secret name)" || bad "a.service: $(printf '%s\n' "$out" | grep a.service)"
[ "$(printf '%s\n' "$out" | awk -F'\t' '$1=="b.service"{print $2}')" = "IDENTITY_ADMIN_KEY,JWT_SECRET,METABOB_API_KEY,SURREAL_PASS" ] && ok "shared + scoped files merged; export prefix handled" || bad "b.service: $(printf '%s\n' "$out" | grep b.service)"
[ "$(printf '%s\n' "$out" | awk -F'\t' '$1=="d.service"{print $2}')" = "INLINE_API_KEY,PASSED_SECRET,QUOTED_TOKEN,SUBSTRATE_GIT_PAT" ] && ok "Environment= (quoted too) and PassEnvironment= names included; *_PAT yes, *_PATHS no" || bad "d.service: $(printf '%s\n' "$out" | grep d.service | cut -c1-80)"
printf '%s\n' "$out" | grep -q '^c.service' && bad "a unit with no EnvironmentFile listed" || ok "units without an EnvironmentFile are skipped"
printf '%s\n' "$out" | grep -q 't@.service' && bad "template unit listed" || ok "template units are skipped"
printf '%s\n' "$out" | grep -qE "$V1|$V2" && bad "a VALUE was printed" || ok "no value is ever printed"
all="$(SECRET_SCOPE_SYSTEMCTL="$T/systemctl" bash "$SCRIPT" --all)"
printf '%s\n' "$all" | grep -q 'SUBSTRATE_ENDPOINT' && ! printf '%s\n' "$all" | grep -qE "$V1|$V2" && ok "--all lists every name, still no value" || bad "--all output wrong"
echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
