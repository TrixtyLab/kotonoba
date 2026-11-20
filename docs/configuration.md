# Kotonoba Configuration Guide

Comprehensive reference for every environment variable (`src/lib/config/env.ts` & `secrets.ts`), valid values, defaults, storage backends, AI assistant endpoints, link shortening, multi-tenant domain routing, and backups.

> **Startup Fail-Closed Behavior:** On Node.js server boot ([`src/instrumentation.ts`](../src/instrumentation.ts)), when `NODE_ENV=production` (outside `next build`), Kotonoba validates mandatory security keys immediately and refuses to start if `JWT_SECRET` or `ENCRYPTION_KEY` is missing, shorter than 32 characters, or identical to each other.

---

## 0. Complete Environment Variables Reference

### A. Core Server, Routing & Security Headers

| Variable | Allowed Values / Format | Default | Purpose |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | `"development"` \| `"production"` \| `"test"` | `"development"` (`"production"` in Docker) | Switches fail-closed secret checks, secure cookie flags (`httpOnly` + `Secure` in prod), CSP strictness (`unsafe-eval` allowed only in dev), and default `/app/data/*` paths. |
| `PORT` | TCP port string (`"1"`–`"65535"`) | `"3000"` | HTTP port bound by the Next.js server and healthcheck. |
| `HOSTNAME` | Hostname / IP (`"0.0.0.0"` in Docker, `"localhost"` locally) | `"0.0.0.0"` (container) / Next default | Interface address bound by the server. Avoid `127.0.0.1` with Next.js middleware rewrites on dev/standalone because `NextURL` normalizes `127.0.0.1` to `localhost`. |
| `APP_VERSION` | Arbitrary semver/build string (e.g. `"1.1.4"`) | Unset (falls back to `package.json` version) | Overrides the reported version string in [`/api/health`](../src/app/api/health/route.ts) and update status responses. |
| `SITE_URL` | Full `http://` or `https://` origin (e.g. `"https://blog.example.com"`) | `NEXT_PUBLIC_APP_URL` or `"http://localhost:3000"` | Canonical fallback base URL for metadata (`metadataBase`), feeds, and sitemaps when no site host override applies. |
| `NEXT_PUBLIC_APP_URL` | Full `http://` or `https://` origin | `"http://localhost:3000"` | Secondary fallback used by `getDefaultSiteUrl()` when `SITE_URL` is omitted. |
| `ADMIN_DOMAIN` | Hostname without scheme (e.g. `"admin.example.com"`) or empty | Unset (`null`) | Isolates admin/auth routes (`/admin`, `/login`, `/setup`): non-local requests to those paths on other domains redirect to `ADMIN_DOMAIN`. |
| `SINGLE_TENANT_FALLBACK` | `"true"` \| `"false"` | `"false"` | When `"true"`, unknown non-local `Host` headers fall back to the first site in SQLite. Keep `"false"` in multi-tenant production so unknown hosts fail closed (`404`). |
| `CSP_MODE` | `"report-only"` \| `"enforce"` | `"report-only"` | Emits `Content-Security-Policy-Report-Only` during staging rollout (`"report-only"`) or enforcing `Content-Security-Policy` with per-request nonces (`"enforce"`). |
| `TRUSTED_PROXY_IPS` | Comma-separated IPv4/IPv6 addresses or IPv4 CIDRs (e.g. `"172.18.0.0/16,10.0.0.5"`) | `""` | Reverse-proxy allowlist required before trusting `x-forwarded-for` / `x-forwarded-host`. When empty, `x-forwarded-for` is ignored to prevent client spoofing; rate limiting and analytics use only `x-real-ip`, which the bundled nginx config overwrites, plus `host`. Never expose the app port directly to the internet. |

---

### B. Authentication, Secrets & Key Rotation

