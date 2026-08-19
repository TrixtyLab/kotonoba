# Kotonoba (言の場) — Modern Multi-Tenant Blog CMS

<p align="center">
  <strong>A high-performance, self-hosted, multi-tenant blog CMS built with Next.js 16, SQLite, Tailwind CSS v4, and Docker.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16.3-black?logo=next.js" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/SQLite-WAL-blue?logo=sqlite" alt="SQLite" />
  <img src="https://img.shields.io/badge/Drizzle-ORM-C5F74F?logo=drizzle" alt="Drizzle ORM" />
  <img src="https://img.shields.io/badge/Tailwind-CSS_v4-38bdf8?logo=tailwindcss" alt="Tailwind CSS v4" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ed?logo=docker" alt="Docker" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT License" />
</p>

---

## 📖 Overview

**Kotonoba (言の場)** is a modern, lightweight, self-hosted content management system designed for developers, technical creators, and multi-blog publishing networks. Built with a clean, distraction-free aesthetic and modern developer tooling (Linear/Vercel design standards), Kotonoba delivers blistering page loads, zero third-party tracking, native Markdown/Mermaid authoring, and multi-tenant domain isolation from a single SQLite database and container.

---

## ✨ Features & Integrated Capabilities

### 🏢 Multi-Tenant Architecture & Domain Routing
- **Multiple Blogs on a Single Instance:** Host and govern multiple isolated blog sites with independent categories, tags, posts, branding, and navigation.
- **Custom Domain & Subdomain Routing:** Native hostname resolution via Next.js middleware (`src/proxy.ts`), mapping incoming requests (e.g. `blog.mycompany.com`, `tech.domain.org`, `localhost:3000`) directly to their corresponding site records.
- **Instant Workspace Switcher:** Switch between tenant blogs seamlessly within the administrative navigation bar and sidebar.

### ✍️ Rich WYSIWYG & Markdown Editor
- **TipTap v2 Engine:** Full WYSIWYG authoring with bold, italic, strikethrough, inline code, headings (H1–H3), blockquotes, lists, and horizontal dividers.
- **Live Mermaid Diagrams:** Write ` ```mermaid ` code blocks with instant graphical diagram rendering in both the editor preview and public article reader.
- **Rich Media Embeds:** Automatic parsing and responsive embedding for YouTube, X (Twitter), Bluesky, Vimeo, Spotify, and CodePen URLs using simple `@[embed](url)` markdown tags.
- **Bidirectional Markdown Sync:** Full HTML to Markdown and Markdown to HTML conversion with live word count and reading time estimations.
- **Automatic Block Escaping:** Smart Enter key shortcuts to automatically exit quote blocks and headings into standard paragraph prose.

### 🤖 OpenAI-Compatible AI Assistant
- **Flexible AI Endpoints:** Connect to any OpenAI-compatible provider directly from the UI or environment—supports **OpenAI**, **Groq**, **Ollama**, **LM Studio**, **Azure OpenAI**, **OpenRouter**, **DeepSeek**, and **vLLM**.
- **Automated Excerpt & SEO Summarizer:** Generate concise SEO summaries and article excerpts in one click.
- **Text Rewriting & Improvement:** Polish drafts with customizable prompt instructions (adjust tone, clarity, grammar, or conciseness).
- **Multilingual Article Translation:** Translate complete articles (title, excerpt, and full formatted body) across supported languages while preserving HTML tags and code blocks.

### 🔗 Dub.co Link Shortening & QR Codes
- **Branded Link Provisioning:** Integrated with the [Dub.co](https://dub.co) API (`DUB_API_KEY`) to generate branded short URLs on article creation or publication.
- **Automated QR Code Generation:** Instant vector QR codes for short links (`https://api.dub.co/qr?url=...`) with download and modal preview.
- **UTM Parameter Builder:** Built-in campaign tags builder for marketing campaigns and attribution tracking.

