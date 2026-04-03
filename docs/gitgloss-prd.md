# Product Requirements Document: The Agnostic Catalog

## 1. Product Vision & Goals

To provide a production-grade, infinitely portable catalog system that uses Git as a primary database.

- **Cost Efficiency:** Maintain $0.00 infrastructure cost using free-tier cloud resources.
- **Portability:** Zero code changes required to move between Azure, AWS, and private clouds.
- **Performance:** Sub-100ms interaction for searching and sub-2s for page navigation.

## 2. System Architecture & Data Flow

The system follows a Hexagonal Architecture (Ports and Adapters). The "Core" contains the business logic, while "Adapters" handle specific infrastructure like the GitHub API or Postgres.

### 2.1 The Hybrid Content Loop

To solve the 90-second Git build delay, the application uses a Shadow Cache logic:

1. **Submission:** The Admin Form sends data to an API endpoint.
2. **Dual-Write:** The API writes the `.md` file to GitHub and a JSON record to the SQL (Postgres) database.
3. **Client-Side Merge:** On the home page, the app fetches the static catalog (cached) and any items in the SQL DB marked as `status: 'pending_build'`.
4. **Reconciliation:** Once the GitHub Action finishes the build, the static site is updated. The SQL record is then either deleted or ignored based on a timestamp comparison.

## 3. Functional Requirements

### 3.1 Discovery & Navigation

- **Client-Side Indexing:** On build, the system generates a `search.json` file. The frontend uses Fuse.js to perform fuzzy searches against this index.
- **URL State Persistence:** All filters (tags, categories) must be mirrored in the URL query parameters (e.g., `?tags=vintage&sort=popular`). This allows users to share specific filtered views.
- **Responsive Grid:** A mobile-first masonry or CSS grid layout for item cards.

### 3.2 The Social Layer (Interactions)

- **Stateless Likes ❤️:** Liking an item uses a POST request to an Azure Function/Node API. To prevent spam without a full login, we use a combination of FingerprintJS (client-side ID) and IP Rate Limiting on the server.
- **Custom Comments:** Comments are stored in the SQL DB.
  - **Verified Users** (GitHub/Microsoft Login): Comments go live immediately.
  - **Guest Users:** Comments are stored with `is_approved: false` until an admin toggles them in the dashboard.

### 3.3 The Content Engine (Admin Portal)

- **WYSIWYG Editor:** Integration of an editor like Milkdown or Editor.js that outputs clean Markdown.
- **Image Pipeline:**
  - **Input:** User selects a 5MB JPEG.
  - **Process:** Browser-side Canvas API resizes to max-width 1200px and converts to WebP.
  - **Output:** Base64 string sent to API, then committed to Git `/public/images/`.

## 4. Technical Specifications & Data Schema

### 4.1 SQL Database (PostgreSQL)

| Table        | Column      | Type        | Description                        |
| ------------ | ----------- | ----------- | ---------------------------------- |
| Interactions | item_slug   | String (PK) | The filename of the MD file.       |
|              | count       | Integer     | Total likes. ❤️                     |
| Comments     | id          | UUID (PK)   | Unique identifier.                 |
|              | item_slug   | String (FK) | Links to the catalog item.         |
|              | author      | String      | User display name.                 |
|              | body        | Text        | The comment content.               |
|              | is_approved | Boolean     | Moderation toggle.                 |
| ShadowCache  | slug        | String      | Temporary storage for new items.   |
|              | payload     | JSONB       | Full content of the new item.      |

### 4.2 Markdown Frontmatter (Zod Schema)

```typescript
const ItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(3),
  description: z.string().max(160),
  tags: z.array(z.string()),
  image: z.string().url(),
  date: z.date(),
  featured: z.boolean().default(false),
});
```

## 5. Non-Functional Requirements

### 5.1 Security

- **Secret Management:** GitHub Personal Access Tokens (PAT) and Database connection strings must never be in the frontend. They are stored in Azure Environment Variables (App Settings).
- **CORS Policy:** The API must only accept requests from the primary domain.

### 5.2 Performance (The "100ms Rule")

Lighthouse Scores:

- **Performance:** 95+
- **SEO:** 100
- **Accessibility:** 100

**Image Optimization:** Use Astro Image or Next/Image to serve responsive sizes (`srcset`) to mobile devices automatically.

### 5.3 Portability (The Exit Strategy)

**Infrastructure as Code (IaC):** Provide a `docker-compose.yml` that spins up a Postgres DB and the Node.js app locally. This ensures that if Azure disappears, the app can be "Lifted and Shifted" to a $5 Linux server in minutes.

## 6. Implementation Roadmap

### Phase 1: The Static Foundation

- Setup Astro with Git-based content collections.
- Build the search and filter UI.
- Deploy to Azure Static Web Apps.

### Phase 2: The Logic Bridge

- Create the Azure Function for the "Add Item" form.
- Implement the GitHub API write-back logic.
- Setup Prisma ORM with Cosmos DB for Postgres.

### Phase 3: The Social Layer

- Build the like ❤️ and comment components.
- Add the "Shadow Cache" merge logic to the frontend.
- Enable Azure SWA Authentication for Admins.

### Phase 4: Polish & Agnostic Prep

- Implement Zod validation for all inputs.
- Setup a "Moderation Dashboard" for comments.
- Create a Dockerfile for vendor-independent deployment.

## 7. Success Metrics

| Metric                | Target                                   |
| --------------------- | ---------------------------------------- |
| Infrastructure Spend  | $0.00 / month                            |
| Deployment Time       | < 2 minutes from "Save" to "Live"        |
| Interaction Latency   | Like ❤️ reflects in the UI in < 200ms     |

---

