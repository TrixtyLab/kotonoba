# Kotonoba (言の場) — Modern Multi-Tenant Blog CMS

<p align="center">
  <strong>A high-performance, self-hosted, multi-tenant blog CMS built with Next.js 16, SQLite (WAL), Tailwind CSS v4, and Docker.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16.3-black?logo=next.js" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/SQLite-WAL-blue?logo=sqlite" alt="SQLite" />
  <img src="https://img.shields.io/badge/Drizzle-ORM-C5F74F?logo=drizzle" alt="Drizzle ORM" />
  <img src="https://img.shields.io/badge/Tailwind-CSS_v4-38bdf8?logo=tailwindcss" alt="Tailwind CSS v4" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ed?logo=docker" alt="Docker" />
  <img src="https://img.shields.io/badge/License-UPL_1.0_(Non--Commercial)-blue" alt="UPL 1.0 License" />
</p>

---

## 📖 Overview

**Kotonoba (言の場)** is a modern, lightweight, self-hosted content management system designed for developers, technical creators, and multi-blog publishing networks. Built with a clean, distraction-free aesthetic and modern developer tooling (Linear/Vercel design standards), Kotonoba delivers blistering page loads, zero third-party tracking, native Markdown/Mermaid authoring, private bucket cloud storage, and multi-tenant domain isolation from a single SQLite database and container.

---

## ✨ Features & Integrated Capabilities

