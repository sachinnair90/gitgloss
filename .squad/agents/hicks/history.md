# Project Context

- **Owner:** Sachin Nair
- **Project:** GitGloss — a Git-backed catalog/glossary system with a shadow cache, admin portal, three-tier auth, and social interactions layer
- **Stack:** Azure Functions (TypeScript), PostgreSQL (Neon/Cosmos DB), Prisma ORM, Zod, docker-compose for local Postgres
- **Key test areas:** Shadow cache state machine (pending→synced→failed), auth three-tier (guest/verified/admin), dual-write (Git + SQL atomicity), rate limiting (FingerprintJS + IP).
- **Created:** 2026-04-06

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->
