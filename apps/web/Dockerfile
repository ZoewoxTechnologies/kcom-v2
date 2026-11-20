# syntax=docker/dockerfile:1
# Build from the repo root: docker build -f apps/web/Dockerfile .
FROM node:24-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo
COPY . .
# Search index source: the build fails if this API is unreachable. SEARCH_INDEX_PARTIAL_OK=true
# (CI verification builds only) allows an About-pages-only index when it is unset.
ARG PUBLIC_API_URL
ARG SEARCH_INDEX_PARTIAL_OK
ENV PUBLIC_API_URL=$PUBLIC_API_URL SEARCH_INDEX_PARTIAL_OK=$SEARCH_INDEX_PARTIAL_OK
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm --filter @kcom/web... build
RUN pnpm --filter @kcom/web deploy --prod /out && cp -r apps/web/dist /out/dist

FROM node:24-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080
WORKDIR /app
COPY --from=build /out .
USER node
EXPOSE 8080
CMD ["node", "dist/server/entry.mjs"]
