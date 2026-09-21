import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  new URL("../web/src/styles/global.css", import.meta.url),
  "utf8",
);

function themeBlock(selector: string) {
  const match = css.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`Missing theme block: ${selector}`);
  const block = match[1];
  if (block === undefined)
    throw new Error(`Missing theme block contents: ${selector}`);
  return block;
}

function token(block: string, name: string) {
  const match = block.match(
    new RegExp(`${name.replaceAll("-", "\\-")}\\s*:\\s*([^;]+);`),
  );
  if (!match) throw new Error(`Missing token: ${name}`);
  const value = match[1];
  if (value === undefined) throw new Error(`Missing token value: ${name}`);
  return value.trim();
}

function resolveColor(block: string, name: string): [number, number, number] {
  let value = token(block, name);
  for (let index = 0; index < 10; index += 1) {
    const variable = value.match(/var\((--[\w-]+)\)/);
    if (!variable) break;
    const variableName = variable[1];
    if (variableName === undefined)
      throw new Error(`Invalid variable reference: ${value}`);
    value = token(block, variableName);
  }

  const match = value.match(/^#([0-9a-f]{6})$/i);
  if (!match)
    throw new Error(`Token is not a six-digit hex color: ${name} = ${value}`);
  const hex = match[1];
  if (hex === undefined) throw new Error(`Missing hex color value: ${name}`);
  return [0, 2, 4].map((offset) =>
    Number.parseInt(hex.slice(offset, offset + 2), 16),
  ) as [number, number, number];
}

function relativeLuminance([red, green, blue]: [number, number, number]) {
  const channels = [red, green, blue]
    .map((channel) => channel / 255)
    .map((channel) =>
      channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    ) as [number, number, number];
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(
  foreground: [number, number, number],
  background: [number, number, number],
) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("theme contrast tokens", () => {
  it.each<[string, string]>([
    [':root,\\s*\\[data-theme="dark"\\]', "dark"],
    ['\\[data-theme="light"\\]', "light"],
  ])("keeps %s calculator colors at WCAG AA contrast", (selector, name) => {
    const block = `${themeBlock(":root")}\n${themeBlock(selector)}`;
    const requiredAliases = [
      "--color-bg-card",
      "--color-bg-secondary",
      "--color-border",
      "--color-primary",
      "--color-primary-foreground",
      "--color-bg-hover",
      "--color-text",
      "--color-text-secondary",
      "--color-info-bg",
      "--color-info",
      "--color-error",
      "--color-warning",
      "--color-success",
    ];

    for (const alias of requiredAliases)
      expect(token(block, alias)).toBeTruthy();

    const background = resolveColor(block, "--color-bg-card");
    expect(
      contrastRatio(
        resolveColor(block, "--color-primary-foreground"),
        resolveColor(block, "--color-primary"),
      ),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(resolveColor(block, "--color-text"), background),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(resolveColor(block, "--color-text-secondary"), background),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(
        resolveColor(block, "--color-info"),
        resolveColor(block, "--color-info-bg"),
      ),
    ).toBeGreaterThanOrEqual(4.5);

    for (const status of [
      "--color-error",
      "--color-warning",
      "--color-success",
    ]) {
      expect(
        contrastRatio(resolveColor(block, status), background),
        `${name} ${status}`,
      ).toBeGreaterThanOrEqual(3);
    }
  });
});
