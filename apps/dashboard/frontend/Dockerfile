# ---------- build stage ----------
FROM node:20-alpine AS build
WORKDIR /app

# Copy frontend package files only (caches npm install properly)
COPY apps/dashboard/frontend/package*.json ./
RUN npm install

# Copy frontend source
COPY apps/dashboard/frontend/ ./

# Build CRA
RUN npm run build

# ---------- runtime stage ----------
FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
