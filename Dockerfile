# Build and test using Linux dependencies rather than the ZIP's Windows modules.
FROM node:24-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY server/package*.json ./server/
RUN cd server && npm ci
COPY client/package*.json ./client/
RUN cd client && npm ci
COPY . .
RUN npm run build && npm test

# Jenkins builds this target first; failed tests stop the pipeline.
FROM build AS checks
RUN touch /app/checks-passed

FROM build AS production-deps
RUN cd server && npm prune --omit=dev

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=5000 DB_PATH=/data/clinixos.sqlite UPLOADS_DIR=/data/uploads
WORKDIR /app/server
COPY --from=production-deps /app/server/node_modules ./node_modules
COPY --from=build /app/server/dist ./dist
COPY --from=build /app/server/package.json ./package.json
COPY --from=build /app/client/dist ./public
RUN mkdir -p /data/uploads && chown -R node:node /data
USER node
EXPOSE 5000
CMD ["node", "dist/index.js"]
