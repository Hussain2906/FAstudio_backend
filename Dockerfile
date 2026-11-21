FROM node:22-bookworm-slim AS build
WORKDIR /workspace
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@12.14.0 --activate
COPY . .
# Prisma config requires DIRECT_URL during generation; this build-only dummy never connects.
ENV DIRECT_URL=postgresql://build:build@127.0.0.1:5432/build
RUN pnpm --dir packages/cms-contracts install --frozen-lockfile \
  && pnpm --dir packages/cms-contracts build
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM node:22-bookworm-slim AS runtime
WORKDIR /workspace
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN npm install --global --no-fund --no-audit pnpm@12.14.0
ENV NODE_ENV=production PORT=4000
COPY --from=build --chown=node:node /workspace /workspace
USER node
EXPOSE 4000
CMD ["pnpm", "start:prod"]
