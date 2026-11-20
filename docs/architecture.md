# Kotonoba Architecture & Design Decisions

Overview of Kotonoba's multi-tenant architecture, layer boundaries, content model, authentication/cryptography separation, scaling limits, and Architecture Decision Records (ADRs).

---

## 1. Layering & Import Boundaries

Kotonoba separates web routing, UI components, thin Server Action adapters, domain logic, and persistence cleanly (enforced by [`eslint.config.mjs`](../eslint.config.mjs) and `knip`):

```text
src/app/** (Pages, Route Handlers, Metadata, Feeds)
  ├─> src/actions/** (Thin Server Actions: authz + Zod + service call + revalidation)
  └─> src/components/** (UI primitives & Admin/Blog client workspaces)

src/actions/**
  └─> src/lib/services/** & src/lib/contracts/** (never direct Drizzle/SQLite)

src/lib/**
  └─> src/lib/db/**, src/lib/security/**, src/lib/storage/** (never imports from src/app or src/components)
```

Key architectural modules:

- **Request security proxy (`src/proxy.ts`):** Validates HS256 JWTs on `/admin` (never trusting raw cookie presence alone), isolates `ADMIN_DOMAIN`, enforces per-request CSP nonces + security headers (`src/lib/security/headers.ts`), and injects `x-request-id` correlation headers.
- **Tenant resolution (`src/lib/tenant.ts` & `src/lib/auth/site-access.ts`):**
  - `getPublicSite()`: Resolves the public blog strictly from validated request `Host` / trusted `X-Forwarded-Host`, failing closed (`null` -> 404) when unknown unless `SINGLE_TENANT_FALLBACK=true`.
  - `getAdminSite()`: Validates session membership (`super_admin` or assigned `user.siteId`) against SQLite before honoring `kotonoba_admin_site_id`.
- **Canonical content & XSS defense (`src/lib/content/canonical.ts` & `src/lib/security/sanitize.ts`):** Normalizes media URLs, detects `"html"` vs `"markdown"`, sanitizes HTML with `sanitize-html` on write AND before render (`SafeHtml`, `SafeSvg`), and renders Mermaid diagrams under `securityLevel: "strict"` + DOMPurify SVG sanitization.
- **Database & migrations (`src/lib/db/index.ts`, `schema.ts`, `migrate.ts`):** SQLite configured in `WAL` mode with `foreign_keys = ON` and `busy_timeout = 5000`. Unique composite indexes enforce tenant isolation on `(siteId, slug)` across posts, pages, categories, and tags, as well as `(siteId, key)` on settings and deduplicated join tables.

---

## 2. Scaling Ceiling & PostgreSQL Migration Path

### Current SQLite Operational Envelope
- **Single-writer SQLite WAL:** Optimal for single-node Docker deployments serving one or more low-to-medium write-volume blogs on a persistent volume (`/app/data/kotonoba.db`).
- **Scheduled writes off hot render paths:** Public SSR pages never run background DB mutations; scheduled publishing, outbox webhook retries, daily analytics aggregation (`analytics_daily`), and retention pruning execute only via `POST /api/cron/publish`.
- **Batch reads without N+1:** Public feeds and listings hydrate categories/tags in two batch `inArray` queries (`src/lib/queries/public-posts.ts`).

### Migrating to PostgreSQL (Future Multi-Replica Scale)
All SQL queries are isolated in `src/lib/services/*`, `src/lib/queries/*`, and `src/lib/db/*` (Server Actions and UI components never access `better-sqlite3` directly):
1. Swap the Drizzle client in `src/lib/db/index.ts` and table definitions in `src/lib/db/schema.ts` from `drizzle-orm/sqlite-core` / `better-sqlite3` to `drizzle-orm/node-postgres` / `pg`.
2. Replace `src/lib/security/rate-limit.ts` in-memory `Map` counters with a shared store (e.g. Redis) if running multiple stateless app replicas.
3. Keep `R2`/`S3` object storage enabled so uploaded media is shared across instances (`sites/<siteId>/...`), served via `/api/uploads/*`.

---

## 3. Architecture Decision Records (ADRs)

### ADR-001: Supported Locales (`en` / `es`) & Single-Locale Content
- **Decision:** Interface UI and published articles/pages support strictly `en` and `es` (`SUPPORTED_LOCALES` in `src/i18n/routing.ts`). Every post or custom page owns a single `locale` column without linked bilingual translation variants.
- **Rationale:** Matches verified UI translations (`messages/en.json`, `messages/es.json`), ensures `/sitemap.xml` `hreflang` alternates never point to non-existent localized URLs, and rejects unsupported locales at Zod contract boundaries.

### ADR-002: Key Separation (`JWT_SECRET`, `ENCRYPTION_KEY`, `BACKUP_ENCRYPTION_KEY`)
- **Decision:** Session signing (`JWT_SECRET`), DB secret encryption (`ENCRYPTION_KEY` + `ENCRYPTION_KEY_ID` + `ENCRYPTION_KEY_PREVIOUS`), and archive backups (`BACKUP_ENCRYPTION_KEY` + `BACKUP_KEY_ID`) require distinct keys validated fail-closed on production boot (`src/instrumentation.ts`).
- **Rationale:** Rotating session secrets does not break encrypted integration credentials (`v2:<keyId>:...`), and leaked session cookies cannot decrypt integration credentials or offline backups.

### ADR-003: Proxy-Only Media Serving for R2/S3 & Local Storage (`/api/uploads/*`)
- **Decision:** `/api/uploads/[...path]` (`src/app/api/uploads/[...path]/route.ts`) and `/api/favicon` stream media directly through `readStoredMediaObject()` (`src/lib/storage/index.ts`) instead of issuing HTTP `307` redirects to S3/R2 presigned or bucket URLs.
- **Rationale:** Keeps shareable URLs stable under `https://<site-domain>/api/uploads/sites/<siteId>/...`, prevents leaking internal bucket hosts or expiring presigned URLs, enforces strict allowlisted `Content-Type` / `nosniff` / SVG CSP sandbox headers, and validates path containment across both R2/S3 and local disk.

### ADR-004: Encrypted Transactional Backups (`KOTONOBA-BACKUP-V1`)
- **Decision:** All exported backups are encrypted server-side with AES-256-GCM (`KOTONOBA-BACKUP-V1` header + SHA-256 `data.json` manifest) and authorized strictly per site (`admin` for own site, `super_admin` for any site with audit logging).
- **Rationale:** Legacy unencrypted `.zip` imports remain disabled by default (`ALLOW_LEGACY_BACKUP_IMPORT=false`). Imports stream zip entries into staging directories enforcing decompression caps (`MAX_BACKUP_SIZE`, `MAX_BACKUP_FILES`, `MAX_BACKUP_UNCOMPRESSED_BYTES`, `MAX_BACKUP_JSON_BYTES`), rewrite SQLite state in a single transaction, and roll back staged media if the transaction fails.

### ADR-005: External Cron Trigger + Transactional Notification Outbox
- **Decision:** Publishing due scheduled posts, Discord embeds, and Bluesky posts is triggered exclusively by `POST /api/cron/publish` (via Docker Compose `scheduler` or host cron) rather than inside page renders.
- **Rationale:** Eliminates database write contention during public page reads and guarantees idempotent once-only delivery per `(postId, channel)` via `notification_outbox`.
