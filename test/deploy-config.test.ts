import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("deploy-config", () => {
  it("preserves public site values for GitHub Pages deployments", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "deploy-config-"));

    try {
      const configPath = join(tempDir, "deploy.config.json");
      writeFileSync(
        configPath,
        JSON.stringify(
          {
            configVersion: "1.0.0",
            defaults: {
              deploymentTarget: "azure-static-web-app",
              aiApiKeySecretName: "ai-api-key",
              location: "centralus",
              siteSku: "Free",
              functionMemoryMB: 512,
              functionMaximumInstances: 40,
              functionAlwaysReadyInstances: 0,
              functionStorageSku: "Standard_LRS",
              deployApi: true,
              useApi: true,
              enableAnonymousAiRoutes: false,
              deployKeyVault: true,
              deployOpenAi: false,
              openAiModelName: "gpt-4.1-mini",
              openAiModelDeployment: "sentinel-optimizer-model",
              openAiDeploymentSku: "GlobalStandard",
              openAiModelCapacity: 1,
              secretExpirationDays: 365,
              secretWarningDays: 30,
            },
            environments: {
              dev: {
                branch: "dev",
                githubEnvironment: "dev",
                azureEnvironment: "development",
                subscriptionId: "",
                location: "centralus",
                resourceGroup: "rg-demo",
                staticWebAppName: "demo-static-web",
                functionAppName: "demo-function",
                keyVaultName: "demokv12345",
                customDomain: "example.com",
                publicSiteUrl: "https://example.com",
                deploymentTarget: "github-pages",
              },
            },
          },
          null,
          2,
        ),
      );

      const output = execFileSync(
        "node",
        ["scripts/deploy-config.mjs", "--config", configPath, "--environment", "dev"],
        {
          cwd: "/workspaces/sentinel-optimizer",
          env: {
            ...process.env,
            PUBLIC_SITE_URL: "https://example.github.io/sentinel-optimizer",
            PUBLIC_SITE_BASE: "/sentinel-optimizer/",
          },
          encoding: "utf8",
        },
      );

      expect(output).toContain("DEPLOYMENT_TARGET=github-pages");
      expect(output).toContain("PUBLIC_SITE_URL=https://example.github.io/sentinel-optimizer");
      expect(output).toContain("PUBLIC_SITE_BASE=/sentinel-optimizer/");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
