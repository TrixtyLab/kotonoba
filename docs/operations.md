# Kotonoba Operations, Observability & Recovery Runbook

Production procedures for monitoring, privacy retention, encrypted backups, restore verification, and deployment rollbacks.

---

## 1. Observability, Health Checks & Alerting

### Health Probe (`GET /api/health`)
- Public liveness/readiness endpoint verifying SQLite connectivity (`SELECT 1`).
- Intentionally omits runtime versions or stack traces to prevent passive fingerprinting; logs failures structurally (`health.check.failed`).

### Operational Metrics (`GET /api/metrics`)
- Protected endpoint requiring `Authorization: Bearer <CRON_SECRET>` or an active `super_admin` session (rate-limited per client IP).
- Returns process memory (`rssBytes`, `heapUsedBytes`), Node uptime, SQLite database and `-wal` file sizes, tenant/post/page/analytics/audit counts, and `latestAuditAt`. Contains zero tenant content or PII.

### Structured JSON Logging (`src/lib/observability/logger.ts` & `src/lib/security/audit.ts`)
Kotonoba emits single-line JSON records to `stdout`/`stderr`:
- **`type: "app"` (`logEvent` / `logError`):** Operational telemetry across `/api/cron/publish`, `/api/backup/export`, `/api/backup/import`, `/api/metrics`, and `/api/health`, carrying `requestId`, `siteId`, `route`, and `durationMs` with automated secret key redaction and email local-part masking.
- **`type: "audit"` (`recordAuditEvent`):** Persisted in `audit_logs` and emitted to stdout for destructive/privileged mutations (user role/site changes, password changes, site creation/domain changes, post deletions, secret changes, backup exports/imports, and orphan cleanups).

### Recommended Production Alerts
1. **Readiness failure:** `GET /api/health` returns non-`200` for > 2 consecutive probes (check container disk space, SQLite volume mount, and `app` error logs).
2. **Cron failure / stalled outbox:** Missing `cron.publish.completed` logs or `5xx` responses from `POST /api/cron/publish` (verify the external scheduler sends `Authorization: Bearer` with the same `CRON_SECRET` as the app).
3. **Backup failure:** Any `backup.export.failed` / `backup.import.failed` JSON event or failed exit code from `scripts/backup.sh`.
4. **Disk & WAL growth:** Alert when SQLite DB + `-wal` size or `UPLOAD_DIR` volume crosses 80% capacity; verify `analytics_daily` pruning and `/admin/media` orphan cleanup.

---

## 2. Analytics Privacy, Proxy Trust & Data Retention

### Stored Telemetry & Anonymization
- Public blog analytics (`/api/analytics/hit`, `/api/analytics/heartbeat`, `/api/analytics/pixel`) operate **without cookies** and automatically exclude authenticated authors/administrators.
- Visitor IPs are **never persisted in plaintext**: `hashAnalyticsVisitor()` derives a truncated 128-bit HMAC-SHA256 pseudonym (`crypto.createHmac("sha256", JWT_SECRET)`) from resolved client IP + User-Agent so repeated views within 15 minutes deduplicate without storing reversible client IPs.
- Cross-tenant inflation is blocked by `resolveAnalyticsSite()`: client `siteId` is accepted only when matching the validated request host (`Host` / trusted proxy), bounded by both per-IP and per-site rate limits.

### Trusted Proxy Headers (`TRUSTED_PROXY_IPS`)
- Never expose port `3000` directly to the internet; deploy behind the bundled [`nginx/nginx.conf`](../nginx/nginx.conf). Its shared [`proxy-headers.conf`](../nginx/snippets/proxy-headers.conf) overwrites `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Host`, and `X-Forwarded-Proto`, and clears client-supplied `CF-Connecting-IP`, `CF-IPCountry`, `True-Client-IP`, `X-Client-IP`, and `X-Vercel-IP-Country`.
- Behind Cloudflare, [`cloudflare-real-ip.conf`](../nginx/snippets/cloudflare-real-ip.conf) only honors `CF-Connecting-IP` when the immediate peer belongs to a published Cloudflare edge range. Country is intentionally not forwarded because nginx cannot authenticate it.
- When `TRUSTED_PROXY_IPS` is empty, `getClientIp()` ignores client `X-Forwarded-For` hops completely and reads only proxy-overwritten `X-Real-IP`.

