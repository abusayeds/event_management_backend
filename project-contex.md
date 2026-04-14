# Project Context

## Project Name
Dawabuyi Event Management Backend

## Goal
Provide a scalable backend for event management workflows with secure authentication, user management, notification delivery, queue processing, and optional real-time socket communication.

## Main Stack
- Node.js + TypeScript
- Express.js
- Prisma + PostgreSQL
- Redis + BullMQ
- Socket.IO
- Swagger

## Current Architecture
- Modular feature folders in src/modules
- Config-driven startup in src/server.ts and src/config
- Shared interfaces, middleware, and utility layers
- Jobs and workers for background processing

## Development Commands
- pnpm dev
- pnpm typecheck
- pnpm build
- pnpm test

## Notes
- Socket can be toggled by environment config.
- Redis is configured for local usage.
- Product module has been removed from routing and schema.
