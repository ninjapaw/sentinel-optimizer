# MIT License
# Copyright (c) 2026 Microsoft Corporation
# See LICENSE in the repository root.

#!/usr/bin/env bash
# Shared checks live in the vendored pawprint script; only the workload-specific
# requirements and outputs stay here.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/../.." && pwd)"

AZURE_DEPLOY_API="${AZURE_DEPLOY_API:-false}"
AZURE_USE_API="${AZURE_USE_API:-false}"
AZURE_ENABLE_ANONYMOUS_AI_ROUTES="${AZURE_ENABLE_ANONYMOUS_AI_ROUTES:-false}"

required="AZURE_STATIC_WEB_APP_NAME AZURE_PUBLIC_SITE_URL"
if [[ "$AZURE_DEPLOY_API" == true || "$AZURE_USE_API" == true ]]; then
  required="$required AZURE_FUNCTIONAPP_NAME"
fi

PAWPRINT_REQUIRE="$required" \
  bash "${repo_root}/vendor/pawprint/scripts/validate-environment.sh"

# Anonymous AI routes without a deployed API would expose a route that cannot
# authenticate, so the valid combinations are enumerated rather than checked loosely.
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
    printf 'function-app-name=%s\n' "${AZURE_FUNCTIONAPP_NAME:-}"
    printf 'deploy-api=%s\n' "$AZURE_DEPLOY_API"
    printf 'use-api=%s\n' "$AZURE_USE_API"
  } >> "$GITHUB_OUTPUT"
fi
