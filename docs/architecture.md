# Kotonoba System Architecture & Technical Specifications

Technical architecture overview of the Kotonoba multi-tenant CMS platform.

---

## 1. Architectural Overview

```
                      ┌──────────────────────────────────────────────┐
                      │              Incoming Request                │
                      └──────────────────────┬───────────────────────┘
                                             │
                                             ▼
                      ┌──────────────────────────────────────────────┐
                      │          Next.js Proxy / Middleware          │
                      │     (Domain Resolution & Auth Routing)       │
                      └──────────────────────┬───────────────────────┘
                                             │
                      ┌──────────────────────┴───────────────────────┐
                      │                                              │
                      ▼                                              ▼
       ┌───────────────────────────────┐              ┌───────────────────────────────┐
       │      Public Blog Layout       │              │   Admin CMS Portal (Linear)   │
       │  (Static/Dynamic SSR, TOC)    │              │  (TipTap, Settings, Metrics)  │
       └──────────────┬────────────────┘              └──────────────┬────────────────┘
                      │                                              │
                      └──────────────────────┬───────────────────────┘
                                             │
                                             ▼
                      ┌──────────────────────────────────────────────┐
                      │         Server Actions & API Handlers        │
                      │    (Auth Guard, Rate Limiter, Validations)   │
                      └──────────────────────┬───────────────────────┘
                                             │
                                             ▼
                      ┌──────────────────────────────────────────────┐
                      │          Drizzle ORM & SQLite (WAL)          │
                      │    (/app/data/kotonoba.db, Atomic Backup)    │
                      └──────────────────────────────────────────────┘
```

---

## 2. Database Schema Model (Drizzle ORM + SQLite)

The database schema (`src/lib/db/schema.ts`) contains 8 core tables:

1. **`sites`**: Multi-tenant site instances (`id`, `name`, `subtitle`, `description`, `domain`, `logoUrl`, `faviconUrl`, `primaryColor`, `navLinks`, `navAlignment`, `customCss`, `createdAt`, `updatedAt`).
2. **`users`**: User accounts (`id`, `siteId`, `email`, `passwordHash`, `displayName`, `avatarUrl`, `bio`, `role` [`super_admin`, `admin`, `editor`, `author`], `createdAt`, `updatedAt`).
3. **`posts`**: Published & draft articles (`id`, `siteId`, `authorId`, `title`, `slug`, `contentHtml`, `contentMd`, `excerpt`, `coverImage`, `status`, `locale`, `pinned`, `views`, `likes`, `shortUrl`, `publishedAt`, `createdAt`, `updatedAt`).
4. **`categories`**: Category taxonomy (`id`, `siteId`, `name`, `slug`, `description`, `icon`, `order`, `createdAt`).
5. **`tags`**: Keyword tags taxonomy (`id`, `siteId`, `name`, `slug`, `createdAt`).
6. **`postCategories`**: Many-to-many junction table between posts and categories (`post_id`, `category_id`).
7. **`postTags`**: Many-to-many junction table between posts and tags (`post_id`, `tag_id`).
8. **`analytics`**: Privacy-friendly visit logs (`id`, `siteId`, `postId`, `path`, `referrer`, `userAgent`, `ipHash`, `country`, `city`, `device`, `browser`, `os`, `utmSource`, `utmMedium`, `utmCampaign`, `utmTerm`, `utmContent`, `createdAt`).
9. **`settings`**: Scoped key-value parameters (`id`, `siteId`, `key`, `value`).

---

## 3. Security Architecture

- **Password Hashing:** Implemented with `argon2id` (RFC 9106 recommended parameters) in [`src/lib/auth/password.ts`](file:///e:/proyects/blog-cms/src/lib/auth/password.ts).
- **Stateless Authentication:** JSON Web Tokens (JWT) signed via `jose` with HS256 algorithm and configured expiration (`SESSION_DURATION`). Stored in `httpOnly`, `sameSite=lax`, `secure` cookies.
- **At-Rest Encryption:** Sensitive database fields (AI keys, storage secrets) are encrypted using AES-256-GCM via [`src/lib/security/crypto.ts`](file:///e:/proyects/blog-cms/src/lib/security/crypto.ts).
- **Rate Limiting:** Sliding-window rate limiter preventing brute-force login attempts and flood attacks on the analytics beacon.
- **HTTP Headers:** Strict CSP, HSTS, X-Content-Type-Options, X-Frame-Options, and Referrer-Policy headers.

---

## 4. Internationalization & Routing

- Managed with `next-intl` (`src/i18n/routing.ts` and `src/i18n/request.ts`).
- Root layouts dynamically set `<html lang={locale}>`.
- Content entities support localized fields via the JSON-compatible `getLocalizedText` utility.