| Variable | Allowed Values / Format | Default | Purpose |
| :--- | :--- | :--- | :--- |
| `JWT_SECRET` | Random string (**32+ chars**, **required in prod**) | Dev-only ephemeral fallback | Signs HS256 `access_token` and `refresh_token` cookies. Changing it invalidates active sessions globally. |
| `ENCRYPTION_KEY` | Random string (**32+ chars**, **must differ from `JWT_SECRET`**, **required in prod**) | Dev-only fallback | Dedicated AES-256-GCM key protecting stored DB secrets (Discord webhook URL, Bluesky app password, AI API key, S3/R2 secret key). |
| `ENCRYPTION_KEY_ID` | `1–16` chars (`[a-zA-Z0-9_-]`, e.g. `"k1"`, `"k2"`) | `"k1"` | Active key version tag stamped into `v2:<keyId>:...` ciphertexts for rotation tracking. |
| `ENCRYPTION_KEY_PREVIOUS` | Previous `ENCRYPTION_KEY` string (`32+` chars) | Unset | Secondary decryption key checked transparently during zero-downtime key rotation reads without breaking saved integrations. |
| `SESSION_DURATION` *(alias `JWT_EXPIRES_IN`)* | Duration string (`Ns`, `Nm`, `Nh`, `Nd`, `Nw`, `Ny`, e.g. `"7d"`, `"12h"`) | `"30d"` | Lifetime of the signed `access_token` cookie. |
| `REFRESH_DURATION` *(alias `REFRESH_EXPIRES_IN`)* | Duration string (`Ns`, `Nm`, `Nh`, `Nd`, `Nw`, `Ny`) | `"90d"` | Lifetime of the signed `refresh_token` cookie. |

---

### C. SQLite Persistence, Uploads & Quotas

| Variable | Allowed Values / Format | Default | Purpose |
| :--- | :--- | :--- | :--- |
| `DB_PATH` | Filesystem path to `.db` file | `/app/data/kotonoba.db` (prod) / `./data/blog.db` (dev) | Location of the SQLite WAL database (shared across `migrate.ts`, app queries, and `scripts/migrate-media-tenants.mjs`). |
| `UPLOAD_DIR` | Filesystem directory path | `/app/data/uploads` (prod) / `./data/uploads` (dev) | Root directory holding tenant-scoped uploads (`sites/<siteId>/...`) and pre-replace backup snapshots (`snapshots/<siteId>/...`). |
| `MAX_UPLOAD_SIZE` | Positive integer (bytes) | `10485760` (`10 MiB`) | Maximum allowed binary upload size per single raster image on `POST /api/upload`. |
| `MAX_SITE_STORAGE_BYTES` | Non-negative integer (bytes; `0` disables quota) | `524288000` (`500 MiB`) | Cumulative media storage quota per tenant (`sites/<siteId>/`). Uploads exceeding `usedBytes + size > quota` return HTTP `413`. |

---

### D. Encrypted Backups, Archival Limits & Host Scripts

| Variable | Allowed Values / Format | Default | Purpose |
| :--- | :--- | :--- | :--- |
| `BACKUP_ENCRYPTION_KEY` | **32 bytes** encoded as **64 hex chars** or **44-char base64** (**required for export/import**) | Unset (fails closed) | AES-256-GCM key encrypting/decrypting `.kotonoba-backup` archives (plus OpenSSL AES-256-CBC in `scripts/backup.sh` / `restore.sh`). Keep off-site escrow; loss makes backups unrecoverable. |
| `BACKUP_KEY_ID` | `1–32` chars (`[A-Za-z0-9._-]`, e.g. `"v1"`) | `"v1"` | Key identifier stamped inside `KOTONOBA-BACKUP-V1` file headers. |
| `ALLOW_LEGACY_BACKUP_IMPORT` | `"true"` \| `"false"` | `"false"` | Temporary migration flag permitting import of legacy unencrypted `.zip` archives. Keep `"false"` in normal operation. |
| `MAX_BACKUP_SIZE` | Positive integer (bytes) | `104857600` (`100 MiB`) | Maximum encrypted `.kotonoba-backup` upload payload accepted by `POST /api/backup/import`. |
| `MAX_BACKUP_FILES` | Positive integer | `5000` | Maximum ZIP entry count allowed inside an archive (zip-bomb defense). |
| `MAX_BACKUP_UNCOMPRESSED_BYTES` | Positive integer (bytes) | `524288000` (`500 MiB`) | Maximum cumulative decompressed bytes allowed across all ZIP entries. |
| `MAX_BACKUP_JSON_BYTES` | Positive integer (bytes) | `26214400` (`25 MiB`) | Maximum uncompressed size allowed for `data.json` inside a backup archive. |
| `BACKUP_DIR` *(host script only)* | Directory path | `./backups` | Output directory used by `scripts/backup.sh`. |
| `BACKUP_LOG_FILE` *(host script only)* | File path | `${BACKUP_DIR}/backup.log` | Audit log written by `scripts/backup.sh`. |
| `RETENTION_DAYS` *(host script only)* | Positive integer (days) | `30` | Prunes `.db.gz*` host backup snapshots older than this age in `scripts/backup.sh`. |
| `REQUIRE_ENCRYPTION` *(host script only)* | `"true"` \| `"false"` | `"true"` | Causes `scripts/backup.sh` to abort cleanly when `BACKUP_ENCRYPTION_KEY` is missing. |
| `BACKUP_INCLUDE_UPLOADS` *(host script only)* | `"true"` \| `"false"` | `"false"` | When `"true"`, `scripts/backup.sh` also archives local `UPLOAD_DIR` media files alongside the SQLite snapshot. |
| `CONTAINER_NAME` *(host script only)* | Docker container name | Auto (`blog-app-blue`, `blog-app-green`, or `kotonoba`) | Overrides auto-detected Docker container targeted by `scripts/backup.sh`. |