### 📊 Privacy-Friendly Analytics & UTM Attribution
- **Zero Cookies & 100% GDPR-Compliant:** Lightweight tracking beacon (`/api/analytics/hit`) using SHA-256 IP hashing with a 15-minute anti-flood deduplication window.
- **Bot & Spider Filtering:** Automatically discards search engine spiders, link preview bots, and browser prefetch requests (`x-purpose: preview`).
- **Author & Admin Exclusion:** Authenticated administrators and article authors are automatically excluded from pageview counters.
- **Rich Analytics Dashboard (`/admin/analytics`):**
  - Total pageviews and estimated unique visitor counts.
  - UTM Campaign and Source attribution metrics (`utm_source`, `utm_medium`, `utm_campaign`).
  - Referrer domain grouping and ranking.
  - Device distribution (Desktop, Mobile, Tablet) and browser vendor breakdown.
  - Geographic distribution by country (via Cloudflare/Vercel geolocation headers).
  - 14-day interactive activity timeline chart.
  - Top articles ranked by verified view count.

### 🗄️ Pluggable Storage & Media Library
- **Dual-Mode Storage Backend:**
  - **Local Filesystem:** Stored persistently on disk at `UPLOAD_DIR` (`/app/data/uploads`).
  - **Cloudflare R2 & AWS S3:** High-performance cloud storage with custom CDN public URL support.
- **Interactive Media Manager (`/admin/media`):**
  - Hierarchical folder navigation with subfolder creation.
  - Drag-and-drop file uploader with mime validation (JPEG, PNG, WebP, GIF, SVG).
  - Move files between directories, search assets, and delete files.
  - Integrated **Media Picker Modal** accessible directly from the post editor and branding settings.
- **Dedicated Media Server:** Static file streaming route (`/api/uploads/[...path]`) with immutable cache headers (`Cache-Control: public, max-age=31536000, immutable`).

### 🌐 Internationalization & Localization (i18n)
- **Built with `next-intl`:** Route-based language prefixing (`/es/`, `/en/`) with automatic fallback.
- **Multilingual Content:** Articles and site settings support localized titles, descriptions, and custom navigation link labels.
- **Localized Date Formatting:** Formats publication timestamps according to the active locale using native `Intl.DateTimeFormat`.
- **Locale Switcher & Language Selector:** Seamless UI switcher in public blog headers and administrative bars.

### 🔍 SEO, Social Sharing & AI Engine Manifests
- **Dynamic XML Sitemap:** Automatically generated at `/sitemap.xml` with `xhtml:link` hreflang alternates for all published posts and categories.
- **Dynamic Robots File:** Configured at `/robots.txt` with sitemap directives.
- **AI Search Engine Manifests (`/llms.txt` & `/llms-full.txt`):** Structured markdown documentation index optimized for AI engines (Perplexity, ChatGPT, Claude, Gemini) with an administrative toggle switch in `/admin/settings/seo`.
- **Social Sharing & Engagement:**
  - One-click sharing to Twitter/X, Facebook, LinkedIn, WhatsApp, and Telegram.
  - Client-side article like reaction button with persistent local storage.
  - Reading progress bar and Table of Contents (TOC) with scroll spy.

### 🛡️ Enterprise-Grade Security
- **Argon2id Password Hashing:** Industry-standard memory-hard password hashing for user credentials.
- **Stateless JWT Sessions:** Signed with `jose` using HS256 and stored in secure, `httpOnly`, `sameSite=lax` cookies.
- **AES-256-GCM Database Encryption:** Sensitive site settings (AI keys, storage secrets, endpoints) are encrypted at rest using AES-256-GCM.
- **Sliding-Window Rate Limiting:** In-memory sliding window limiter protecting authentication endpoints and analytics ingestion beacons.
- **Security Headers:** Strict Content Security Policy (CSP), HSTS, X-Content-Type-Options, X-Frame-Options, and Referrer-Policy headers.
- **First-Run Guard:** Automated 5-step onboarding wizard (`/setup`) that self-locks once an administrator account is registered.

