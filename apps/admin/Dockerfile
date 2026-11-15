# syntax=docker/dockerfile:1
# Build from the repo root: docker build -f apps/admin/Dockerfile .
FROM node:22-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm --filter @kcom/admin... build
FROM nginx:1.27-alpine
COPY apps/admin/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /repo/apps/admin/dist /usr/share/nginx/html
ENV PORT=8080
EXPOSE 8080
