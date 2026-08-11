/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { loadEnvFile } from "node:process";
import { routeApiRequest } from "../../core/router.js";
import { RECOMMEND_MAX_BODY_BYTES } from "../../core/recommend.js";
import { createConfiguredAiProvider } from "../../runtime/provider.js";
import {
  apiResponseHeaders,
  INTERNAL_CONFIG,
  parseCommaSeparated,
  parsePort,
  USER_CONFIG,
} from "../../../../shared/index.js";

try {
  loadEnvFile();
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

const provider = createConfiguredAiProvider();
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
  response.writeHead(status, apiResponseHeaders(origin));
  response.end(JSON.stringify(body));
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const origin = allowedOrigin(request);
  if (request.method === "OPTIONS") {
    response.writeHead(204, apiResponseHeaders(origin));
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
}

const server = createServer((request, response) => {
  void handleRequest(request, response).catch((error: unknown) => {
    console.error("Unhandled API request error.", error);
    if (response.headersSent) {
      response.destroy();
      return;
    }
    writeJson(response, 500, { error: "Internal server error." });
  });
});

server.headersTimeout = INTERNAL_CONFIG.api.nodeServer.headersTimeoutMs;
server.keepAliveTimeout = INTERNAL_CONFIG.api.nodeServer.keepAliveTimeoutMs;
server.maxRequestsPerSocket = INTERNAL_CONFIG.api.nodeServer.maxRequestsPerSocket;
server.requestTimeout = INTERNAL_CONFIG.api.nodeServer.requestTimeoutMs;

server.on("clientError", (_error, socket) => {
  if (socket.writable) {
    socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
  }
});

server.listen(port, host, () => {
  console.log(`${USER_CONFIG.site.name} API listening on http://${host}:${port}`);
});

function shutdown(): void {
  const forceExit = setTimeout(
    () => process.exit(1),
    INTERNAL_CONFIG.api.nodeServer.shutdownTimeoutMs,
  );
  forceExit.unref();
  server.closeIdleConnections();
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