### 💾 Backup & Disaster Recovery
- **One-Click Site Backup (`/api/backup/export`):** Streams a compressed ZIP archive containing all database tables (JSON format), uploaded media files, and manifest metadata.
- **ZIP Restoration Wizard (`/api/backup/import`):** Upload a backup ZIP to restore database entities and media in either **Merge** (non-destructive) or **Replace** mode.
- **Online CLI Backup Script:** [`scripts/backup.sh`](file:///e:/proyects/blog-cms/scripts/backup.sh) captures atomic SQLite snapshots with gzip compression and automated 30-day retention cleanup.

---

## ⚙️ Environment Variables Reference

Kotonoba can be configured via environment variables or directly through the Web UI (`/admin/settings/*`).

| Variable | Type | Default in Container | Required? | Description |
| :--- | :--- | :--- | :--- | :--- |
| `NODE_ENV` | `string` | `production` | No | Node runtime environment (`production` or `development`). |
| `PORT` | `number` | `3000` | No | Port on which the Next.js HTTP server listens. |
| `HOSTNAME` | `string` | `0.0.0.0` | No | Network interface binding address. |
| `JWT_SECRET` | `string` | *(Required)* | **Yes (Prod)** | 32+ character random secret key for signing JWT tokens and encrypting credentials (AES-256). |
| `DB_PATH` | `string` | `/app/data/blog.db` | No | Absolute or relative filesystem path to the SQLite database file. |
| `UPLOAD_DIR` | `string` | `/app/data/uploads` | No | Local directory for uploaded media and images. |
| `SITE_URL` | `string` | `http://localhost:3000` | No | Fallback canonical URL for sitemaps, robots, and OpenGraph when domain is unspecified. |
| `SESSION_DURATION` | `string` | `30d` | No | Access token expiration duration (e.g. `30d`, `7d`, `24h`). Alias: `JWT_EXPIRES_IN`. |
| `REFRESH_DURATION` | `string` | `90d` | No | Refresh token expiration duration. Alias: `REFRESH_EXPIRES_IN`. |
| `MAX_UPLOAD_SIZE` | `number` | `10485760` (10MB) | No | Maximum allowed upload file size in bytes. |
| `DUB_API_KEY` | `string` | `""` | No | Dub.co API Key for branded short link generation. |
| `DUB_DOMAIN` | `string` | `dub.sh` | No | Custom short link domain configured in your Dub.co workspace. |
| `R2_ACCOUNT_ID` | `string` | `""` | No | Cloudflare Account ID for R2 storage integration. |
| `R2_ACCESS_KEY_ID` | `string` | `""` | No | S3 / Cloudflare R2 Access Key ID. Alias: `AWS_ACCESS_KEY_ID`. |
| `R2_SECRET_ACCESS_KEY` | `string` | `""` | No | S3 / Cloudflare R2 Secret Access Key. Alias: `AWS_SECRET_ACCESS_KEY`. |
| `R2_BUCKET_NAME` | `string` | `""` | No | S3 or Cloudflare R2 bucket name. Alias: `S3_BUCKET`. |
| `R2_PUBLIC_URL` | `string` | `""` | No | Public CDN or custom domain URL serving R2 assets (e.g. `https://media.example.com`). |
| `AWS_REGION` | `string` | `auto` | No | AWS S3 region (e.g. `us-east-1` or `auto` for Cloudflare R2). |

> [!TIP]
> Storage provider settings (Local / S3 / R2) and AI Assistant configurations can be configured dynamically without restarting the server via `/admin/settings/storage` and `/admin/settings/ai`.

---

## 🚀 Quickstart

### Option 1: Docker Compose (Recommended)

1. Create a `docker-compose.yml` file:

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
      - JWT_SECRET=replace-with-a-secure-random-32-character-secret-key
      - SITE_URL=http://localhost:3000
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

2. Start the container:
```bash
docker compose up -d
```

3. Open `http://localhost:3000` in your browser. The setup wizard will prompt you to create your initial administrator account and primary blog.

---

### Option 2: Local Development

1. **Clone the repository & install dependencies:**
```bash
git clone https://github.com/TrixtyLab/kotonoba.git
cd kotonoba
pnpm install
```

2. **Configure environment variables:**
```bash
cp .env.example .env.local
```

3. **Start the Turbopack development server:**
```bash
pnpm dev
```

4. Open `http://localhost:3000`. Migrations and database indexes are automatically applied on startup to `./data/kotonoba.db`.

---

## 🐳 Zero-Downtime Blue-Green Deployment

Kotonoba includes a production-ready zero-downtime deployment mechanism with Nginx hot-reloading (< 100ms switch, < 2s total deployment time) and health check validation:

```bash
# Make script executable
chmod +x scripts/deploy.sh

# Deploy a new release
./scripts/deploy.sh v1.0.0
```

For full architectural blueprints, rollback strategies, and volume management, see the [Docker Operations Guide](docs/docker.md).

---

## 🔌 API & Endpoint Reference

| Endpoint | Method | Access | Description |
| :--- | :--- | :--- | :--- |
| `/api/health` | `GET` | Public | Liveness and database connectivity probe. |
| `/api/analytics/hit` | `POST` | Public | Ingests privacy-friendly pageviews with deduplication and bot filtering. |
| `/api/upload` | `POST` | Authenticated | Multipart image and media upload handler (Local / S3 / R2). |
| `/api/uploads/[...path]` | `GET` | Public | Static file streaming server for persistent media with cache headers. |
| `/api/media` | `GET` / `POST` | Authenticated | Directory browser, folder creation, asset relocation, and deletion. |
| `/api/backup/export` | `GET` | Admin / Super Admin | Streams compressed ZIP archive of database entities and media files. |
| `/api/backup/import` | `POST` | Admin / Super Admin | Restores database records and media files from an uploaded ZIP archive. |
| `/sitemap.xml` | `GET` | Public | Dynamic XML sitemap with hreflang multi-language alternates. |
| `/robots.txt` | `GET` | Public | Crawler instructions and sitemap link. |
| `/llms.txt` | `GET` | Public | Structured markdown documentation index for LLMs and AI agents. |
| `/llms-full.txt` | `GET` | Public | Full comprehensive documentation catalog for AI model context. |

---

## 🏗️ Project Structure

```
blog-cms/
├── .github/workflows/          # CI/CD & Automated Semantic Release Workflows
├── data/                       # Local SQLite DB & Uploads (Mounted in Docker)
├── docs/                       # Detailed Technical & Operations Documentation
│   ├── docker.md               # Blue-Green & Container Deployment Guide
│   ├── configuration.md        # Deep-dive Configuration Reference
│   └── architecture.md         # System Architecture & Design System
├── messages/                   # Internationalization JSON Dictionaries (en, es)
├── nginx/                      # Nginx Upstream Configuration for Blue-Green
├── public/                     # Static Web Assets (Favicons, Icons)
├── scripts/                    # Deployment & Automated Backup Shell Scripts
├── src/
│   ├── actions/                # Server Actions (auth, setup, posts, categories, tags, sites, settings, ai, dub)
│   ├── app/                    # Next.js App Router (Layouts, Pages, API Handlers)
│   │   ├── [locale]/           # Localized App Routes
│   │   │   ├── (admin)/        # Authenticated CMS Administration Portal
│   │   │   ├── (auth)/         # Login Portal & First-Run Setup Wizard
│   │   │   └── (blog)/         # Public Blog Presentation Views (Home, Archive, Category, Tag, Entry)
│   │   └── api/                # REST & Streaming Endpoints (Analytics, Backup, Health, Media, Upload)
│   ├── components/             # Reusable UI & Business Logic Components
│   │   ├── admin/              # CMS Editors, Lists, Modal Pickers, Settings Panels
│   │   ├── blog/               # Public Blog Presentation Layout, Header, Cards, Sidebar, TOC, Share
│   │   └── ui/                 # Accessible Primitive Design System (Buttons, Modals, Inputs, Badges)
│   ├── i18n/                   # Internationalization Routing & Request Handlers
│   ├── lib/                    # Core Business & Infrastructure Layer
│   │   ├── ai/                 # OpenAI-Compatible Client
│   │   ├── auth/               # Argon2id, JWT, Session Management
│   │   ├── backup/             # ZIP Export & Import Backup Engine
│   │   ├── db/                 # SQLite Connection, Drizzle Schema & Migrations
│   │   ├── security/           # Crypto AES-256, Rate Limiting, Headers, Validation
│   │   ├── storage/            # Local, Cloudflare R2 & AWS S3 Storage Handlers
│   │   ├── utils/              # Markdown, Embeds, Dates, Slugs, Localization
│   │   ├── dub.ts              # Dub.co Shortener Integration
│   │   └── tenant.ts           # Multi-tenant Site Resolvers
│   └── proxy.ts                # Next.js Edge Middleware for Multi-Tenant Routing
├── Dockerfile                  # Multi-Stage Container Image Definition
├── docker-compose.yml          # Production & Development Compose Configuration
└── package.json                # Project Manifest & Dependency Catalog
```

---

## 📄 License

![License: UPL 1.0](https://img.shields.io/badge/License-UPL%201.0-blue?style=for-the-badge)
![Non-Commercial](https://img.shields.io/badge/Non--Commercial-Only-red?style=for-the-badge)