---

### E. Scheduled Publishing Cron & Analytics Retention

| Variable | Allowed Values / Format | Default | Purpose |
| :--- | :--- | :--- | :--- |
| `CRON_SECRET` | Random bearer token string (`16+` recommended) | Unset (`null`) | Required as `Authorization: Bearer <CRON_SECRET>` by `POST /api/cron/publish` (used by the Compose `scheduler` service). Unconfigured prod requests without a `super_admin` session fail closed with HTTP `503`. |
| `ANALYTICS_RETENTION_DAYS` | Non-negative integer (days; `0` disables pruning) | `365` | Deletes raw `analytics` rows older than this threshold during cron runs after summarizing counts into `analytics_daily` via `aggregateDailyAnalytics()`. |

---

### F. External Object Storage, Link Shortening & Compose Image

| Variable | Allowed Values / Format | Default | Purpose |
| :--- | :--- | :--- | :--- |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` | Cloudflare R2 credentials & optional CDN base URL | `""` | Environment fallback configuring Cloudflare R2 when DB storage settings are unset (`R2_ACCOUNT_ID` is masked cleanly on UI reads). |
| `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` | AWS S3 / MinIO / Spaces credentials (`"us-east-1"` or `"auto"`) | `""` (`AWS_REGION="auto"` in `.env.example`, `"us-east-1"` S3 fallback) | Environment fallback configuring generic S3-compatible buckets when R2 is not configured. |
| `DUB_API_KEY`, `DUB_DOMAIN` | Dub.co API token & custom link domain | `""` / `"dub.sh"` | Enables short-link & QR generation (`POST` Dub panel) on articles. |
| `KOTONOBA_IMAGE`, `IMAGE_TAG` *(Compose only)* | Container image & SemVer tag | `ghcr.io/trixtylab/kotonoba` / `latest` | Selects the container image deployed by [`docker-compose.prod.yml`](../docker-compose.prod.yml) and `scripts/deploy.sh`. |

---

## 1. Storage Providers Configuration & Private Buckets

Kotonoba supports three primary storage backends for uploaded media and post images:

### A. Local Filesystem (Default)
Stores media files directly in the persistent volume.
- **Environment Variable:** `UPLOAD_DIR=/app/data/uploads` (Production) or `./data/uploads` (Development).
- **Public URL:** Streamed securely via `/api/uploads/[...path]`.

### B. Cloudflare R2 (Public or 100% Private Buckets)
High-performance S3-compatible object storage with zero egress fees.
- **Private Buckets (Direct Server-Side Streaming):** Full native support for completely private R2 buckets without issuing `307` redirects or exposing bucket/presigned URLs. Requests under `/api/uploads/[...path]` stay on your site domain and stream media directly from R2 with immutable caching and security headers.
- **Configuration via UI:** Navigate to `/admin/settings/storage`, select **Cloudflare R2**, and input:
  - **Account ID:** Cloudflare Account ID.
  - **Access Key ID:** R2 API Token Access Key.
  - **Secret Access Key:** R2 API Token Secret.
  - **Bucket Name:** Name of your R2 bucket.
  - **Public URL:** *(Optional)* Custom CDN domain (e.g. `https://media.myblog.com`). If left blank, uploaded asset URLs stay under `/api/uploads/...` and are streamed securely by Kotonoba's internal storage proxy.
- **Configuration via `.env`:**
  ```env
  R2_ACCOUNT_ID=your_cloudflare_account_id
  R2_ACCESS_KEY_ID=your_access_key
  R2_SECRET_ACCESS_KEY=your_secret_key
  R2_BUCKET_NAME=your_bucket_name
  R2_PUBLIC_URL=https://media.myblog.com # Optional
  ```

### C. Amazon S3 / S3-Compatible (MinIO, DigitalOcean Spaces, Wasabi)
- **Configuration via UI / `.env`:**
  ```env
  AWS_ACCESS_KEY_ID=your_aws_key
  AWS_SECRET_ACCESS_KEY=your_aws_secret
  S3_BUCKET=your_s3_bucket
  AWS_REGION=us-east-1
  ```

---

## 2. OpenAI-Compatible AI Assistant

