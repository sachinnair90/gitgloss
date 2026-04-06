# Project Context

- **Owner:** Sachin Nair
- **Project:** GitGloss — a Git-backed catalog/glossary system with a shadow cache, admin portal, three-tier auth, and social interactions layer
- **Stack:** Azure Static Web Apps (frontend), Azure Functions (API), PostgreSQL (Neon free tier / Cosmos DB for Postgres), GitHub Actions CI/CD
- **Infrastructure decisions:** $0 cost target is a capability proof, not a hard requirement. Neon free tier for Postgres. Standard Postgres API for portability (can move to any Postgres host). Secrets in Azure App Settings only.
- **Created:** 2026-04-06

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->
