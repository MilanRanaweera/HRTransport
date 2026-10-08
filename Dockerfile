FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/mobile/package.json ./apps/mobile/package.json
RUN npm ci --workspace apps/api --omit=dev --ignore-scripts
COPY --chown=node:node apps/api/src ./apps/api/src
USER node
EXPOSE 4000
CMD ["node", "apps/api/src/server.js"]
