# Work Routing

How to decide who handles what.

## Routing Table

| Work Type | Route To | Examples |
|-----------|----------|----------|
| Architecture, hexagonal ports, design proposals | Dallas | Port/adapter design, API contracts, tech debt triage |
| Astro components, search UI, admin portal | Lambert | Content collections, Fuse.js, WYSIWYG editor, image pipeline |
| Azure Functions, Prisma, REST APIs | Parker | Item CRUD, shadow cache, GitHub API write-back, auth adapter |
| Frontend tests, Playwright, Astro component tests | Vasquez | E2E flows, URL state persistence, accessibility |
| Backend tests, API integration, DB fixtures | Hicks | Azure Function tests, shadow cache state machine, auth flows |
| Deployment, CI/CD, infra, secrets | Bishop | Azure SWA config, GitHub Actions, Postgres provisioning |
| Code review | Dallas | Review PRs, check quality, enforce hexagonal contracts |
| Scope & priorities | Dallas | What to build next, trade-offs, decisions |
| Session logging | Scribe | Automatic — never needs routing |

## Issue Routing

| Label | Action | Who |
|-------|--------|-----|
| `squad:dallas` | Architecture / scope / review | Dallas |
| `squad:lambert` | Frontend / UI / Astro | Lambert |
| `squad:parker` | Backend / API / database | Parker |
| `squad:vasquez` | Frontend testing / Playwright | Vasquez |
| `squad:hicks` | Backend testing / integration | Hicks |
| `squad:bishop` | DevOps / infra / deployment | Bishop |
| `squad` | Triage: analyze issue, assign `squad:{member}` label | Lead |
| `squad:{name}` | Pick up issue and complete the work | Named member |

### How Issue Assignment Works

1. When a GitHub issue gets the `squad` label, the **Lead** triages it — analyzing content, assigning the right `squad:{member}` label, and commenting with triage notes.
2. When a `squad:{member}` label is applied, that member picks up the issue in their next session.
3. Members can reassign by removing their label and adding another member's label.
4. The `squad` label is the "inbox" — untriaged issues waiting for Lead review.

## Rules

1. **Eager by default** — spawn all agents who could usefully start work, including anticipatory downstream work.
2. **Scribe always runs** after substantial work, always as `mode: "background"`. Never blocks.
3. **Quick facts → coordinator answers directly.** Don't spawn an agent for "what port does the server run on?"
4. **When two agents could handle it**, pick the one whose domain is the primary concern.
5. **"Team, ..." → fan-out.** Spawn all relevant agents in parallel as `mode: "background"`.
6. **Anticipate downstream work.** If a feature is being built, spawn the tester to write test cases from requirements simultaneously.
7. **Issue-labeled work** — when a `squad:{member}` label is applied to an issue, route to that member. The Lead handles all `squad` (base label) triage.
