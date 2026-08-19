# Kotonoba Configuration Guide

Comprehensive configuration reference for storage backends, AI assistant endpoints, link shortening, multi-tenant domain routing, and backups.

---

## 1. Storage Providers Configuration & Private Buckets

Kotonoba supports three primary storage backends for uploaded media and post images:

### A. Local Filesystem (Default)
Stores media files directly in the persistent volume.
- **Environment Variable:** `UPLOAD_DIR=/app/data/uploads` (Production) or `./data/uploads` (Development).
- **Public URL:** Streamed securely via `/api/uploads/[...path]`.

### B. Cloudflare R2 (Public or 100% Private Buckets)
High-performance S3-compatible object storage with zero egress fees.
- **Private Buckets & Presigned Grants:** Full native support for completely private R2 buckets. Kotonoba automatically generates 24-hour cryptographic presigned access grants (`@aws-sdk/s3-request-presigner`) for previewing and serving images without making your bucket public.
- **Configuration via UI:** Navigate to `/admin/settings/storage`, select **Cloudflare R2**, and input:
  - **Account ID:** Cloudflare Account ID.
  - **Access Key ID:** R2 API Token Access Key.
  - **Secret Access Key:** R2 API Token Secret.
  - **Bucket Name:** Name of your R2 bucket.
  - **Public URL:** *(Optional)* Custom CDN domain (e.g. `https://media.myblog.com`). If left blank, signed access grants and internal streaming proxies are used automatically.
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
