import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    config: { type: "string", default: "config/deploy.config.json" },
    environment: { type: "string" },
    branch: { type: "string" },
    "github-env": { type: "boolean", default: false },
    "github-output": { type: "boolean", default: false },
    check: { type: "boolean", default: false },
    "require-subscription": { type: "boolean", default: false },
  },
});

const configPath = resolve(values.config);
const config = JSON.parse(readFileSync(configPath, "utf8"));
const environmentName = resolveEnvironment(values.environment, values.branch);
const environment = config.environments?.[environmentName];

if (!environment) {
  throw new Error(`Environment '${environmentName}' is not defined in ${configPath}.`);
}

const settings = { ...config.defaults, ...environment };
validateConfig(config, environmentName, settings, values["require-subscription"]);

const output = {
  DEPLOYMENT_TARGET: "azure-static-web-app",
  DEPLOY_ENVIRONMENT: environmentName,
  AZURE_ENVIRONMENT: settings.azureEnvironment,
  AZURE_SUBSCRIPTION_ID: settings.subscriptionId,
  AZURE_LOCATION: settings.location,
  AZURE_RESOURCE_GROUP: settings.resourceGroup,
  AZURE_STATIC_WEB_APP_NAME: settings.staticWebAppName,
  AZURE_FUNCTIONAPP_NAME: settings.functionAppName,
  AZURE_KEY_VAULT_NAME: settings.keyVaultName,
  AZURE_OPENAI_ACCOUNT_NAME: settings.openAiAccountName,
  AZURE_OPENAI_MODEL_NAME: settings.openAiModelName,
  AZURE_OPENAI_MODEL_DEPLOYMENT: settings.openAiModelDeployment,
  AZURE_OPENAI_DEPLOYMENT_SKU: settings.openAiDeploymentSku,
  AZURE_OPENAI_MODEL_CAPACITY: settings.openAiModelCapacity,
  AZURE_SITE_SKU: settings.siteSku,
  AZURE_FUNCTION_INSTANCE_MEMORY_MB: settings.functionMemoryMB,
  AZURE_FUNCTION_MAXIMUM_INSTANCE_COUNT: settings.functionMaximumInstances,
  AZURE_FUNCTION_ALWAYS_READY_INSTANCES: settings.functionAlwaysReadyInstances,
  AZURE_FUNCTION_STORAGE_SKU: settings.functionStorageSku,
  AZURE_DEPLOY_API: settings.deployApi,
  AZURE_USE_API: settings.useApi,
  AZURE_ENABLE_ANONYMOUS_AI_ROUTES: settings.enableAnonymousAiRoutes,
  AZURE_DEPLOY_KEY_VAULT: settings.deployKeyVault,
  AZURE_DEPLOY_OPENAI: settings.deployOpenAi,
  AZURE_CUSTOM_DOMAIN: settings.customDomain,
  AZURE_PUBLIC_SITE_URL: settings.publicSiteUrl,
  PUBLIC_SITE_URL: settings.publicSiteUrl,
  PUBLIC_SITE_BASE: "/",
  AZURE_SECRET_EXPIRES_IN_DAYS: settings.secretExpirationDays,
  AZURE_SECRET_WARN_DAYS: settings.secretWarningDays,
};

const lines = Object.entries(output).map(([name, value]) => `${name}=${String(value)}`);
if (values["github-env"]) {
  const githubEnv = process.env.GITHUB_ENV;
  if (!githubEnv) {
    throw new Error("GITHUB_ENV is required when --github-env is used.");
  }
  appendFileSync(githubEnv, `${lines.join("\n")}\n`);
}
if (values["github-output"]) {
  const githubOutput = process.env.GITHUB_OUTPUT;
  if (!githubOutput) {
    throw new Error("GITHUB_OUTPUT is required when --github-output is used.");
  }
  appendFileSync(githubOutput, `${lines.join("\n")}\n`);
}
if (!values["github-env"] && !values["github-output"] && !values.check) {
  process.stdout.write(`${lines.join("\n")}\n`);
}

function resolveEnvironment(requestedEnvironment, branch) {
  if (requestedEnvironment && requestedEnvironment !== "auto") {
    return requestedEnvironment;
  }
  if (branch === "main") {
    return "prod";
  }
  if (branch === "dev") {
    return "dev";
  }
  throw new Error("Specify --environment dev|prod or --branch dev|main.");
}

function validateConfig(root, name, settings, requireSubscription) {
  if (root.configVersion !== "1.0.0") {
    throw new Error(`Unsupported deployment config version '${root.configVersion}'.`);
  }

  const requiredStrings = [
    "branch",
    "githubEnvironment",
    "azureEnvironment",
    "location",
    "resourceGroup",
    "staticWebAppName",
    "functionAppName",
    "keyVaultName",
    "customDomain",
    "publicSiteUrl",
  ];
  for (const property of requiredStrings) {
    if (typeof settings[property] !== "string" || settings[property].trim() === "") {
      throw new Error(`environments.${name}.${property} must be a non-empty string.`);
    }
  }

  if (settings.branch !== (name === "prod" ? "main" : "dev")) {
    throw new Error(`environments.${name}.branch does not match the promotion model.`);
  }
  if (settings.publicSiteUrl !== `https://${settings.customDomain}`) {
    throw new Error(`environments.${name}.publicSiteUrl must match customDomain.`);
  }
  if (!/^[a-z0-9-]{2,40}$/.test(settings.staticWebAppName)) {
    throw new Error(`environments.${name}.staticWebAppName is invalid.`);
  }
  if (!/^[A-Za-z][A-Za-z0-9-]{1,22}[A-Za-z0-9]$/.test(settings.keyVaultName)) {
    throw new Error(`environments.${name}.keyVaultName is invalid.`);
  }
  if (settings.subscriptionId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(settings.subscriptionId)) {
    throw new Error(`environments.${name}.subscriptionId is not a UUID.`);
  }
  if (requireSubscription && !settings.subscriptionId) {
    throw new Error(`Set environments.${name}.subscriptionId before deployment.`);
  }

  const devSubscription = root.environments?.dev?.subscriptionId?.trim();
  const prodSubscription = root.environments?.prod?.subscriptionId?.trim();
  if (devSubscription && prodSubscription && devSubscription === prodSubscription) {
    throw new Error("Development and production must use different Azure subscriptions.");
  }
}
