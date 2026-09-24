import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, stat } from "node:fs/promises";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.MAPPER_BASE_URL || "http://127.0.0.1:4368";
const output = resolve(process.env.MAPPER_TEST_OUTPUT || "test-results/mapper");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
let aiMode = "success";
let pendingRoute;
const requests = [];
await page.route("**/api/recommend", async (route) => {
  requests.push(route.request().postDataJSON());
  if (aiMode === "pending") {
    pendingRoute = route;
    return;
  }
  await route.fulfill({
    status: aiMode === "failure" ? 501 : 200,
    contentType: "application/json",
    body: JSON.stringify(
      aiMode === "failure"
        ? { error: "AI is not configured" }
        : {
            text: "Review candidate protection. Coverage is not verified.",
            model: "browser-test",
          },
    ),
  });
});

try {
  await page.goto(`${base}/#tool-cloud-security-value-mapper`);
  await page
    .getByRole("button", { name: "Load synthetic example", exact: true })
    .click();
  assert.equal(await page.locator(".protection-list > li").count(), 3);
  assert.equal(requests.length, 0);
  assert.equal(
    await page
      .getByRole("button", { name: "Generate AI brief", exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.locator("#mapper-opportunities").scrollIntoViewIfNeeded();
  await page.screenshot({ path: resolve(output, "desktop.png") });
  await page.getByRole("button", { name: /^Show all/ }).click();
  assert.ok((await page.locator(".protection-list > li").count()) > 3);
  await page.getByRole("button", { name: "Show top three" }).click();

  await page.locator(".mapper-consent input").check();
  await page
    .getByRole("button", { name: "Generate AI brief", exact: true })
    .click();
  await page.locator(".mapper-ai-result").waitFor();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].kind, "protection");
  assert.ok(!JSON.stringify(requests[0]).includes("App Gateway access"));
  await page.getByLabel("Audience", { exact: true }).selectOption("SOC leader");
  assert.equal(await page.locator(".mapper-ai-result").count(), 0);
  assert.equal(await page.locator(".mapper-consent input").isChecked(), false);
  aiMode = "failure";
  await page.locator(".mapper-consent input").check();
  await page
    .getByRole("button", { name: "Generate AI brief", exact: true })
    .click();
  await page.getByRole("alert").filter({ hasText: "isn't enabled" }).waitFor();
  assert.equal(await page.locator(".protection-list > li").count(), 3);

  await page
    .getByText("Telemetry evidence and reports", { exact: true })
    .click();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download executive PDF", exact: true })
    .click();
  const download = await downloadPromise;
  const reportPath = resolve(output, download.suggestedFilename());
  await download.saveAs(reportPath);
  assert.ok((await stat(reportPath)).size > 1000);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#mapper-opportunities").scrollIntoViewIfNeeded();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({ path: resolve(output, "mobile.png") });

  aiMode = "pending";
  await page
    .getByRole("button", { name: "Generate AI brief", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Generating brief...", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Clear analysis", exact: true })
    .click();
  if (pendingRoute)
    await pendingRoute
      .fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ text: "Stale response" }),
      })
      .catch(() => {});
  assert.equal(await page.locator(".mapper-ai-result").count(), 0);
  assert.equal(await page.locator(".protection-list").count(), 0);
  await page
    .getByLabel("Paste JSON, CSV, or TSV results")
    .fill("Source,Volume GB\nMystery feed,1");
  await page
    .getByRole("button", { name: "Find protection opportunities", exact: true })
    .click();
  await page.getByText(/No supported protection mapping yet/).waitFor();

  await page
    .getByRole("button", { name: "Clear analysis", exact: true })
    .click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "synthetic.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Source,Volume GB,Notes\nSigninLogs customer.example.com,2,private-note\nPostgreSQLLogs,,\nDeviceProcessEvents,1,",
    ),
  });
  await page.locator(".protection-list").waitFor();
  const payload = JSON.parse(
    await page
      .locator(".cloud-mapper details")
      .filter({
        has: page.getByText("Preview data sent to AI", { exact: true }),
      })
      .locator("code")
      .textContent(),
  );
  assert.ok(!JSON.stringify(payload).includes("customer.example.com"));
  assert.ok(!JSON.stringify(payload).includes("private-note"));
  await page
    .getByText("Telemetry evidence and reports", { exact: true })
    .click();
  assert.ok(
    await page.getByRole("cell", { name: "Not supplied", exact: true }).count(),
  );
  await page.getByRole("spinbutton", { name: "Data window (days)" }).fill("15");
  const revisedPayload = JSON.parse(
    await page
      .locator(".cloud-mapper details")
      .filter({
        has: page.getByText("Preview data sent to AI", { exact: true }),
      })
      .locator("code")
      .textContent(),
  );
  assert.equal(revisedPayload.windowDays, 15);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: direct link, auto-analysis, top-three actions, consent, AI success/failure/cancellation, PDF, CSV privacy, unknown input, window updates, desktop/mobile layout.",
  );
  console.log(`Screenshots and synthetic report: ${output}`);
} finally {
  await browser.close();
}
