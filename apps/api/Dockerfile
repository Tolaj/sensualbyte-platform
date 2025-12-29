FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY src ./src

ENV NODE_ENV=production
ENV NODE_OPTIONS="--enable-source-maps"

RUN addgroup -S app && adduser -S app -G app
USER app

HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://localhost:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
