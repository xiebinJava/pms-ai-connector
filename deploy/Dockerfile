FROM node:22-alpine AS build

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.18.2 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/pms-capabilities/package.json ./packages/pms-capabilities/package.json
COPY packages/pms-client/package.json ./packages/pms-client/package.json
COPY packages/pms-contracts/package.json ./packages/pms-contracts/package.json
COPY apps/mcp-server/package.json ./apps/mcp-server/package.json
COPY apps/opencli-plugin/package.json ./apps/opencli-plugin/package.json

RUN pnpm install --frozen-lockfile

COPY packages ./packages
COPY apps ./apps
COPY scripts ./scripts
COPY tsconfig.json ./tsconfig.json

RUN pnpm run build:mcp
RUN pnpm deploy --legacy --filter @pms-ai-connector/mcp-server --prod /opt/mcp-runtime

FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PMS_MCP_HOST=0.0.0.0
ENV PMS_MCP_PORT=3000

COPY --from=build /opt/mcp-runtime/node_modules ./node_modules
COPY --from=build /opt/mcp-runtime/package.json ./package.json
COPY --from=build /app/dist/mcp-http-main.js ./dist/mcp-http-main.js

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz >/dev/null || exit 1

USER node

CMD ["node", "dist/mcp-http-main.js"]
