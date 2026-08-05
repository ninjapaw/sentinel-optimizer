def valid_name($pattern; $minimum; $maximum):
  type == "string" and
  length >= $minimum and
  length <= $maximum and
  test($pattern);

if
  (.resourceGroup | valid_name("^[A-Za-z0-9._()\\-]+$"; 1; 90)) and
  (.publicSiteUrl | type == "string" and test("^https://[^\\r\\n]+$")) and
  (.deployApi | type == "boolean") and
  (.useApi | type == "boolean") and
  (.staticWebAppName | valid_name("^[A-Za-z0-9-]+$"; 2; 40)) and
  (.functionAppName | valid_name("^[A-Za-z0-9-]+$"; 2; 60)) and
  (.oidc.infrastructureApplicationName | valid_name("^[A-Za-z0-9._-]+$"; 1; 120)) and
  (.oidc.apiApplicationName | valid_name("^[A-Za-z0-9._-]+$"; 1; 120)) and
  (.oidc.infrastructureApplicationName != .oidc.apiApplicationName) and
  (.openAi.accountName | valid_name("^[A-Za-z0-9-]+$"; 2; 64)) and
  (.openAi.modelName | valid_name("^[A-Za-z0-9._-]+$"; 1; 100)) and
  (.openAi.deploymentName | valid_name("^[A-Za-z0-9._-]+$"; 1; 100))
then
  "AZURE_RESOURCE_GROUP=\(.resourceGroup)",
  "PUBLIC_SITE_URL=\(.publicSiteUrl)",
  "AZURE_API_ENABLED=\(.deployApi)",
  "AZURE_API_USED_BY_SITE=\(.useApi)",
  "AZURE_STATIC_WEB_APP_NAME=\(.staticWebAppName)",
  "AZURE_FUNCTIONAPP_NAME=\(.functionAppName)",
  "AZURE_INFRASTRUCTURE_APPLICATION_NAME=\(.oidc.infrastructureApplicationName)",
  "AZURE_API_APPLICATION_NAME=\(.oidc.apiApplicationName)",
  "AZURE_OPENAI_ACCOUNT_NAME=\(.openAi.accountName)",
  "AZURE_OPENAI_MODEL_NAME=\(.openAi.modelName)",
  "AZURE_OPENAI_MODEL_DEPLOYMENT=\(.openAi.deploymentName)"
else
  error("infra/azure/config.json contains missing or invalid values")
end
