#!/usr/bin/env bash
# MIT License
# Copyright (c) 2026 Microsoft Corporation
# See LICENSE in the repository root.

set -Eeuo pipefail

vault_name="${AZURE_KEY_VAULT_NAME:-}"
resource_group="${AZURE_RESOURCE_GROUP:-}"
cosmos_account="${AZURE_COSMOS_ACCOUNT_NAME:-}"
ai_secret_name="${AZURE_AI_API_KEY_SECRET_NAME:-ai-api-key}"
cosmos_secret_name="${AZURE_COSMOS_SECRET_NAME:-cosmos-connection-string}"
expires_in_days="${AZURE_SECRET_EXPIRES_IN_DAYS:-365}"
dry_run=false

usage() {
  cat <<'EOF'
Synchronize Sentinel Optimizer runtime secrets into Azure Key Vault.

Usage: infra/azure/keyvault/sync-secrets.sh [options]

Options:
  --vault <name>               Key Vault name (default: AZURE_KEY_VAULT_NAME)
  --resource-group <name>      Resource group (default: AZURE_RESOURCE_GROUP)
  --cosmos-account <name>      Derive the Cosmos connection string from this account
                               (default: AZURE_COSMOS_ACCOUNT_NAME)
  --ai-secret-name <name>      Secret name for the AI API key (default: ai-api-key)
  --cosmos-secret-name <name>  Secret name for the Cosmos connection string
                               (default: cosmos-connection-string)
  --expires-in-days <number>   Expiration applied to written secrets (default: 365)
  --dry-run                    Report planned actions without writing
  --help                       Show this help

Secret sources:
  AI_API_KEY      Environment variable. Skipped when blank.
  Cosmos          Read directly from the Cosmos DB account with --cosmos-account,
                  so the connection string never passes through CI configuration.

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
    --resource-group)
      (($# >= 2)) || fail '--resource-group requires a value.'
      resource_group="$2"
      shift 2
      ;;
    --cosmos-account)
      (($# >= 2)) || fail '--cosmos-account requires a value.'
      cosmos_account="$2"
      shift 2
      ;;
    --ai-secret-name)
      (($# >= 2)) || fail '--ai-secret-name requires a value.'
      ai_secret_name="$2"
      shift 2
      ;;
    --cosmos-secret-name)
      (($# >= 2)) || fail '--cosmos-secret-name requires a value.'
      cosmos_secret_name="$2"
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

if [[ -n "$cosmos_account" ]]; then
  [[ -n "$resource_group" ]] || fail 'Set --resource-group or AZURE_RESOURCE_GROUP to read Cosmos DB keys.'
  cosmos_connection_string="$(az cosmosdb keys list \
    --name "$cosmos_account" \
    --resource-group "$resource_group" \
    --type connection-strings \
    --query 'connectionStrings[0].connectionString' \
    --output tsv)"
  [[ -n "$cosmos_connection_string" ]] || fail "Unable to read connection strings for Cosmos DB account '$cosmos_account'."
  sync_secret "$cosmos_secret_name" "$cosmos_connection_string" 'text/plain'
else
  log "Skipping '$cosmos_secret_name': no Cosmos DB account supplied."
  skipped=$((skipped + 1))
fi

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
