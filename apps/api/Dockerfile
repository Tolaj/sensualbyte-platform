FROM node:20-alpine

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY src ./src
COPY ../../provisioner ./provisioner
COPY ../../runtime ./runtime

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "src/server.js"]
