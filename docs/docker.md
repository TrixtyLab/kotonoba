# Docker Deployment & Operations Guide

Complete reference for deploying and scaling **Kotonoba** in single-instance and high-availability zero-downtime blue-green production setups.

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
    image: ghcr.io/your-username/kotonoba:latest
    container_name: kotonoba
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DB_PATH=/app/data/blog.db
      - UPLOAD_DIR=/app/data/uploads
      - JWT_SECRET=change-this-to-a-secure-random-32-char-key
      - SITE_URL=https://yourdomain.com
    volumes:
      - blog_data:/app/data
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://127.0.0.1:3000/api/health"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 30s

volumes:
  blog_data:
    driver: local
```

---

## 2. Zero-Downtime Blue-Green Deployment (< 2s Downtime)

For zero-downtime updates with automated health validation and instant rollback:

```
                  ┌──────────────────────┐
                  │ Nginx Proxy (:80/443) │
                  └──────────┬───────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
      ┌──────────────┐              ┌──────────────┐
      │  app-blue    │              │  app-green   │
      │ (Port: 3000) │              │ (Port: 3000) │
      │   ACTIVE     │              │   STANDBY    │
      └───────┬──────┘              └───────┬──────┘
              │                             │
              └──────────────┬──────────────┘
                             ▼
                 ┌───────────────────────┐
                 │  /app/data (SQLite)   │
                 └───────────────────────┘
```

### Initial Production Boot

```bash
docker compose -f docker-compose.prod.yml up -d nginx app-blue
```

### Deploying Updates

Execute the automated deployment script:

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh v1.1.0
```

### How the Blue-Green Script Works:
1. Identifies the currently active slot (`app-blue` or `app-green`).
2. Starts the idle container with the updated Docker image.
3. Polls `/api/health` for up to 45 seconds.
4. **On Success**: Updates `nginx/conf.d/upstream.conf`, executes `nginx -s reload` (hot reload in < 100ms), and gracefully shuts down the old container.
5. **On Failure**: Aborts deployment, terminates the target container, and leaves the active container serving traffic uninterrupted.

---

## 3. Environment Variables Reference

| Variable | Default in Container | Description |
| :--- | :--- | :--- |
| `DB_PATH` | `/app/data/blog.db` | Absolute path to SQLite database file |
| `UPLOAD_DIR` | `/app/data/uploads` | Directory for image and media uploads |
| `JWT_SECRET` | *(Required)* | 32+ character secret for signing auth tokens & encryption |
| `SITE_URL` | `http://localhost:3000` | Canonical URL for sitemaps and OpenGraph |
| `NODE_ENV` | `production` | Node execution environment |
| `PORT` | `3000` | Port the Next.js process listens on |
| `HOSTNAME` | `0.0.0.0` | Bind host address |

> [!NOTE]
> AI configuration (OpenAI endpoint, API keys, model) is managed entirely via the **Admin Settings UI** and stored securely with AES-256 encryption. No extra environment variables required.

---

## 4. Persistent Storage & Backups

All database records, site configurations, and uploaded media reside in the shared volume `/app/data`:

- `/app/data/blog.db`: SQLite database in WAL (Write-Ahead Logging) mode.
- `/app/data/uploads/`: Uploaded images and media.

### Online Atomic Backup

Execute an online snapshot without locking readers:

```bash
chmod +x scripts/backup.sh
./scripts/backup.sh
```

Backups are saved to `./backups/blog_backup_YYYYMMDD_HHMMSS.db.gz` and automatically rotated with a 30-day retention window.

---

## 5. Multi-Tenant Domain Configuration

To route multiple domains/subdomains to separate blogs hosted on the same instance:

1. Point your DNS A/CNAME records (e.g. `blog.company.com`, `tech.domain.org`) to your Docker host IP.
2. In the Admin Dashboard (`/admin/sites`), create a new blog instance and set the **Domain** field to match the host header.
3. The internal Next.js `proxy.ts` automatically isolates data, categories, and articles per domain.

---

## 6. Docker Tagging & Automated Semantic Releases (SemVer)

When changes are pushed or merged to the `main` branch or a Git tag (`v*.*.*`) is published, the GitHub Actions workflow automatically builds multi-arch images (`linux/amd64`, `linux/arm64`), creates a GitHub Release with an automated changelog, and pushes the corresponding tags to GitHub Container Registry (GHCR):

| Tag Format | Example | Purpose |
| :--- | :--- | :--- |
| `latest` | `ghcr.io/owner/kotonoba:latest` | Points to the latest stable release (omitted for pre-releases) |
| `MAJOR.MINOR.PATCH` | `ghcr.io/owner/kotonoba:1.2.3` | Immutable exact release version |
| `MAJOR.MINOR` | `ghcr.io/owner/kotonoba:1.2` | Rolling minor tag pointing to latest patch |
| `MAJOR` | `ghcr.io/owner/kotonoba:1` | Rolling major tag pointing to latest minor/patch |
| `MAJOR.MINOR.PATCH-TAG.NUM` | `ghcr.io/owner/kotonoba:1.0.0-rc.1` | Pre-release and testing builds |
| `vMAJOR.MINOR.PATCH` | `ghcr.io/owner/kotonoba:v1.2.3` | Full Git release tag |

### Pulling Releases

```bash
# Pull latest stable version
docker pull ghcr.io/your-username/kotonoba:latest

# Pin to an exact semantic version
docker pull ghcr.io/your-username/kotonoba:1.0.0

# Pin to a pre-release candidate
docker pull ghcr.io/your-username/kotonoba:1.0.0-rc.1
```
