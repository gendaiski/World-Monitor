# =============================================================================
# World Monitor — AI Port
# =============================================================================
# OpenAI-compatible gateway in front of any AI provider, API key, local model
# or subscription CLI. Build context: ./ai-port
#
# Optional subscription bridges: build with INSTALL_SUBSCRIPTION_CLIS=true to
# add the official Claude Code, Codex and Gemini CLIs, then sign in once with
#   docker compose exec -it ai-port claude      (or: codex login / gemini)
# Credentials live in the ai-port-home volume and never leave the container.
# =============================================================================
FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1

ARG INSTALL_SUBSCRIPTION_CLIS=false
ENV NODE_ENV=production

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

RUN if [ "$INSTALL_SUBSCRIPTION_CLIS" = "true" ]; then \
      apk add --no-cache bash git ripgrep \
      && npm install -g @anthropic-ai/claude-code @openai/codex @google/gemini-cli \
      && npm cache clean --force; \
    fi

COPY src ./src
COPY public ./public

RUN mkdir -p /app/data && chown -R node:node /app/data
USER node

ENV AI_PORT_HOST=0.0.0.0 \
    AI_PORT_PORT=8787 \
    AI_PORT_CONFIG=/app/data/ai-port.json
EXPOSE 8787
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8787/health >/dev/null || exit 1

CMD ["node", "src/server.mjs"]
