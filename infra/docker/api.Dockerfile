# syntax=docker/dockerfile:1.7
# API NestJS (ADR-009, ADR-020). The same image runs the API, the migrations, the demo seed and admin:create.
# Build from the repository root: docker build -f infra/docker/api.Dockerfile -t twabibu-api .
# Build on the full Node image (it has OpenSSL 3, so Prisma picks the right engines), run on distroless:
# Node, OpenSSL and CA certificates only, no shell, no package manager, non-root.
FROM node:24-bookworm AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --filter "@twabibu/api..."
RUN pnpm --filter "@twabibu/api..." run build

FROM gcr.io/distroless/nodejs24-debian12:nonroot AS runtime
ENV NODE_ENV=production
# Built workspace with its dependencies: the prisma CLI and tsx stay available for migrations, seed and admin:create.
COPY --from=build --chown=nonroot:nonroot /app /app
WORKDIR /app/apps/api
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 CMD ["/nodejs/bin/node", "-e", "fetch('http://127.0.0.1:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
# The entrypoint is node: `docker compose run --rm api node_modules/prisma/build/index.js migrate deploy`.
CMD ["dist/main.js"]
