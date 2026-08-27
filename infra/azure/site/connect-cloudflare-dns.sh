#!/usr/bin/env bash
set -Eeuo pipefail

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

require_value() {
  local name="$1"
  [[ -n "${!name:-}" ]] || fail "Set $name before running this script."
}

require_command az
require_command curl
require_command jq

require_value AZURE_RESOURCE_GROUP
require_value AZURE_STATIC_WEB_APP_NAME
require_value AZURE_CUSTOM_DOMAIN
require_value CLOUDFLARE_ZONE_ID
require_value CLOUDFLARE_API_TOKEN

[[ "$AZURE_CUSTOM_DOMAIN" != */* && "$AZURE_CUSTOM_DOMAIN" != *:* ]] || fail 'AZURE_CUSTOM_DOMAIN must be a hostname.'

cloudflare_api="https://api.cloudflare.com/client/v4"
cloudflare_headers=(
  --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
  --header 'Content-Type: application/json'
)

zone_response="$(curl --fail-with-body --silent --show-error "${cloudflare_headers[@]}" "$cloudflare_api/zones/$CLOUDFLARE_ZONE_ID")"
[[ "$(jq -r '.success' <<<"$zone_response")" == true ]] || fail "Cloudflare zone lookup failed: $(jq -c '.errors' <<<"$zone_response")"
zone_name="$(jq -r '.result.name' <<<"$zone_response")"
[[ "$AZURE_CUSTOM_DOMAIN" == "$zone_name" || "$AZURE_CUSTOM_DOMAIN" == *".$zone_name" ]] || \
  fail "AZURE_CUSTOM_DOMAIN '$AZURE_CUSTOM_DOMAIN' is not inside Cloudflare zone '$zone_name'."

hostname_response="$(az staticwebapp hostname show \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --name "$AZURE_STATIC_WEB_APP_NAME" \
  --hostname "$AZURE_CUSTOM_DOMAIN" \
  --output json 2>/dev/null || true)"
validation_token="$(jq -r '.validationToken // .properties.validationToken // empty' <<<"${hostname_response:-{}}")"

if [[ -z "$validation_token" ]]; then
  az staticwebapp hostname set \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$AZURE_STATIC_WEB_APP_NAME" \
    --hostname "$AZURE_CUSTOM_DOMAIN" \
    --validation-method dns-txt-token \
    --no-wait \
    --output none
  hostname_response="$(az staticwebapp hostname show \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$AZURE_STATIC_WEB_APP_NAME" \
    --hostname "$AZURE_CUSTOM_DOMAIN" \
    --output json)"
  validation_token="$(jq -r '.validationToken // .properties.validationToken // empty' <<<"$hostname_response")"
fi

[[ -n "$validation_token" ]] || fail 'Azure did not return a custom-domain validation token. Run the Static Web App hostname command and inspect its response.'

upsert_record() {
  local record_name="$1"
  local record_type="$2"
  local record_content="$3"
  local records_response record_id payload

  records_response="$(curl --fail-with-body --silent --show-error "${cloudflare_headers[@]}" \
    "$cloudflare_api/zones/$CLOUDFLARE_ZONE_ID/dns_records?type=$record_type&name=$record_name")"
  record_id="$(jq -r '.result[0].id // empty' <<<"$records_response")"
  payload="$(jq -n --arg type "$record_type" --arg name "$record_name" --arg content "$record_content" \
    '{type:$type,name:$name,content:$content,ttl:1,proxied:false}')"

  if [[ -n "$record_id" ]]; then
    curl --fail-with-body --silent --show-error "${cloudflare_headers[@]}" \
      --request PUT --data "$payload" \
      "$cloudflare_api/zones/$CLOUDFLARE_ZONE_ID/dns_records/$record_id" >/dev/null
    printf 'Updated Cloudflare %s record %s.\n' "$record_type" "$record_name"
  else
    curl --fail-with-body --silent --show-error "${cloudflare_headers[@]}" \
      --request POST --data "$payload" \
      "$cloudflare_api/zones/$CLOUDFLARE_ZONE_ID/dns_records" >/dev/null
    printf 'Created Cloudflare %s record %s.\n' "$record_type" "$record_name"
  fi
}

upsert_record "_dnsauth.$AZURE_CUSTOM_DOMAIN" TXT "$validation_token"
default_hostname="$(az staticwebapp show \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --name "$AZURE_STATIC_WEB_APP_NAME" \
  --query defaultHostname \
  --output tsv)"
[[ -n "$default_hostname" ]] || fail 'Azure Static Web Apps default hostname was empty.'
upsert_record "$AZURE_CUSTOM_DOMAIN" CNAME "$default_hostname"

printf '\nDNS records are configured. Allow DNS propagation, then verify Azure custom-domain status:\n'
printf 'az staticwebapp hostname show --resource-group %s --name %s --hostname %s\n' \
  "$AZURE_RESOURCE_GROUP" "$AZURE_STATIC_WEB_APP_NAME" "$AZURE_CUSTOM_DOMAIN"
