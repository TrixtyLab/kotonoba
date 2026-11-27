# Docker Deployment & Operations Guide

Complete reference for deploying **Kotonoba** as a single container, with an optional reverse proxy in front.

---

## 1. Quickstart (Single Instance)

Run Kotonoba with a single Docker Compose file:

```bash
docker compose up -d
```

Access the site at `http://localhost:3000`. On first visit, the initial setup wizard will guide you through creating your master admin account and configuring your primary blog.

### `docker-compose.yml`

```yaml
services:
  kotonoba:
    image: ghcr.io/trixtylab/kotonoba:latest
    container_name: kotonoba
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DB_PATH=/app/data/kotonoba.db
      - UPLOAD_DIR=/app/data/uploads
      - JWT_SECRET=${JWT_SECRET:?Set JWT_SECRET (32+ chars)}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY:?Set ENCRYPTION_KEY (32+ chars)}
      - BACKUP_ENCRYPTION_KEY=${BACKUP_ENCRYPTION_KEY:-}
      - CSP_MODE=${CSP_MODE:-report-only}
      - SITE_URL=https://yourdomain.com
      - ADMIN_DOMAIN=blog-dashboard.yourdomain.com # Optional: redirects non-blog requests to /admin
    volumes:
      - kotonoba_data:/app/data
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://127.0.0.1:3000/api/health"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 30s

volumes:
  kotonoba_data:
    driver: local
```

---

## 2. Optional Reverse Proxy

`docker compose up -d` publishes the app on port `3000`. TLS, HTTP redirects, and extra hostnames belong to a proxy you run yourself. The files under [`nginx/`](../nginx) are snippets for that proxy. Compose does not start nginx.

Point the proxy at the single upstream in [`nginx/conf.d/upstream.conf`](../nginx/conf.d/upstream.conf):

```nginx
upstream blog_backend {
    server kotonoba:3000;
}
```

Copy the snippets you need (`proxy-headers.conf`, `security-headers.conf`, `cloudflare-real-ip.conf`) into the proxy `http` or `server` block. Certificate files, if you use the sample server block, are `fullchain.pem` and `privkey.pem`. Scheduled publishing is an external call to `POST /api/cron/publish` with `CRON_SECRET`. Roll back a bad release by restoring the database with [`scripts/restore.sh`](../scripts/restore.sh) and starting the previous image with `docker compose up -d`.

---

## 3. Environment Variables Reference

| Variable | Default in Container | Description |
| :--- | :--- | :--- |
| `DB_PATH` | `/app/data/kotonoba.db` | Absolute path to SQLite database file |
| `UPLOAD_DIR` | `/app/data/uploads` | Directory for image and media uploads |
| `JWT_SECRET` | *(Required)* | 32+ character secret strictly for signing session JWTs |
| `ENCRYPTION_KEY` | *(Required)* | Dedicated 32+ character key for encrypting stored third-party secrets |
| `ENCRYPTION_KEY_ID` | `k1` | Key identifier stamped onto encrypted payloads (`v2:<keyId>:...`) |
| `BACKUP_ENCRYPTION_KEY` | *(Required)* | 32-byte key (64 hex chars or base64) encrypting backups and host snapshots |
| `CRON_SECRET` | `""` | Bearer token required by `POST /api/cron/publish` |
| `CSP_MODE` | `report-only` | Content Security Policy mode (`report-only` or `enforce`) |
| `TRUSTED_PROXY_IPS` | `""` | Comma-separated reverse-proxy IPs/CIDRs trusted for forwarded headers |
| `MAX_SITE_STORAGE_BYTES` | `524288000` | Per-tenant upload quota in bytes (default 500 MB; `0` disables) |
| `ANALYTICS_RETENTION_DAYS` | `365` | Raw hit retention window before daily rollup pruning (`0` disables) |
| `SITE_URL` | `http://localhost:3000` | Canonical URL for sitemaps and OpenGraph |
| `ADMIN_DOMAIN` | `""` | Optional dashboard domain (e.g. `blog-dashboard.example.com`) |
| `NODE_ENV` | `production` | Node execution environment |
| `PORT` | `3000` | Port the Next.js process listens on |
| `HOSTNAME` | `0.0.0.0` | Bind host address |
| `R2_ACCOUNT_ID` | `""` | Cloudflare Account ID for private/public R2 buckets |
| `R2_ACCESS_KEY_ID` | `""` | R2 API Token Access Key |
| `R2_SECRET_ACCESS_KEY` | `""` | R2 API Token Secret |
| `R2_BUCKET_NAME` | `""` | Target Cloudflare R2 bucket name |
| `R2_PUBLIC_URL` | `""` | Optional custom CDN domain |

