# provider-of-key.sh — which provider variable a model key belongs to, from its prefix.
# Sourced by run-acceptance.sh and run-network-acceptance.sh.
#
# A key exported under the wrong provider's name fails every model call with no hint of
# why: an OpenRouter key in ANTHROPIC_API_KEY is sent to Anthropic and rejected. The
# acceptance secret is one opaque value, so the run reads its provider from the key's
# own prefix instead of a second setting that can disagree with it. Only prefixes that
# identify one provider are listed; anything else is unknown, never guessed.
provider_var_of_key() { # <key> -> the provider variable name, or empty when unknown
  case "${1:-}" in
    sk-ant-*) echo ANTHROPIC_API_KEY ;;
    sk-or-*)  echo OPENROUTER_API_KEY ;;
    gsk_*)    echo GROQ_API_KEY ;;
    AIza*)    echo GOOGLE_API_KEY ;;
    cpk_*)    echo CHUTES_API_KEY ;;
    rpa_*)    echo RUNPOD_API_KEY ;;
    sk-*)     echo OPENAI_API_KEY ;;
    *)        echo "" ;;
  esac
}

# resolve_provider_var <key> <explicit var or empty> -> the variable to export the key under.
# An explicit setting wins, with a warning on stderr when the key says otherwise; with no
# setting the key's prefix decides; with neither, ANTHROPIC_API_KEY (the page's example).
resolve_provider_var() {
  local key="${1:-}" explicit="${2:-}" inferred
  inferred="$(provider_var_of_key "$key")"
  if [ -n "$explicit" ]; then
    if [ -n "$inferred" ] && [ "$inferred" != "$explicit" ]; then
      echo "provider-of-key: ACCEPTANCE_PROVIDER_VAR=$explicit, but the key's prefix says $inferred; using $explicit as set" >&2
    fi
    echo "$explicit"
  elif [ -n "$inferred" ]; then
    echo "$inferred"
  else
    [ -n "$key" ] && echo "provider-of-key: the key's prefix names no provider; exporting it as ANTHROPIC_API_KEY (set ACCEPTANCE_PROVIDER_VAR to override)" >&2
    echo ANTHROPIC_API_KEY
  fi
}
