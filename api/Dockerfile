ARG NODE_VERSION=22.12.0
FROM node:${NODE_VERSION}-bookworm-slim AS build
WORKDIR /app
COPY package.json ./
COPY api/package.json api/package-lock.json ./api/
WORKDIR /app/api
RUN npm ci
COPY api/tsconfig.json api/tsconfig.build.json ./
COPY api/src ./src
COPY shared /app/shared
RUN npm run build && npm prune --omit=dev

FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV PORT=7071
WORKDIR /app
COPY --from=build --chown=node:node /app/api/package.json /app/api/package-lock.json ./
COPY --from=build --chown=node:node /app/api/node_modules ./node_modules
COPY --from=build --chown=node:node /app/api/dist ./dist
USER node
EXPOSE 7071
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:7071/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "dist/api/src/adapters/node/server.js"]
