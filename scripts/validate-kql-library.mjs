import { readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const kqlDirectory = join(scriptsDirectory, "..", "kql");
const requiredFields = ["id", "title", "status", "lastReviewed", "summary", "tags", "docs"];
const requiredSections = [
  "Overview",
  "Prerequisites",
  "How to use it",
  "Query",
  "How the query works",
  "Result fields",
  "Known limits",
  "Sources",
];
const disclaimer = "> **Important: unofficial community guidance.**";

const files = readdirSync(kqlDirectory)
  .filter((file) => file.endsWith(".md") && file !== "README.md" && !file.startsWith("_"))
  .sort();

const errors = [];
for (const file of files) {
  const raw = readFileSync(join(kqlDirectory, file), "utf8");
  const frontmatter = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
  for (const field of requiredFields) {
    if (!new RegExp(`^${field}:`, "m").test(frontmatter)) errors.push(`${file}: missing frontmatter ${field}`);
  }

  const id = frontmatter.match(/^id:\s*["']?([^\r\n"']+)/m)?.[1]?.trim();
  if (id !== basename(file, ".md")) errors.push(`${file}: id must match the filename`);
  if (!/^lastReviewed:\s*["']?\d{4}-\d{2}-\d{2}["']?\s*$/m.test(frontmatter)) {
    errors.push(`${file}: lastReviewed must use YYYY-MM-DD`);
  }
  if (!/^\s+url:\s*["']?https:\/\/(learn\.microsoft\.com|azure\.microsoft\.com)\//m.test(frontmatter)) {
    errors.push(`${file}: docs must include an official Microsoft HTTPS URL`);
  }
  if (!raw.includes(disclaimer)) errors.push(`${file}: missing standard disclaimer`);
  for (const section of requiredSections) {
    if (!raw.includes(`## ${section}`)) errors.push(`${file}: missing ## ${section}`);
  }
  if (!/## Query\r?\n[\s\S]*?```kql\r?\n[\s\S]+?```/.test(raw)) {
    errors.push(`${file}: Query must contain a fenced kql block`);
  }
}

if (errors.length) {
  console.error(`KQL library validation failed:\n- ${errors.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log(`Validated ${files.length} KQL reports against the standard template.`);
}