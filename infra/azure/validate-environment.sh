# MIT License
# Copyright (c) 2026 Microsoft Corporation
# See LICENSE in the repository root.

#!/usr/bin/env bash
set -euo pipefail

require_value() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    printf 'Missing required environment variable: %s\n' "$name" >&2
    exit 1
  fi
}

require_value AZURE_LOCATION
require_value AZURE_RESOURCE_GROUP
require_value AZURE_STATIC_WEB_APP_NAME
require_value AZURE_FUNCTIONAPP_NAME
require_value AZURE_PUBLIC_SITE_URL

if [[ ! "$AZURE_RESOURCE_GROUP" =~ ^[A-Za-z0-9._()\-]{1,90}$ ]]; then
  printf 'Invalid AZURE_RESOURCE_GROUP.\n' >&2
  exit 1
fi
if [[ ! "$AZURE_STATIC_WEB_APP_NAME" =~ ^[A-Za-z0-9-]{2,40}$ ]]; then
  printf 'Invalid AZURE_STATIC_WEB_APP_NAME.\n' >&2
  exit 1
fi
if [[ ! "$AZURE_FUNCTIONAPP_NAME" =~ ^[A-Za-z0-9-]{2,60}$ ]]; then
  printf 'Invalid AZURE_FUNCTIONAPP_NAME.\n' >&2
  exit 1
fi
if [[ ! "$AZURE_PUBLIC_SITE_URL" =~ ^https://[^[:space:]]+$ ]]; then
  printf 'Invalid AZURE_PUBLIC_SITE_URL.\n' >&2
  exit 1
fi

AZURE_DEPLOY_API="${AZURE_DEPLOY_API:-false}"
AZURE_USE_API="${AZURE_USE_API:-false}"
AZURE_ENABLE_ANONYMOUS_AI_ROUTES="${AZURE_ENABLE_ANONYMOUS_AI_ROUTES:-false}"
case "$AZURE_DEPLOY_API:$AZURE_USE_API:$AZURE_ENABLE_ANONYMOUS_AI_ROUTES" in
  true:true:false|true:true:true|true:false:false|true:false:true|false:false:false) ;;
  *)
    printf 'API and anonymous AI controls must be boolean values with use-api requiring deploy-api.\n' >&2
    exit 1
    ;;
esac

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    printf 'resource-group=%s\n' "$AZURE_RESOURCE_GROUP"
    printf 'static-web-app-name=%s\n' "$AZURE_STATIC_WEB_APP_NAME"
    printf 'function-app-name=%s\n' "$AZURE_FUNCTIONAPP_NAME"
    printf 'public-site-url=%s\n' "$AZURE_PUBLIC_SITE_URL"
    printf 'deploy-api=%s\n' "$AZURE_DEPLOY_API"
    printf 'use-api=%s\n' "$AZURE_USE_API"
  } >> "$GITHUB_OUTPUT"
fi
