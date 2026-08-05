#!/usr/bin/env bash
set -Eeuo pipefail

script_directory="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repository_root="$(cd "$script_directory/../.." && pwd)"
config_file="$script_directory/config.json"
bootstrap_template="$script_directory/bootstrap/azuredeploy.json"
location="${AZURE_LOCATION:-eastus2}"
subscription_id=""
repository=""
configure_github=true
temporary_directory=""

usage() {
  cat <<'EOF'
Bootstrap Azure and GitHub OIDC for Sentinel Optimizer.

Usage: infra/azure/bootstrap.sh [options]

Options:
  --location <region>         Azure region (default: AZURE_LOCATION or eastus2)
  --subscription <id>        Azure subscription (default: current az account)
  --repository <owner/name>  GitHub repository (default: current gh repository)
  --skip-github              Create Azure identities/RBAC without GitHub environments
  --help                     Show this help

Prerequisites: authenticated Azure CLI, jq, and authenticated GitHub CLI unless
--skip-github is used. The caller must be able to create Entra applications,
register resource providers, create a resource group, and assign Azure roles.
EOF
}

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

log() {
  printf '%s\n' "$*" >&2
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command '$1' was not found."
}

retry() {
  local attempt=1
  local maximum_attempts=6
  local delay_seconds=5

  until "$@"; do
    if ((attempt >= maximum_attempts)); then
      return 1
    fi
    log "Command is waiting for directory replication; retrying ($attempt/$maximum_attempts)."
    attempt=$((attempt + 1))
    sleep "$delay_seconds"
  done
}

cleanup() {
  if [[ -n "$temporary_directory" && -d "$temporary_directory" ]]; then
    rm -rf "$temporary_directory"
  fi
}
trap cleanup EXIT

