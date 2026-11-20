# syntax=docker/dockerfile:1.7
# Next.js apps (site patient/Pro/Pharma, back-office) as a self-contained server on distroless.
#   docker build -f infra/docker/next.Dockerfile --build-arg APP=web -t twabibu-web .
#   docker build -f infra/docker/next.Dockerfile --build-arg APP=admin -t twabibu-admin .
# NEXT_PUBLIC_* values and the API proxy target are fixed at build time.
FROM node:24-bookworm AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app
ARG APP=web
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3100
ARG NEXT_PUBLIC_DEMO_MODE=false
ARG API_INTERNAL_URL=http://api:4000
ENV NEXT_OUTPUT=standalone NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL NEXT_PUBLIC_DEMO_MODE=$NEXT_PUBLIC_DEMO_MODE API_INTERNAL_URL=$API_INTERNAL_URL
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --filter "@twabibu/${APP}..."
RUN pnpm --filter "@twabibu/${APP}..." run build
# The standalone server leaves out static files: put them next to it, under a path that does not depend on APP.
RUN mkdir -p /out && cp -r apps/${APP}/.next/standalone/. /out/ \
  && cp -r apps/${APP}/.next/static /out/apps/${APP}/.next/static \
  && cp -r apps/${APP}/public /out/apps/${APP}/public \
  && mv /out/apps/${APP} /out/apps/app

FROM gcr.io/distroless/nodejs24-debian12:nonroot AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=nonroot:nonroot /out /app
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 CMD ["/nodejs/bin/node", "-e", "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"]
CMD ["apps/app/server.js"]
