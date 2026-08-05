#!/usr/bin/env bash
set -Eeuo pipefail

readonly versions_file=".devcontainer/tool-versions.json"
readonly devcontainer_file=".devcontainer/devcontainer.json"
readonly node_feature='ghcr.io/devcontainers/features/node:1'
readonly azure_feature='ghcr.io/devcontainers/features/azure-cli:1'
readonly github_feature='ghcr.io/devcontainers/features/github-cli:1'

node_version="$(jq --exit-status --raw-output '.node' "$versions_file")"
npm_version="$(jq --exit-status --raw-output '.npm' "$versions_file")"
azure_cli_version="$(jq --exit-status --raw-output '.azureCli' "$versions_file")"
bicep_version="$(jq --exit-status --raw-output '.bicep' "$versions_file")"
github_cli_version="$(jq --exit-status --raw-output '.githubCli' "$versions_file")"

jq --raw-output --from-file .devcontainer/export-tool-versions.jq "$versions_file" >/dev/null

jq --exit-status \
	--arg node_feature "$node_feature" \
	--arg azure_feature "$azure_feature" \
	--arg github_feature "$github_feature" \
	--arg node "$node_version" \
	--arg npm "$npm_version" \
	--arg azure_cli "$azure_cli_version" \
	--arg bicep "v${bicep_version}" \
	--arg github_cli "$github_cli_version" \
	'.features[$node_feature].version == $node
	 and .features[$azure_feature].version == $azure_cli
	 and .features[$azure_feature].installBicep == true
	 and .features[$azure_feature].bicepVersion == $bicep
	 and .features[$github_feature].version == $github_cli' \
	"$devcontainer_file" >/dev/null || {
	printf 'Dev-container feature versions must match %s.\n' "$versions_file" >&2
	exit 1
}

for package_file in package.json api/package.json web/package.json; do
	jq --exit-status \
		--arg node "$node_version" \
		--arg npm "$npm_version" \
		'.engines.node == $node
		 and .engines.npm == $npm
		 and .packageManager == ("npm@" + $npm)' \
		"$package_file" >/dev/null || {
		printf '%s runtime versions must match %s.\n' "$package_file" "$versions_file" >&2
		exit 1
	}
done

grep --fixed-strings --quiet "ARG NODE_VERSION=${node_version}" api/Dockerfile || {
	printf 'api/Dockerfile Node version must match %s.\n' "$versions_file" >&2
	exit 1
}
