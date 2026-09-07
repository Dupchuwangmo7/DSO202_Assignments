# --- deps stage: install with full npm toolchain, discarded after ---
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

# --- runtime stage: just node + node_modules + source, no build tooling ---
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

RUN addgroup -S app && adduser -S app -G app
USER app

EXPOSE 8080
CMD ["node", "src/server.js"]
