FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci
RUN npm run db:generate

COPY tsconfig*.json ./
COPY src ./src/

RUN npm run build

FROM node:22-bookworm-slim

WORKDIR /app

# Adapter CLIs run inside this container, so they and their tooling must be present.
# git is required because the agents operate on real repositories; the docker CLI
# lets the adapter fall back to probing a sidecar container when one is mounted.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git \
        ca-certificates \
        curl \
        ripgrep \
        docker.io \
    && rm -rf /var/lib/apt/lists/*

# Adapter harnesses: Claude Code and Codex.
RUN npm i -g @anthropic-ai/claude-code @openai/codex \
    && claude --version \
    && codex --version

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 3001

CMD ["npm", "start"]
