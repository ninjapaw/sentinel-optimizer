/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

/**
 * Loads the canonical KQL/PowerShell queries from `kql/*.md` (see
 * ../../../kql/README.md) so the query text shown in the UI always matches
 * what's documented there — one source of truth, no copy to keep in sync.
 *
 * The parser only understands the small, controlled frontmatter shape used
 * by files in that folder (id/title/summary/docs), not general YAML.
 */

export interface KqlDocLink {
  label: string;
  url: string;
}

export interface KqlDoc {
  id: string;
  title: string;
  summary: string;
  docs: KqlDocLink[];
  /** First fenced code block in the file — the copyable query text. */
  query: string;
}

const stripQuotes = (s: string) => s.trim().replace(/^["']|["']$/g, "");

function parseFrontmatter(raw: string): Pick<KqlDoc, "id" | "title" | "summary" | "docs"> {
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const lines = (fmMatch ? fmMatch[1] : "").split(/\r?\n/);
  let id = "";
  let title = "";
  let summary = "";
  const docs: KqlDocLink[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("id:")) {
      id = stripQuotes(line.slice("id:".length));
      i++;
    } else if (line.startsWith("title:")) {
      title = stripQuotes(line.slice("title:".length));
      i++;
    } else if (line.startsWith("summary:")) {
      i++;
      const summaryLines: string[] = [];
      while (i < lines.length && /^\s+\S/.test(lines[i])) {
        summaryLines.push(lines[i].trim());
        i++;
      }
      summary = summaryLines.join(" ");
    } else if (line.startsWith("docs:")) {
      i++;
      while (i < lines.length && /^\s*-\s*label:/.test(lines[i])) {
        const label = stripQuotes(lines[i].replace(/^\s*-\s*label:/, ""));
        i++;
        if (i < lines.length && /^\s*url:/.test(lines[i])) {
          const url = stripQuotes(lines[i].replace(/^\s*url:/, ""));
          docs.push({ label, url });
          i++;
        }
      }
    } else {
      i++;
    }
  }

  return { id, title, summary, docs };
}

function extractQuery(raw: string): string {
  const match = raw.match(/```(?:kql|kusto|powershell)\r?\n([\s\S]*?)```/);
  return match ? match[1].replace(/\r?\n$/, "") : "";
}

export function parseKqlDoc(raw: string): KqlDoc {
  return { ...parseFrontmatter(raw), query: extractQuery(raw) };
}
