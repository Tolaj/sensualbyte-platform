FROM node:20-alpine AS deps
WORKDIR /repo
COPY package*.json ./
COPY workers/controllers ./workers/controllers/
COPY provisioner ./provisioner
COPY packages ./packages
RUN npm install

FROM node:20-alpine AS runner
WORKDIR /repo
COPY --from=deps /repo /repo
WORKDIR /repo/workers/controllers
CMD ["node","src/worker.js"]