The AI Assistant integration powers:
1. **Automated SEO Excerpts** (`generateExcerptAction`)
2. **Text Improvement & Rewriting** (`rewriteAction`)
3. **Multi-Language Translation** (`translateAction`)

### Setup in Admin Settings (`/admin/settings/ai`):
- **Provider / Endpoint:** `https://api.openai.com/v1` (or local endpoints like `http://localhost:11434/v1` for Ollama, `http://localhost:1234/v1` for LM Studio, `https://api.groq.com/openai/v1`, `https://openrouter.ai/api/v1`).
- **API Key:** Encrypted at rest in SQLite using AES-256-GCM.
- **Model ID:** Default `gpt-4o-mini` (or `llama3`, `mistral`, `claude-3-5-sonnet`, `deepseek-chat`).

---

## 3. Dub.co Branded Link Shortener

Integrates with [Dub.co](https://dub.co) for custom short links and analytics.

- **Environment Variables:**
  ```env
  DUB_API_KEY=dub_xxxxxxxxxxxxxxxxxxxx
  DUB_DOMAIN=dub.sh
  ```
- **Capabilities:**
  - Automatic short URL generation on post publication.
  - Vector QR code generation modal.
  - Click tracking and UTM parameter builder in editor.

---

## 4. Multi-Tenant Domain Routing & Dashboard Isolation

To map multiple isolated blogs to custom domains:

1. In DNS, point CNAME or A records to your server IP.
2. In Kotonoba (`/admin/sites`), create a new site record and set the **Domain** field to the hostname (e.g. `blog.company.com`).
3. Kotonoba automatically routes incoming traffic on `blog.company.com` to that specific blog.
4. **Dashboard Redirection (`ADMIN_DOMAIN`):** If you run your management panel on a dedicated subdomain (e.g. `blog-dashboard.example.com`) or root domain, any requests to public blog paths on that domain are automatically redirected to `/[locale]/admin`, keeping public blog content restricted only to designated blog domains.

---

## 5. SEO, Anti-AI Crawling Policy & LLMs Manifest

### A. Search Engine Directives (`/robots.txt` & `/sitemap.xml`)
- **`/sitemap.xml`:** Generated dynamically with multi-language `xhtml:link` alternates.
- **`/robots.txt`:** Standard crawling rules allowing public blog sections while protecting `/admin/`, `/api/`, and `/setup/`.

### B. Anti-AI Crawling & Scraping Policy (`block_ai_crawlers`)
Kotonoba includes a built-in Anti-AI privacy protection toggle in `/admin/settings/seo`:
- **Robots Disallow Directives:** Explicitly disallows major AI training bots and web scrapers (`GPTBot`, `ChatGPT-User`, `ClaudeBot`, `Claude-Web`, `anthropic-ai`, `Google-Extended`, `CCBot`, `PerplexityBot`, `Bytespider`, `Diffbot`, `FacebookBot`, `cohere-ai`, `Omgilibot`, `ImagesiftBot`).
- **Standard Metadata:** Injects `<meta name="robots" content="noai, noimageai" />` and the W3C `<meta name="tdm-reservation" content="1" />` (Text and Data Mining reservation) into public blog pages.
- **LLM Suppression:** Automatically forces `/llms.txt` and `/llms-full.txt` to return HTTP 404 (Not Found).

### C. AI Search Engine Indexing (`/llms.txt` & `/llms-full.txt`)
- **Disabled by Default:** LLM manifests are disabled out of the box.
- **Opt-in Indexing:** Can be enabled in `/admin/settings/seo` if you wish to allow AI engines (ChatGPT, Claude, Perplexity) to index and cite your blog posts. Custom system instructions for AI models can also be configured.

---

## 6. Content Integrations & Syndication (`/admin/settings/integrations`)

### A. Discord Webhooks
Automatically shares newly published articles to your Discord community:
- **Enable Notifications:** Toggle on/off per blog site.
- **Webhook URL:** Paste standard Discord webhook URL (`https://discord.com/api/webhooks/...`).
- **Bot Customization:** Custom username and avatar overrides (defaults to site name and logo).
- **Embed Styling:** Primary brand color, linked title, excerpt, full cover hero image, and formatted timestamp footer.
- **Testing:** "Send Test Message" button to verify webhook functionality in real time.

### B. RSS 2.0 & Atom Feeds
- **Public Feed URL:** `https://<your-blog-domain>/feed.xml` or `/rss.xml`.
- **Feed Customization:** Control item limit (10, 20, 50, 100) and choose between full HTML formatted content or brief summary excerpts.
- **Auto-Discovery:** Automatically injected into `<head>` metadata for RSS readers and browser extensions.

