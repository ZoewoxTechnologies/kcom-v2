# syntax=docker/dockerfile:1
# Build from the repo root: docker build -f apps/web/Dockerfile .
FROM node:22-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm --filter @kcom/web... build
RUN pnpm --filter @kcom/web deploy --prod /out && cp -r apps/web/dist /out/dist

FROM node:22-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080
WORKDIR /app
COPY --from=build /out .
USER node
EXPOSE 8080
CMD ["node", "dist/server/entry.mjs"]
