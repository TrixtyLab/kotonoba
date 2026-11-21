## Summary

- What does this PR change and why?

## Quality & Architecture Checklist

- [ ] Tenant isolation (`siteId`) enforced on all new/modified queries, caches, API routes, and storage keys
- [ ] HTML/URL/SQLite inputs validated with Zod (`src/lib/security/validate.ts`), parameterized via Drizzle, and sanitized with `sanitizeRichHtml` / `sanitizeUrl`
- [ ] Constants and feature flags placed under `src/lib/config/` rather than inline literals or direct `process.env` reads
- [ ] No database/storage/crypto imports added to UI components (`src/components/**`), and components kept modular (<450 LOC)
- [ ] User-facing strings added to both `messages/en.json` and `messages/es.json`
- [ ] `pnpm check` (`typecheck` + `lint` + `check:deadcode` + `test`), `pnpm build`, and E2E tests pass locally
