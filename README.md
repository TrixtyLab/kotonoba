# BlogForge — Modern Multi-Tenant Blog CMS

A high-performance, self-hosted, multi-tenant blog CMS built with **Next.js 16 (App Router)**, **SQLite**, **Tailwind CSS v4**, and **Docker**.

---

## ✨ Features

- **Tiptap Markdown Editor**: Rich WYSIWYG editing with bidirectional markdown import/export and live **Mermaid diagram** rendering.
- **70+ Language Interface (i18n)**: Internationalization powered by `next-intl` with English (`en`) as the default language.
- **Multi-Tenant Blog Manager**: Host and govern multiple independent blogs with custom domains and subdomains from a unified admin portal.
- **Dark & Light Mode**: Seamless theme toggle powered by Tailwind CSS v4 CSS-first design tokens.
- **100% Responsive & Accessible**: Mobile-first layouts adhering to Vercel Web Interface Guidelines.
- **SEO & AI Search Engine Optimized**: Native `/sitemap.xml`, `/robots.txt`, and `/llms.txt` / `/llms-full.txt` manifests for AI engines (Perplexity, ChatGPT, Claude, Gemini).
- **OpenAI-Compatible Custom Endpoint**: Configurable AI assistant directly in the UI for automated SEO generation, excerpts, translations, and rewrites (supports OpenAI, Ollama, LM Studio, Groq, Azure).
- **Zero-Downtime Blue-Green Deployment**: One-click deployment script with health checks, automated rollback, and < 2s downtime.
- **First-Run Onboarding Wizard**: Automated 5-step wizard on first launch when no administrator exists.
- **Lightweight Privacy Analytics**: Built-in pageview tracking and referrer analytics without third-party cookies.

---

## 🚀 Quickstart with Docker

```bash
docker compose up -d
```

Open `http://localhost:3000` to complete the initial 5-step setup wizard.

---

## 🛠️ Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Turbopack Dev Server
```bash
npm run dev
```

Visit `http://localhost:3000`. Database tables and migrations are automatically applied on startup to `./data/blog.db`.

---

## 🐳 Docker Deployment & Operations

For complete documentation on zero-downtime blue-green deployments, SQLite volume persistence, backups, and multi-tenant domain routing, see [Docker Operations Guide](docs/docker.md).

---

## 📜 Architecture & Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | Next.js 16 (App Router, Turbopack, Standalone) |
| **Database & ORM** | SQLite (`better-sqlite3`) + Drizzle ORM |
| **Styling** | Tailwind CSS v4 (`@theme` CSS-first configuration) |
| **Editor** | Tiptap (`@tiptap/react`, `@tiptap/starter-kit`, `mermaid`) |
| **Internationalization** | `next-intl` (70+ languages, `en` default) |
| **Icons** | Lucide React + React Icons |
| **Security** | Argon2id, Jose (JWT), Zod, Rate Limiting, CSRF |

---

## 📄 License
MIT
