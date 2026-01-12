FROM node:20-alpine AS deps
WORKDIR /repo

# Copy everything needed to build
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages ./packages
COPY apps/api ./apps/api

RUN npm install --production

FROM node:20-alpine AS runner
WORKDIR /repo

COPY --from=deps /repo /repo

WORKDIR /repo/apps/api
EXPOSE 3001

CMD ["node", "src/server.js"]