while (($# > 0)); do
  case "$1" in
    --location)
      (($# >= 2)) || fail '--location requires a value.'
      location="$2"
      shift 2
      ;;
    --subscription)
      (($# >= 2)) || fail '--subscription requires a value.'
      subscription_id="$2"
      shift 2
      ;;
    --repository)
      (($# >= 2)) || fail '--repository requires owner/name.'
      repository="$2"
      shift 2
      ;;
    --skip-github)
      configure_github=false
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

require_command az
require_command jq
if [[ "$configure_github" == true ]]; then
  require_command gh
fi

[[ -f "$config_file" ]] || fail "Shared config not found: $config_file"
[[ -f "$bootstrap_template" ]] || fail "Bootstrap template not found: $bootstrap_template"
jq --raw-output --from-file "$script_directory/export-config.jq" "$config_file" >/dev/null

az account show >/dev/null 2>&1 || fail "Azure CLI is not authenticated. Run 'az login' and retry."
if [[ -n "$subscription_id" ]]; then
  az account set --subscription "$subscription_id"
fi

subscription_id="$(az account show --query id --output tsv)"
tenant_id="$(az account show --query tenantId --output tsv)"
[[ -n "$subscription_id" && -n "$tenant_id" ]] || fail 'Unable to resolve the current Azure subscription and tenant.'

if [[ "$configure_github" == true ]]; then
  gh auth status >/dev/null 2>&1 || fail "GitHub CLI is not authenticated. Run 'gh auth login' and retry."
  if [[ -z "$repository" ]]; then
    repository="$(cd "$repository_root" && gh repo view --json nameWithOwner --jq .nameWithOwner)"
  fi
  [[ "$repository" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || fail "Invalid GitHub repository '$repository'."
  gh repo view "$repository" >/dev/null 2>&1 || fail "GitHub repository '$repository' is unavailable to the current gh account."
fi

resource_group="$(jq --raw-output .resourceGroup "$config_file")"
static_web_app_name="$(jq --raw-output .staticWebAppName "$config_file")"
infrastructure_application_name="$(jq --raw-output .oidc.infrastructureApplicationName "$config_file")"
api_application_name="$(jq --raw-output .oidc.apiApplicationName "$config_file")"
infrastructure_environment="azure-infrastructure"
api_environment="azure-api"
site_environment="azure-site"
[[ "$infrastructure_application_name" != "$api_application_name" ]] || fail 'Infrastructure and API OIDC application names must be different.'
resource_group_scope="/subscriptions/$subscription_id/resourceGroups/$resource_group"

temporary_directory="$(mktemp -d)"

resource_group_exists="$(az group exists --name "$resource_group")"
if [[ "$resource_group_exists" == true ]]; then
  existing_location="$(az group show --name "$resource_group" --query location --output tsv)"
  log "Resource group '$resource_group' already exists in '$existing_location'."
else
  log "Creating resource group '$resource_group' in '$location' with subscription-scope Bicep."
  az deployment sub create \
    --name sentinel-optimizer-bootstrap \
    --location "$location" \
    --template-file "$bootstrap_template" \
    --parameters resourceGroupName="$resource_group" location="$location" \
    --output none
fi

for provider_namespace in Microsoft.Web Microsoft.Storage Microsoft.CognitiveServices; do
  registration_state="$(az provider show --namespace "$provider_namespace" --query registrationState --output tsv 2>/dev/null || true)"
  if [[ "$registration_state" == Registered ]]; then
    log "Provider '$provider_namespace' is already registered."
  else
    log "Registering provider '$provider_namespace'."
    az provider register --namespace "$provider_namespace" --wait
  fi
done

ensure_application() {
  local display_name="$1"
  local applications_json application_count application_client_id application_object_id
  local service_principal_object_id service_principal_file

  applications_json="$(az ad app list --display-name "$display_name" --output json)"
  application_count="$(jq --arg name "$display_name" '[.[] | select(.displayName == $name)] | length' <<<"$applications_json")"

  case "$application_count" in
    0)
      log "Creating Entra application '$display_name'."
      read -r application_client_id application_object_id < <(
        az ad app create \
          --display-name "$display_name" \
          --sign-in-audience AzureADMyOrg \
          --query '[appId, id]' \
          --output tsv
      )
      ;;
    1)
      application_client_id="$(jq --arg name "$display_name" -r '.[] | select(.displayName == $name) | .appId' <<<"$applications_json")"
      application_object_id="$(jq --arg name "$display_name" -r '.[] | select(.displayName == $name) | .id' <<<"$applications_json")"
      log "Reusing Entra application '$display_name'."
      ;;
    *)
      fail "Multiple Entra applications are named '$display_name'. Rename duplicates before retrying."
      ;;
  esac

  service_principal_object_id="$(az ad sp show --id "$application_client_id" --query id --output tsv 2>/dev/null || true)"
  if [[ -z "$service_principal_object_id" ]]; then
    log "Creating service principal for '$display_name'."
    service_principal_file="$temporary_directory/${display_name//[^A-Za-z0-9._-]/_}-service-principal.txt"
    retry az ad sp create \
      --id "$application_client_id" \
      --query id \
      --output tsv > "$service_principal_file" || fail "Unable to create service principal for '$display_name' after waiting for directory replication."
    service_principal_object_id="$(<"$service_principal_file")"
  else
    log "Reusing service principal for '$display_name'."
  fi

  printf '%s\t%s\t%s\n' "$application_client_id" "$application_object_id" "$service_principal_object_id"
}

ensure_federated_credential() {
  local application_object_id="$1"
  local credential_name="$2"
  local subject="$3"
  local payload_file="$temporary_directory/$credential_name.json"
  local existing_json existing_credential_id matches

  jq --null-input \
    --arg name "$credential_name" \
    --arg subject "$subject" \
    '{
      name: $name,
      issuer: "https://token.actions.githubusercontent.com",
      subject: $subject,
      audiences: ["api://AzureADTokenExchange"],
      description: "GitHub Actions environment OIDC trust"
    }' > "$payload_file"

  existing_json="$(az ad app federated-credential list \
    --id "$application_object_id" \
    --query "[?name == '$credential_name'] | [0]" \
    --output json)"

  matches="$(jq --arg subject "$subject" '
    . != null and
    .issuer == "https://token.actions.githubusercontent.com" and
    .subject == $subject and
    .audiences == ["api://AzureADTokenExchange"]
  ' <<<"$existing_json")"

  if [[ "$matches" == true ]]; then
    log "Federated credential '$credential_name' is already current."
    return
  fi

  if [[ "$existing_json" != null ]]; then
    log "Replacing stale federated credential '$credential_name'."
    existing_credential_id="$(jq --raw-output .id <<<"$existing_json")"
    az ad app federated-credential delete \
      --id "$application_object_id" \
      --federated-credential-id "$existing_credential_id"
  else
    log "Creating federated credential '$credential_name'."
  fi

  retry az ad app federated-credential create \
    --id "$application_object_id" \
    --parameters "$payload_file" \
    --output none || fail "Unable to create federated credential '$credential_name' after waiting for directory replication."
}

ensure_role_assignment() {
  local principal_object_id="$1"
  local role_name="$2"
  local scope="$3"
  local assignment_count

  assignment_count="$(az role assignment list \
    --assignee-object-id "$principal_object_id" \
    --role "$role_name" \
    --scope "$scope" \
    --query 'length(@)' \
    --output tsv)"

  if [[ "$assignment_count" != 0 ]]; then
    log "Role '$role_name' is already assigned at '$scope'."
    return
  fi

  log "Assigning '$role_name' at '$scope'."
  az role assignment create \
    --assignee-object-id "$principal_object_id" \
    --assignee-principal-type ServicePrincipal \
    --role "$role_name" \
    --scope "$scope" \
    --output none
}

set_environment_secret() {
  local environment_name="$1"
  local secret_name="$2"
  local secret_value="$3"

  printf '%s' "$secret_value" | gh secret set "$secret_name" \
    --env "$environment_name" \
    --repo "$repository"
}

read -r infrastructure_client_id infrastructure_application_object_id infrastructure_principal_object_id < <(
  ensure_application "$infrastructure_application_name"
)
read -r api_client_id api_application_object_id api_principal_object_id < <(
  ensure_application "$api_application_name"
)

if [[ "$configure_github" == true ]]; then
  ensure_federated_credential \
    "$infrastructure_application_object_id" \
    "github-$infrastructure_environment" \
    "repo:$repository:environment:$infrastructure_environment"
  ensure_federated_credential \
    "$api_application_object_id" \
    "github-$api_environment" \
    "repo:$repository:environment:$api_environment"
fi

ensure_role_assignment "$infrastructure_principal_object_id" Contributor "$resource_group_scope"
ensure_role_assignment "$infrastructure_principal_object_id" 'Role Based Access Control Administrator' "$resource_group_scope"

if [[ "$configure_github" == true ]]; then
  log "Creating or updating GitHub environments and OIDC secrets."
  for environment_name in "$infrastructure_environment" "$api_environment" "$site_environment"; do
    gh api \
      --method PUT \
      "repos/$repository/environments/$environment_name" \
      --input - \
      --silent <<'JSON'
{
  "deployment_branch_policy": {
    "protected_branches": false,
    "custom_branch_policies": true
  }
}
JSON

    branch_policy_count="$(gh api \
      "repos/$repository/environments/$environment_name/deployment-branch-policies" \
      --jq '[.branch_policies[] | select(.name == "main")] | length')"
    if [[ "$branch_policy_count" == 0 ]]; then
      gh api \
        --method POST \
        "repos/$repository/environments/$environment_name/deployment-branch-policies" \
        --field name=main \
        --silent
    fi
  done

  set_environment_secret "$infrastructure_environment" AZURE_CLIENT_ID "$infrastructure_client_id"
  set_environment_secret "$infrastructure_environment" AZURE_TENANT_ID "$tenant_id"
  set_environment_secret "$infrastructure_environment" AZURE_SUBSCRIPTION_ID "$subscription_id"
  set_environment_secret "$infrastructure_environment" AZURE_API_PRINCIPAL_OBJECT_ID "$api_principal_object_id"

  set_environment_secret "$api_environment" AZURE_CLIENT_ID "$api_client_id"
  set_environment_secret "$api_environment" AZURE_TENANT_ID "$tenant_id"
  set_environment_secret "$api_environment" AZURE_SUBSCRIPTION_ID "$subscription_id"

  gh variable set AZURE_LOCATION \
    --env "$infrastructure_environment" \
    --repo "$repository" \
    --body "$location"

  if [[ "$static_web_app_name" != replace-with-* ]] && az staticwebapp show \
    --resource-group "$resource_group" \
    --name "$static_web_app_name" \
    --output none 2>/dev/null; then
    log 'Sending the Static Web Apps deployment token directly to GitHub.'
    az staticwebapp secrets list \
      --resource-group "$resource_group" \
      --name "$static_web_app_name" \
      --query properties.apiKey \
      --output tsv \
      | gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN \
        --env "$site_environment" \
        --repo "$repository"
  else
    log 'Static Web App not found; rerun bootstrap after site provisioning to synchronize its deployment token.'
  fi
fi

cat <<EOF

Bootstrap complete.
Resource group: $resource_group

Next:
1. Replace any remaining replace-with-* resource names in infra/azure/config.json.
2. Add required reviewers to the '$infrastructure_environment' and '$site_environment' GitHub environments.
3. Run the infrastructure workflow with component 'site' and operation 'deploy'.
4. Rerun bootstrap after the site exists to synchronize AZURE_STATIC_WEB_APPS_API_TOKEN.
EOF
