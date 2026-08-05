import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { loadEnvFile } from "node:process";
import { routeApiRequest } from "../../core/router.js";
import { RECOMMEND_MAX_BODY_BYTES } from "../../core/recommend.js";
import { createOpenAiProvider } from "../../providers/openai.js";
import {
  INTERNAL_CONFIG,
  parseCommaSeparated,
  parsePort,
  USER_CONFIG,
} from "../../../../shared/index.js";

try {
  loadEnvFile();
} catch {}

const provider = process.env.AI_API_ENABLED === "true"
  ? createOpenAiProvider()
  : undefined;
const port = parsePort(process.env.PORT || process.env.API_PORT, USER_CONFIG.api.port);
const host = process.env.HOST || USER_CONFIG.api.host;

async function readBody(request: IncomingMessage): Promise<string | null> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.byteLength;
    if (bytes > RECOMMEND_MAX_BODY_BYTES) return null;
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function allowedOrigin(request: IncomingMessage): string | undefined {
  const origin = request.headers.origin;
  if (!origin) return undefined;
  const configured = process.env.API_ALLOWED_ORIGINS
    ? parseCommaSeparated(process.env.API_ALLOWED_ORIGINS)
    : USER_CONFIG.api.localWebOrigins;
  return configured.includes(origin)
    ? origin
    : undefined;
}

function writeJson(
  response: ServerResponse,
  status: number,
  body: Record<string, unknown>,
  origin?: string,
): void {
  response.writeHead(status, {
    "cache-control": INTERNAL_CONFIG.api.headers.cacheControl,
    "content-type": INTERNAL_CONFIG.api.headers.contentType,
    "referrer-policy": INTERNAL_CONFIG.api.headers.referrerPolicy,
    "x-content-type-options": INTERNAL_CONFIG.api.headers.contentTypeOptions,
    ...(origin
      ? {
          "access-control-allow-origin": origin,
          "access-control-allow-headers": "content-type",
          "access-control-allow-methods": "GET, POST, OPTIONS",
          vary: "Origin",
        }
      : {}),
  });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  const origin = allowedOrigin(request);
  if (request.method === "OPTIONS") {
    response.writeHead(204, origin ? {
      "access-control-allow-origin": origin,
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      vary: "Origin",
    } : {});
    response.end();
    return;
  }

  const body = request.method === "POST" ? await readBody(request) : "";
  if (body === null) {
    writeJson(response, 413, { error: "Payload too large." }, origin);
    return;
  }

  const pathname = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`).pathname;
  const result = await routeApiRequest(request.method || "GET", pathname, body, provider);
  writeJson(response, result.status, result.body, origin);
});

server.listen(port, host, () => {
  console.log(`${USER_CONFIG.site.name} API listening on http://${host}:${port}`);
});

function shutdown(): void {
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
