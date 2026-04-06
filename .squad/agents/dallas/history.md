# Project Context

- **Owner:** Sachin Nair
- **Project:** GitGloss — a Git-backed catalog/glossary system with a shadow cache, admin portal, three-tier auth, and social interactions layer
- **Stack:** Astro, TypeScript, Azure Static Web Apps, Azure Functions, PostgreSQL (Neon free tier / Cosmos DB for Postgres), Prisma ORM, Fuse.js, Zod, FingerprintJS
- **Architecture:** Hexagonal (ports & adapters). AuthPort is the canonical example. Static catalog in Git + ShadowCache SQL dual-write for immediacy. TTL-based cleanup via Azure Function timer trigger.
- **Created:** 2026-04-06

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->