> [!NOTE]
> Storage and AI configurations can also be configured directly via the **Admin Settings UI** (`/admin/settings/*`) and are stored securely in SQLite with AES-256 encryption.
> TLS is terminated by your reverse proxy when you put one in front of the container. The Compose file publishes port `3000` only. Nginx snippets under [`nginx/`](../nginx) are optional and are not started by Compose.

---

## 4. Persistent Storage & Backups

All database records, site configurations, and uploaded media reside in the shared volume `/app/data`:

- `/app/data/kotonoba.db`: SQLite database in WAL (Write-Ahead Logging) mode.
- `/app/data/uploads/`: Uploaded images and media.

### Online Atomic Encrypted Backup & Restore

Execute an online snapshot verified via `PRAGMA integrity_check` without locking readers:

```bash
chmod +x scripts/backup.sh scripts/restore.sh
BACKUP_ENCRYPTION_KEY=your-backup-key ./scripts/backup.sh
```

Backups are encrypted as `./backups/blog_backup_YYYYMMDD_HHMMSS.db.gz.enc` alongside a `.sha256` checksum and rotated with a 30-day retention window (`RETENTION_DAYS`). See [`docs/operations.md`](./operations.md) for restoration via `scripts/restore.sh` and legacy media tenant migration (`scripts/migrate-media-tenants.mjs`).

> [!IMPORTANT]
> `scripts/backup.sh` produces an AES-256-CBC `.db.gz.enc` snapshot for CLI disaster recovery. It is **not** the same format as the AES-256-GCM `.kotonoba-backup` archives exported from the admin UI, and it cannot be imported through `/api/backup/import`.

---

## 5. Multi-Tenant Domain Configuration

To route multiple domains/subdomains to separate blogs hosted on the same instance:

1. Point your DNS A/CNAME records (e.g. `blog.company.com`, `tech.domain.org`) to your Docker host IP.
2. In the Admin Dashboard (`/admin/sites`), create a new blog instance and set the **Domain** field to match the host header.
3. Kotonoba automatically routes incoming traffic to that specific blog. If visiting an unassigned domain or `ADMIN_DOMAIN`, the user is redirected to `/[locale]/admin`.

---

## 6. Docker Tagging & Automated Semantic Releases (SemVer)

When changes are pushed or merged to the `main` branch or a Git tag (`v*.*.*`) is published, the GitHub Actions workflow automatically builds production Docker images (`linux/amd64`), creates a GitHub Release with an automated changelog, and pushes the corresponding tags to GitHub Container Registry (GHCR):

| Tag Format | Example | Purpose |
| :--- | :--- | :--- |
| `latest` | `ghcr.io/owner/kotonoba:latest` | Points to the latest stable release (omitted for pre-releases) |
| `MAJOR.MINOR.PATCH` | `ghcr.io/owner/kotonoba:1.2.3` | Immutable exact release version |
| `MAJOR.MINOR` | `ghcr.io/owner/kotonoba:1.2` | Rolling minor tag pointing to latest patch |
| `MAJOR` | `ghcr.io/owner/kotonoba:1` | Rolling major tag pointing to latest minor/patch |
| `MAJOR.MINOR.PATCH-TAG.NUM` | `ghcr.io/owner/kotonoba:1.0.0-rc.1` | Pre-release and testing builds |
| `vMAJOR.MINOR.PATCH` | `ghcr.io/owner/kotonoba:v1.2.3` | Full Git release tag |
