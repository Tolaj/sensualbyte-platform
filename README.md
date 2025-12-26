# sensual-platform (SENSUAL SERVER)

Self-hosted container platform:
Cloudflare Tunnel → Nginx Gateway → Dashboard + API → Provisioner → Docker

## Dev
1. Copy env:
   cp .env.example .env

2. Start Mongo:
   docker run -d --name sensual-mongo -p 27017:27017 mongo:7

3. Start API:
   cd apps/api
   npm i
   npm run dev

4. Start dashboard:
   cd apps/dashboard/frontend
   npm i
   npm run dev

## Prod
1. Ensure Cloudflared tunnel credentials exist on server
2. Build dashboard (`npm run build`) so dist/ exists
3. Deploy:
   ./scripts/deploy.sh

## API
- GET  /api/health
- POST /api/auth/login
- GET  /api/apps
- POST /api/apps
- POST /api/apps/:id/stop
- POST /api/apps/:id/start
- DELETE /api/apps/:id