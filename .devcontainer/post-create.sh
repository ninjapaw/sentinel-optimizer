# MIT License
# Copyright (c) 2026 Microsoft Corporation
# See LICENSE in the repository root.

#!/usr/bin/env bash
set -Eeuo pipefail

readonly versions_file=".devcontainer/tool-versions.json"
export DEBIAN_FRONTEND=noninteractive

missing_packages=()
command -v jq >/dev/null 2>&1 || missing_packages+=(jq)
command -v shellcheck >/dev/null 2>&1 || missing_packages+=(shellcheck)

if (( ${#missing_packages[@]} > 0 )); then
	sudo apt-get update
	sudo apt-get install --yes --no-install-recommends "${missing_packages[@]}"
	sudo rm -rf /var/lib/apt/lists/*
fi

node_version="$(jq --exit-status --raw-output '.node' "$versions_file")"
npm_version="$(jq --exit-status --raw-output '.npm' "$versions_file")"
azure_cli_version="$(jq --exit-status --raw-output '.azureCli' "$versions_file")"
bicep_version="$(jq --exit-status --raw-output '.bicep' "$versions_file")"
github_cli_version="$(jq --exit-status --raw-output '.githubCli' "$versions_file")"
jq_version="$(jq --exit-status --raw-output '.jq' "$versions_file")"
shellcheck_version="$(jq --exit-status --raw-output '.shellcheck' "$versions_file")"

bash .devcontainer/validate-tool-versions.sh

if [[ "$(npm --version)" != "$npm_version" ]]; then
	npm install --global "npm@${npm_version}"
fi

require_version() {
	local label="$1"
	local expected="$2"
	local actual="$3"

	if [[ "$actual" != "$expected" ]]; then
		printf '%s version mismatch: expected %s, found %s. Rebuild the container.\n' \
			"$label" "$expected" "$actual" >&2
		exit 1
	fi
}

require_version Node "$node_version" "$(node --version | sed 's/^v//')"
require_version npm "$npm_version" "$(npm --version)"
require_version 'Azure CLI' "$azure_cli_version" "$(az version --query '"azure-cli"' --output tsv)"
require_version Bicep "$bicep_version" "$(az bicep version | awk '{ print $4 }')"
require_version 'GitHub CLI' "$github_cli_version" "$(gh --version | awk 'NR == 1 { print $3 }')"
require_version jq "$jq_version" "$(jq --version | sed 's/^jq-//')"
require_version ShellCheck "$shellcheck_version" "$(shellcheck --version | awk '/^version:/ { print $2 }')"

npm ci
npm --prefix api ci
npm --prefix web ci

printf '\nCodespace tools ready:\n'
printf '  Node:       %s\n' "$(node --version)"
printf '  npm:        %s\n' "$(npm --version)"
printf '  Azure CLI:  %s\n' "$(az version --query '"azure-cli"' --output tsv)"
printf '  Bicep:      %s\n' "$(az bicep version)"
printf '  GitHub CLI: %s\n' "$(gh --version | head -n 1)"
printf '  jq:         %s\n' "$(jq --version)"
printf '  ShellCheck: %s\n' "$(shellcheck --version | awk '/^version:/ { print $2 }')"
printf '\nAuthenticate when needed with az login and gh auth login. Credentials are not stored in the image.\n'
