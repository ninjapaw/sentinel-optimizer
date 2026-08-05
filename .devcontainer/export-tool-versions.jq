def semantic_version:
  type == "string" and test("^[0-9]+\\.[0-9]+\\.[0-9]+$");

if (
  (.node | semantic_version) and
  (.npm | semantic_version) and
  (.azureCli | semantic_version) and
  (.bicep | semantic_version) and
  (.githubCli | semantic_version) and
  (.jq | test("^[0-9]+\\.[0-9]+(?:\\.[0-9]+)?$")) and
  (.shellcheck | semantic_version)
) then
  "NODE_VERSION=\(.node)",
  "NPM_VERSION=\(.npm)",
  "AZURE_CLI_VERSION=\(.azureCli)",
  "BICEP_VERSION=\(.bicep)",
  "GITHUB_CLI_VERSION=\(.githubCli)",
  "JQ_VERSION=\(.jq)",
  "SHELLCHECK_VERSION=\(.shellcheck)"
else
  error("tool versions must use full numeric semantic versions")
end
