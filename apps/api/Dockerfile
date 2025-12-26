FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY src ./src
COPY provisioner ./provisioner

ENV NODE_ENV=production
ENV NODE_OPTIONS="--enable-source-maps"

# Runtime state must be external
VOLUME ["/app/runtime"]

EXPOSE 3001

# Non-root user
RUN addgroup -S app && adduser -S app -G app
USER app

HEALTHCHECK --interval=30s --timeout=3s \
    CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "src/server.js"]
