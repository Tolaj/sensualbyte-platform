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

# SENSUAL SERVER — COMPLETE PERSISTED DATA SCHEMA
Single-file, single-block, canonical reference

This document defines ALL data that is persisted by the SENSUAL SERVER platform.
Everything here is intentional, explicit, and authoritative.

============================================================
OVERALL DATA MODEL
============================================================

Layer: MongoDB
Purpose: Identity, access control, relationships
Durability: Persistent
Source of Truth: YES

Layer: runtime/*.json
Purpose: Platform runtime state
Durability: Persistent but reconstructable
Source of Truth: NO

Layer: Docker Engine
Purpose: Actual execution
Durability: Persistent on host
Source of Truth: YES

Layer: Filesystem (ssh-keys)
Purpose: Access material
Durability: Persistent
Source of Truth: YES

============================================================
1. MONGODB — IDENTITY & RELATIONSHIPS (AUTHORITATIVE)
============================================================

MongoDB stores WHO users are, HOW they relate, and WHO owns WHAT.
This data must never be lost.

------------------------------------------------------------
USERS
Collection: users
------------------------------------------------------------

Schema:
  {
    _id: ObjectId
    email: string
    passwordHash: string
    role: "super_admin" | "admin" | "team"
    active: boolean
    createdAt: ISODate
  }

Purpose:
- Authentication
- Global authorization
- Account lifecycle

------------------------------------------------------------
TEAMS
Collection: teams
------------------------------------------------------------

Schema:
  {
    _id: ObjectId
    id: "team_xxxxx"
    name: string
    createdAt: ISODate
  }

Purpose:
- Organizational boundary
- Grouping of users and projects

------------------------------------------------------------
TEAM MEMBERSHIP
Collection: team_members
------------------------------------------------------------

Schema:
  {
    _id: ObjectId
    teamId: "team_xxxxx"
    userId: ObjectId
    role: "admin" | "member"
    createdAt: ISODate
  }

Purpose:
- Role-based access inside teams

------------------------------------------------------------
PROJECTS
Collection: projects
------------------------------------------------------------

Schema:
  {
    _id: ObjectId
    id: "proj_xxxxx"
    name: string
    teamId: "team_xxxxx"
    createdBy: ObjectId
    createdAt: ISODate
  }

Purpose:
- Logical grouping of services and computes
- Ownership boundary

------------------------------------------------------------
OWNERSHIP (CRITICAL)
Collection: ownership
------------------------------------------------------------

Schema:
  {
    _id: ObjectId
    resourceType: "service" | "compute" | "project"
    resourceId: "svc_xxxxx" | "cmp_xxxxx" | "proj_xxxxx"
    ownerUserId: ObjectId
    role: "owner" | "admin"
    createdAt: ISODate
  }

Purpose:
- Fine-grained authorization
- RBAC enforcement

============================================================
2. RUNTIME JSON — PLATFORM STATE (RECONSTRUCTABLE CACHE)
============================================================

These files represent what the platform believes exists right now.
They are durable across restarts but NOT authoritative.

------------------------------------------------------------
SERVICES
File: runtime/services.json
------------------------------------------------------------

Schema:
  {
    services: [
      {
        id: "svc_xxxxx"
        projectId: "proj_xxxxx"
        name: string
        image: string
        containerName: string
        ip: string
        internalPort: number
        cpu: number
        memoryMb: number
        status: "running" | "stopped"
        createdAt: ISODate
        health: {
          status: "healthy" | "unhealthy" | "unknown"
          latencyMs: number
          lastCheckedAt: ISODate
          lastError: string | null
        }
      }
    ]
  }

Purpose:
- Nginx routing
- Health checks
- Dashboard state

------------------------------------------------------------
COMPUTES (VM-LIKE)
File: runtime/computes.json
------------------------------------------------------------

Schema:
  {
    computes: [
      {
        id: "cmp_xxxxx"
        projectId: "proj_xxxxx"
        containerName: string
        ip: string
        cpu: number
        memoryMb: number
        network: string
        username: string
        status: "running" | "stopped"
        createdAt: ISODate
      }
    ]
  }

Purpose:
- SSH access
- User-managed workloads
- Future VM replacement

------------------------------------------------------------
PROJECT CACHE (OPTIONAL)
File: runtime/projects.json
------------------------------------------------------------

Schema:
  {
    projects: [
      {
        id: "proj_xxxxx"
        name: string
        teamId: "team_xxxxx"
        createdBy: ObjectId
        createdAt: ISODate
      }
    ]
  }

Purpose:
- Fast UI access
- MongoDB remains authoritative

============================================================
3. DOCKER ENGINE — EXECUTION TRUTH
============================================================

Docker is the final authority on what actually exists and runs.
Platform state can be rebuilt from Docker metadata.

------------------------------------------------------------
CONTAINER LABELS (SERVICE)
------------------------------------------------------------

Labels:
  sensual.type = service
  sensual.serviceId = svc_xxxxx
  sensual.health.path = /health
  sensual.health.port = 3000

------------------------------------------------------------
CONTAINER LABELS (COMPUTE)
------------------------------------------------------------

Labels:
  sensual.type = compute
  sensual.computeId = cmp_xxxxx

Purpose:
- Runtime reconstruction
- Orphan detection
- Safe cleanup

============================================================
4. FILESYSTEM — ACCESS MATERIAL
============================================================

------------------------------------------------------------
SSH KEYS
Directory: ssh-keys/
------------------------------------------------------------

Layout:
  ssh-keys/
    swapnil
    swapnil.pub

Implicit schema:
  {
    username: string
    publicKey: string
    createdAt: filesystem timestamp
  }

Purpose:
- Secure compute access
- Must survive container rebuilds

============================================================
DATA NOT PERSISTED (BY DESIGN)
============================================================

- Logs (pulled from Docker on demand)
- Metrics (not implemented yet)
- Audit trail (planned)
- Deployment history (planned)
- Nginx config (fully derived from runtime)

============================================================
FINAL MENTAL MODEL
============================================================

MongoDB     -> Identity & permissions (truth)
runtime/    -> Platform memory (cache)
Docker      -> Execution reality (truth)
Filesystem  -> Access material