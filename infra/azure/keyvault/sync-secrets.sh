#!/usr/bin/env bash
# MIT License
# Copyright (c) 2026 Microsoft Corporation
# See LICENSE in the repository root.

set -Eeuo pipefail

vault_name="${AZURE_KEY_VAULT_NAME:-}"
resource_group="${AZURE_RESOURCE_GROUP:-}"
ai_secret_name="${AZURE_AI_API_KEY_SECRET_NAME:-ai-api-key}"
expires_in_days="${AZURE_SECRET_EXPIRES_IN_DAYS:-365}"
dry_run=false

usage() {
  cat <<'EOF'
Synchronize Sentinel Optimizer runtime secrets into Azure Key Vault.

Usage: infra/azure/keyvault/sync-secrets.sh [options]

Options:
  --vault <name>               Key Vault name (default: AZURE_KEY_VAULT_NAME)
  --ai-secret-name <name>      Secret name for the AI API key (default: ai-api-key)
  --expires-in-days <number>   Expiration applied to written secrets (default: 365)
  --dry-run                    Report planned actions without writing
  --help                       Show this help

Secret sources:
  AI_API_KEY      Environment variable. Skipped when blank.

The script is idempotent: it creates a new secret version only when the value
changes, and otherwise refreshes the expiration date. Secret values are never
printed.
EOF
}

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

log() {
  printf '%s\n' "$*" >&2
}

while (($# > 0)); do
  case "$1" in
    --vault)
      (($# >= 2)) || fail '--vault requires a value.'
      vault_name="$2"
      shift 2
      ;;
    --ai-secret-name)
      (($# >= 2)) || fail '--ai-secret-name requires a value.'
      ai_secret_name="$2"
      shift 2
      ;;
    --expires-in-days)
      (($# >= 2)) || fail '--expires-in-days requires a value.'
      expires_in_days="$2"
      shift 2
      ;;
    --dry-run)
      dry_run=true
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      fail "Unknown option '$1'. Run with --help for usage."
      ;;
  esac
done

command -v az >/dev/null 2>&1 || fail "Required command 'az' was not found."
[[ -n "$vault_name" ]] || fail 'Set --vault or AZURE_KEY_VAULT_NAME.'
[[ "$expires_in_days" =~ ^[0-9]+$ ]] || fail '--expires-in-days must be a whole number.'
((expires_in_days > 0)) || fail '--expires-in-days must be greater than zero.'

az account show >/dev/null 2>&1 || fail "Azure CLI is not authenticated. Run 'az login' and retry."
az keyvault show --name "$vault_name" --output none 2>/dev/null ||
  fail "Key Vault '$vault_name' was not found. Deploy the keyvault infrastructure component first."

expiry="$(date -u -d "+${expires_in_days} days" '+%Y-%m-%dT%H:%M:%SZ')"
written=0
refreshed=0
skipped=0

# Writes a secret only when its value changed, so rotation history stays meaningful.
sync_secret() {
  local name="$1"
  local value="$2"
  local content_type="$3"
  local current

  if [[ -z "$value" ]]; then
    log "Skipping '$name': no value supplied."
    skipped=$((skipped + 1))
    return
  fi

  current="$(az keyvault secret show \
    --vault-name "$vault_name" \
    --name "$name" \
    --query value \
    --output tsv 2>/dev/null || true)"

  if [[ "$current" == "$value" ]]; then
    if [[ "$dry_run" == true ]]; then
      log "Would refresh expiration for '$name' (value unchanged)."
    else
      az keyvault secret set-attributes \
        --vault-name "$vault_name" \
        --name "$name" \
        --expires "$expiry" \
        --output none
      log "Refreshed expiration for '$name' (value unchanged)."
    fi
    refreshed=$((refreshed + 1))
    return
  fi

  if [[ "$dry_run" == true ]]; then
    log "Would write a new version of '$name'."
  else
    az keyvault secret set \
      --vault-name "$vault_name" \
      --name "$name" \
      --value "$value" \
      --content-type "$content_type" \
      --expires "$expiry" \
      --output none
    log "Wrote a new version of '$name'."
  fi
  written=$((written + 1))
}

sync_secret "$ai_secret_name" "${AI_API_KEY:-}" 'text/plain'

log "Key Vault '$vault_name': $written written, $refreshed refreshed, $skipped skipped."

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  {
    printf '### Key Vault secret sync\n\n'
    printf '| Vault | Written | Refreshed | Skipped | Expires |\n'
    printf '| --- | --- | --- | --- | --- |\n'
    printf '| %s | %s | %s | %s | %s |\n' \
      "$vault_name" "$written" "$refreshed" "$skipped" "$expiry"
  } >> "$GITHUB_STEP_SUMMARY"
fi
