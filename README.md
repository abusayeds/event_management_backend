# Dawabuyi Event Management Backend

Backend API for event management workflows, user authentication, real-time notifications, and background job processing.

## Project Identity

- Project: Dawabuyi Event Management Backend
- Type: REST API + Real-time services
- Runtime: Node.js + TypeScript
- Architecture: Modular monolith (feature-based)

## Technologies (with images)

![Node.js](https://img.shields.io/badge/Node.js-5FA04E?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?logo=express&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?logo=redis&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?logo=socket.io&logoColor=white)
![BullMQ](https://img.shields.io/badge/BullMQ-EA580C?logo=redis&logoColor=white)
![Swagger](https://img.shields.io/badge/Swagger-85EA2D?logo=swagger&logoColor=black)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)

## Core Features

- JWT authentication with access and refresh token flow
- Role-based access control (ADMIN, MANAGER, USER)
- User and notification management modules
- Redis cache + BullMQ queue integration
- Optional Socket.IO initialization via environment toggle
- Email verification and reset flow with Nodemailer
- API documentation with Swagger/OpenAPI

## Project Structure

```text
dawabuyi-backend/
├── docker-compose.dev.yml
├── docker-compose.yml
├── Dockerfile
├── Dockerfile.dev
├── eslint.config.cjs
├── package.json
├── pnpm-lock.yaml
├── prisma.config.ts
├── README.md
├── tsconfig.json
├── assets/
├── docs/
│   ├── API.md
│   └── DEPLOYMENT.md
├── logs/
│   ├── errors/
│   └── success/
├── prisma/
│   ├── generated/
│   │   ├── browser.ts
│   │   ├── client.ts
│   │   ├── commonInputTypes.ts
│   │   ├── enums.ts
│   │   ├── models.ts
│   │   ├── internal/
│   │   └── models/
│   └── schema/
│       ├── schema.prisma   // generator + datasource
│       ├── enums.prisma
│       ├── user.prisma
│       ├── catalog.prisma
│       ├── family.prisma
│       └── event.prisma
├── scripts/
│   ├── build.sh
│   ├── deploy.sh
│   ├── kill-port-before-dev.js
│   ├── log-rotation.sh
│   └── seed.sh
├── src/
│   ├── app.ts
│   ├── server.ts
│   ├── cache/
│   ├── config/
│   ├── interfaces/
│   ├── jobs/
│   │   ├── processors/
│   │   ├── queues/
│   │   └── workers/
│   ├── middleware/
│   ├── modules/
│   │   ├── auth/
│   │   ├── notification/
│   │   └── user/
│   ├── routes/
│   ├── socket/
│   │   ├── handlers/
│   │   ├── constants.ts
│   │   ├── index.ts
│   │   ├── socket.events.ts
│   │   └── socket.handler.ts
│   ├── utils/
│   └── temp/
└── tests/
    ├── setup.ts
    ├── integration/
    └── unit/
```

## API Modules

- Auth: `/api/auth/*`
- User: `/api/users/*`
- Notification: `/api/notifications/*`
- Health: `/api/health`

## Environment Variables

See `.env.example` and configure at least:

- `DATABASE_URL`
- `PORT`, `NODE_ENV`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` (or `REDIS_URL`)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `EMAIL_FROM`
- `SOCKET_ENABLED`

## Quick Start

```bash
npm install
npm run prisma:generate
npm run dev
```

## Useful Commands

```bash
npm run dev
npm run build
npm run start
npm run typecheck
npm run lint
npm run test
```

## API Docs

- Swagger UI: `http://localhost:2001/api-docs`
- OpenAPI JSON: `http://localhost:2001/api-docs.json`
