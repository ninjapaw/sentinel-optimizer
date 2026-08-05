import type { AiProvider, ApiResult } from "./contracts.js";
import { readJson, result } from "./http.js";
import {
  isExampleRequest,
  USER_CONFIG,
  type ExampleRequest,
} from "../../../shared/index.js";

export const EXAMPLE_MAX_BODY_BYTES = USER_CONFIG.api.example.maxBodyBytes;

function extractJson(raw: string): string | null {
  let candidate = raw.trim();
  const fence = candidate.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence) candidate = fence[1].trim();
  const starts = [candidate.indexOf("{"), candidate.indexOf("[")].filter(
    (index) => index >= 0,
  );
  if (!starts.length) return null;
  const start = Math.min(...starts);
  const close = candidate[start] === "{" ? "}" : "]";
  const end = candidate.lastIndexOf(close);
  return end > start ? candidate.slice(start, end + 1) : null;
}

function buildPrompt(request: ExampleRequest): string {
  return [
    `Generate one realistic example export for "${request.label}".`,
    "Match the exact JSON structure and field names of the template; change only values.",
    `Schema notes: ${request.schemaHint}`,
    `Template:\n${request.template}`,
    "Output only valid JSON with no prose, markdown, comments, or trailing commas.",
    "Use 4-6 plausible enterprise log sources and realistic daily volumes.",
    'Keep "windowDays" at 30 when present.',
  ].join("\n\n");
}

export async function handleExample(
  rawBody: string,
  provider?: AiProvider,
): Promise<ApiResult> {
  if (!provider) {
    return result({ error: "AI example generation is not enabled for this deployment." }, 501);
  }

  const parsed = readJson(rawBody, EXAMPLE_MAX_BODY_BYTES);
  if (!parsed.ok) return parsed.result;
  if (!isExampleRequest(parsed.value)) {
    return result({ error: "Expected a vendor example request." }, 400);
  }

  try {
    const completion = await provider.complete({
      messages: [
        {
          role: "system",
          content:
            "You output only valid JSON matching the requested structure. Never include prose or code fences.",
        },
        { role: "user", content: buildPrompt(parsed.value) },
      ],
      maxTokens: USER_CONFIG.api.example.maxTokens,
      temperature: USER_CONFIG.api.example.temperature,
    });
    const candidate = extractJson(completion.text);
    if (!candidate) {
      return result({ error: "The AI service did not return usable JSON." }, 502);
    }

    try {
      return result({
        text: JSON.stringify(JSON.parse(candidate), null, 2),
        model: completion.model,
      });
    } catch {
      return result({ error: "The AI service returned malformed JSON." }, 502);
    }
  } catch {
    return result({ error: "The AI service failed to generate an example." }, 502);
  }
}