### Retention & Pruning (`ANALYTICS_RETENTION_DAYS`)
- Every cron cycle triggers `aggregateDailyAnalytics()` (summarizing raw counts into `analytics_daily`) followed by `pruneExpiredAnalytics()`, deleting raw `analytics` rows older than `ANALYTICS_RETENTION_DAYS` (default `365`; `0` disables deletion).
- Site deletion cascades (`ON DELETE CASCADE`) remove all site posts, pages, taxonomies, settings, analytics, and audit records.

---

## 3. Backup, Key Custody & Disaster Recovery

### Key Custody Warning
Loss of **`BACKUP_ENCRYPTION_KEY`** makes every encrypted `.kotonoba-backup` archive and `.db.gz.enc` snapshot **permanently unrecoverable**. Store a copy of `BACKUP_ENCRYPTION_KEY`, `BACKUP_KEY_ID`, `ENCRYPTION_KEY`, and `ENCRYPTION_KEY_ID` in an offline secret manager / password vault separate from the application server.

### Online CLI Snapshots (`scripts/backup.sh`) & Verification (`scripts/restore.sh`)
- **RPO / RTO:** Running `scripts/backup.sh` hourly provides <= 1 hour RPO; restoring a single database snapshot takes < 5 minutes RTO.
- Create an encrypted, integrity-verified online SQLite backup (`sqlite3 .backup` + `PRAGMA integrity_check` + OpenSSL AES-256-CBC + SHA-256 manifest):
  ```bash
  BACKUP_ENCRYPTION_KEY="your-key" BACKUP_INCLUDE_UPLOADS=true ./scripts/backup.sh
  ```
- Test or execute restoration onto a target DB path (verifies `.sha256`, `PRAGMA integrity_check`, and `PRAGMA foreign_key_check` cleanly before swapping):
  ```bash
  BACKUP_ENCRYPTION_KEY="your-key" ./scripts/restore.sh ./backups/blog_backup_YYYYMMDD_HHMMSS.db.gz.enc /app/data/kotonoba.db
  ```

### Web UI Tenant Backups (`/api/backup/export` & `/api/backup/import`)
- Use `merge` to add missing records safely or `replace` to wipe & restore a single site transactionally.
- Before modifying records in `replace` mode, Kotonoba automatically creates an encrypted pre-restore safety snapshot under `UPLOAD_DIR/snapshots/<siteId>/` (retaining the latest 5 per site). If the SQLite restore transaction throws, both SQLite and any staged media files roll back to their prior state.

---

## 4. Production Deployment & Rollback Checklist

1. Copy [`.env.example`](../.env.example) to `.env` and populate strong random values for `JWT_SECRET`, `ENCRYPTION_KEY` (distinct from `JWT_SECRET`), `BACKUP_ENCRYPTION_KEY`, and `CRON_SECRET`.
2. Ensure `SINGLE_TENANT_FALLBACK=false` in multi-tenant production. If you terminate TLS in your own reverse proxy, install its certificates there. The app container listens on port `3000`. Call `POST /api/cron/publish` from an external scheduler with `CRON_SECRET`.
3. Run quality & security verification locally or in CI (`pnpm typecheck`, `pnpm lint`, `pnpm check:deadcode`, `pnpm test`, `pnpm build`, `pnpm audit --audit-level=critical`).
4. Before deploying schema or major releases, run `./scripts/backup.sh` and copy the `.enc` + `.sha256` artifacts off-site.
5. Deploy with `docker compose up -d` and confirm `GET /api/health` returns success.
6. Confirm initial setup (`/setup`) completes cleanly and locks immediately (`POST /api/setup` -> HTTP `403`), and confirm `CSP_MODE=report-only` logs clean before switching to `CSP_MODE=enforce`.
7. **Rollback:** Start the previous image with `docker compose up -d` and, when schema or content must be reversed, restore the pre-deploy snapshot with `./scripts/restore.sh`.