### 🏢 Multi-Tenant Architecture & Domain Isolation
- **Multiple Blogs on a Single Instance:** Host and govern multiple isolated blog sites with independent categories, tags, posts, branding, and navigation.
- **Custom Domain & Subdomain Routing:** Native hostname resolution via [`src/lib/tenant.ts`](file:///e:/proyects/blog-cms/src/lib/tenant.ts), mapping incoming requests (e.g. `blog.mycompany.com`, `tech.domain.org`, `localhost:3000`) directly to their corresponding site records.
- **Dashboard & Root Domain Redirection (`ADMIN_DOMAIN`):** If a user visits an unassigned domain or a designated dashboard domain (e.g. `blog-dashboard.example.com` or root domain), any request to public blog paths is automatically redirected to `/[locale]/admin`, ensuring blog content is only displayed on assigned blog domains (`blog.example.com`).
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

### 🗄️ Pluggable Storage & Private Bucket Support
- **Dual-Mode Storage Backend:**
  - **Local Filesystem:** Stored persistently on disk at `UPLOAD_DIR` (`/app/data/uploads`).
  - **Cloudflare R2 & AWS S3:** High-performance object storage with full support for **private buckets**.
- **Presigned Access Grants (`@aws-sdk/s3-request-presigner`):** Generates secure, cryptographic 24-hour access grants for private bucket objects without requiring public read permissions.
- **Internal Streaming Proxy:** Media served via `/api/uploads/[...path]` streams securely from private buckets or disk with immutable cache headers (`Cache-Control: public, max-age=31536000, immutable`).
- **Interactive Media Manager (`/admin/media`):**
  - Live storage provider detection with active bucket and privacy status badge.
  - Hierarchical folder navigation with subfolder creation.
  - Drag-and-drop file uploader with mime validation (JPEG, PNG, WebP, GIF, SVG).
  - Move files between directories, search assets, and delete files.
  - Integrated **Media Picker Modal** accessible directly from the post editor and branding settings.

### 🌐 Internationalization & Localization (i18n)
- **Built with `next-intl`:** Route-based language prefixing (`/es/`, `/en/`) with automatic fallback.
- **Multilingual Content:** Articles and site settings support localized titles, descriptions, categories, tags, and custom navigation link labels.
- **Localized Date Formatting:** Formats publication timestamps according to the active locale using native `Intl.DateTimeFormat`.
- **Locale Switcher & Language Selector:** Seamless UI switcher in public blog headers and administrative bars.

### 🔍 SEO, Anti-AI Crawling Policy & LLMs Manifest
- **Dynamic XML Sitemap:** Automatically generated at `/sitemap.xml` with `xhtml:link` hreflang alternates for all published posts and categories.
- **Dynamic Robots File:** Configured at `/robots.txt` with standard crawling budget directives.
- **Anti-AI Policy & Crawler Blocker:** Built-in toggle in `/admin/settings/seo` to actively disallow all major AI training scrapers (`GPTBot`, `ClaudeBot`, `Google-Extended`, `CCBot`, `PerplexityBot`, `Bytespider`, etc.) in `robots.txt`, inject `<meta name="robots" content="noai, noimageai" />`, and set W3C `<meta name="tdm-reservation" content="1" />` tags.
- **AI Search Engine Manifests (`/llms.txt` & `/llms-full.txt`):** Disabled by default. Can be optionally enabled in `/admin/settings/seo` to provide structured markdown indexes for AI models (ChatGPT, Perplexity, Claude).
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
| `SITE_URL` | `string` | `http://localhost:3000` | No | Fallback canonical URL for sitemaps, robots, and OpenGraph when domain is unspecified. |
| `ADMIN_DOMAIN` | `string` | `""` | No | Optional dashboard/root domain (e.g. `blog-dashboard.example.com`). Redirects public paths to `/admin`. |
| `JWT_SECRET` | `string` | *(Required)* | **Yes (Prod)** | 32+ character random secret key for signing JWT tokens and encrypting credentials (AES-256). |
| `SESSION_DURATION` | `string` | `30d` | No | Access token expiration duration (e.g. `30d`, `7d`, `24h`). Alias: `JWT_EXPIRES_IN`. |
| `REFRESH_DURATION` | `string` | `90d` | No | Refresh token expiration duration. Alias: `REFRESH_EXPIRES_IN`. |
| `DB_PATH` | `string` | `/app/data/kotonoba.db` | No | Absolute or relative filesystem path to the SQLite database file. |
| `UPLOAD_DIR` | `string` | `/app/data/uploads` | No | Local directory for uploaded media and images. |
| `MAX_UPLOAD_SIZE` | `number` | `10485760` (10MB) | No | Maximum allowed upload file size in bytes. |
| `DUB_API_KEY` | `string` | `""` | No | Dub.co API Key for branded short link generation. |
| `DUB_DOMAIN` | `string` | `dub.sh` | No | Short link domain registered on Dub.co. |
| `R2_ACCOUNT_ID` | `string` | `""` | No | Cloudflare Account ID for Cloudflare R2 object storage. |
| `R2_ACCESS_KEY_ID` | `string` | `""` | No | Cloudflare R2 / S3 API Access Key ID. |
| `R2_SECRET_ACCESS_KEY`| `string` | `""` | No | Cloudflare R2 / S3 API Secret Access Key. |
| `R2_BUCKET_NAME` | `string` | `""` | No | Target Cloudflare R2 bucket name. |
| `R2_PUBLIC_URL` | `string` | `""` | No | Custom public CDN domain or base URL (optional for private buckets). |
| `AWS_REGION` | `string` | `auto` | No | AWS S3 region or `auto` for Cloudflare R2. |
| `S3_BUCKET` | `string` | `""` | No | Amazon AWS S3 bucket name (alternative to R2). |

---

## 🚀 Quick Start with Docker

### Using Docker Compose (Recommended)

1. Create a `docker-compose.yml` file:

```yaml
version: "3.8"

services:
  kotonoba:
    image: kotonoba:latest
    container_name: kotonoba-blog
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - SITE_URL=https://myblog.com
      - JWT_SECRET=your_super_secret_random_32_character_string_here
    volumes:
      - kotonoba_data:/app/data

volumes:
  kotonoba_data:
```

2. Start the container:

```bash
docker compose up -d
```

3. Open `http://localhost:3000` in your browser to start the initial setup wizard.

---

## 📄 License

This software is licensed under the **UnSetSoft Public License (UPL) 1.0 (Non-Commercial Only)**.
See the [`LICENSE.md`](file:///e:/proyects/blog-cms/LICENSE.md) file for complete licensing terms and restrictions.