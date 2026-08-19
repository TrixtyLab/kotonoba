# Kotonoba Configuration Guide

Comprehensive configuration reference for storage backends, AI assistant endpoints, link shortening, multi-tenant domain routing, and backups.

---

## 1. Storage Providers Configuration

Kotonoba supports three primary storage backends for uploaded media and post images:

### A. Local Filesystem (Default)
Stores media files directly in the persistent volume.
- **Environment Variable:** `UPLOAD_DIR=/app/data/uploads` (Production) or `./data/uploads` (Development).
- **Public URL:** Streamed securely via `/api/uploads/[...path]`.

### B. Cloudflare R2
High-performance S3-compatible object storage with zero egress fees.
- **Configuration via UI:** Navigate to `/admin/settings/storage`, select **Cloudflare R2**, and input:
  - **Account ID:** Cloudflare Account ID.
  - **Access Key ID:** R2 API Token Access Key.
  - **Secret Access Key:** R2 API Token Secret.
  - **Bucket Name:** Name of your R2 bucket.
  - **Public URL:** Your custom domain or R2 dev URL (e.g. `https://media.myblog.com`).
- **Configuration via `.env`:**
  ```env
  R2_ACCOUNT_ID=your_cloudflare_account_id
  R2_ACCESS_KEY_ID=your_access_key
  R2_SECRET_ACCESS_KEY=your_secret_key
  R2_BUCKET_NAME=your_bucket_name
  R2_PUBLIC_URL=https://media.myblog.com
  ```

### C. Amazon S3 / S3-Compatible (MinIO, DigitalOcean Spaces, Wasabi)
- **Configuration via UI / `.env`:**
  ```env
  AWS_ACCESS_KEY_ID=your_aws_key
  AWS_SECRET_ACCESS_KEY=your_aws_secret
  S3_BUCKET=your_s3_bucket
  AWS_REGION=us-east-1
  R2_PUBLIC_URL=https://your-bucket.s3.amazonaws.com
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

## 4. Multi-Tenant Domain Routing

To map multiple isolated blogs to custom domains:

1. In DNS, point CNAME or A records to your server IP.
2. In Kotonoba (`/admin/sites`), create a new site record and set the **Domain** field to the hostname (e.g. `blog.company.com`).
3. Next.js middleware automatically isolates all posts, categories, tags, settings, and media to that tenant.

---

## 5. SEO & AI Search Engine Indexing (`/llms.txt`)

- **`/sitemap.xml`:** Generated dynamically with multi-language `xhtml:link` alternates.
- **`/robots.txt`:** Standard bot crawling guidelines.
- **`/llms.txt` & `/llms-full.txt`:** Standardized markdown manifests for AI search engines (ChatGPT, Perplexity, Claude). Can be toggled on/off in `/admin/settings/seo`.
