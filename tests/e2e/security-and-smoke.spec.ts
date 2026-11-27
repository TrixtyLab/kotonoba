import crypto from "crypto";
import fs from "fs";
import JSZip from "jszip";
import { test, expect } from "@playwright/test";

const VALID_PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

const BACKUP_MAGIC = Buffer.from("KOTONOBA-BACKUP-V1\n", "utf8");
const BACKUP_KEY = Buffer.alloc(32, 0x51);

function decryptBackupArchiveBytes(encryptedBuf: Buffer): Buffer {
  const keyIdLength = encryptedBuf[BACKUP_MAGIC.length];
  const headerEnd = BACKUP_MAGIC.length + 1 + keyIdLength;
  const header = encryptedBuf.subarray(0, headerEnd);
  const iv = encryptedBuf.subarray(headerEnd, headerEnd + 12);
  const tag = encryptedBuf.subarray(encryptedBuf.length - 16);
  const ciphertext = encryptedBuf.subarray(headerEnd + 12, encryptedBuf.length - 16);

  const decipher = crypto.createDecipheriv("aes-256-gcm", BACKUP_KEY, iv);
  decipher.setAAD(header);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

async function buildAugmentedArchiveBuffer(encryptedBuf: Buffer, count: number): Promise<Buffer> {
  const zipBytes = decryptBackupArchiveBytes(encryptedBuf);
  const zip = await JSZip.loadAsync(zipBytes);
  const dataRaw = await zip.file("data.json")!.async("string");
  const manifestRaw = await zip.file("manifest.json")!.async("string");

  const dataDump = JSON.parse(dataRaw) as {
    site: { id: string };
    authors?: Array<{ id: string }>;
    posts: Array<Record<string, unknown>>;
  };
  const manifest = JSON.parse(manifestRaw) as {
    checksum: string;
    counts: Record<string, number>;
  };

  const authorId = dataDump.authors?.[0]?.id || null;
  const baseTs = Date.now();
  for (let i = 1; i <= count; i++) {
    const publishedIso = new Date(baseTs - i * 60_000).toISOString();
    dataDump.posts.push({
      id: `archive-seed-${i}`,
      siteId: dataDump.site.id,
      authorId,
      title: `Archive Seed Article ${i}`,
      slug: `archive-seed-${i}`,
      contentMd: "",
      contentHtml: `<p>Seeded archive item ${i}</p>`,
      contentFormat: "html",
      excerpt: `Seeded summary ${i}`,
      coverImage: null,
      status: "published",
      locale: "en",
      publishedAt: publishedIso,
      createdAt: publishedIso,
      updatedAt: publishedIso,
      views: 0,
      pinned: false,
      shortUrl: null,
      dubLinkId: null,
    });
  }

  const nextDataJson = JSON.stringify(dataDump, null, 2);
  manifest.checksum = crypto.createHash("sha256").update(nextDataJson, "utf8").digest("hex");
  manifest.counts.posts = dataDump.posts.length;

  zip.file("data.json", nextDataJson);
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  const nextZipBytes = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const keyIdLength = encryptedBuf[BACKUP_MAGIC.length];
  const header = encryptedBuf.subarray(0, BACKUP_MAGIC.length + 1 + keyIdLength);
  const nextIv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", BACKUP_KEY, nextIv);
  cipher.setAAD(header);
  const nextCiphertext = Buffer.concat([cipher.update(nextZipBytes), cipher.final()]);
  const nextTag = cipher.getAuthTag();
  return Buffer.concat([header, nextIv, nextCiphertext, nextTag]);
}

test.describe.serial("Kotonoba End-to-End Security, Setup Lockout & Publishing Flows", () => {
  let sharedSiteAId = "";
  let sharedSiteBId = "";

  test("guards /admin against unauthenticated & forged JWT cookies, completes initial setup once, locks /setup, logs in, and sanitizes public article rendering", async ({
    page,
    context,
    baseURL,
  }) => {
    const parsedBase = new URL(baseURL || "http://localhost:3917");
    const activeHost = parsedBase.host;
    const activeHostname = parsedBase.hostname;
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto("/en/admin");
    await expect(page).toHaveURL(/\/(?:en\/)?login/);

    await context.addCookies([
      {
        name: "access_token",
        value: "forged.invalid.jwt",
        domain: activeHostname,
        path: "/",
      },
    ]);
    await page.goto("/en/admin/posts");
    await expect(page).toHaveURL(/\/(?:en\/)?login/);
    await context.clearCookies();

    await page.goto("/en/setup", { waitUntil: "domcontentloaded" });
    const setupNameInput = page.getByPlaceholder("e.g. Alexander Vance");
    await expect(setupNameInput).toBeVisible({ timeout: 20_000 });
    await setupNameInput.fill("E2E Admin");
    await page.getByPlaceholder("admin@example.com").fill("e2e-admin@example.com");
    await page.getByPlaceholder("••••••••••••").fill("StrongE2ePass123!");
    await page.getByRole("button", { name: /Continue/i }).click();

    await page.getByPlaceholder("My Tech Blog").fill("E2E Hardened Blog");
    await page.getByPlaceholder("blog.mydomain.com or localhost:3000").fill(activeHost);
    await page.getByRole("button", { name: /Continue/i }).click();

    await page.getByRole("button", { name: /Continue/i }).click();
    await page.getByRole("button", { name: /Initialize & Publish/i }).click();

    await expect(page.getByText(/Your Blog is Ready & Live!/i)).toBeVisible({ timeout: 15_000 });

    const lockedSetupApi = await page.request.post("/api/setup", { data: {} });
    expect(lockedSetupApi.status()).toBe(403);
    await page.goto("/en/setup");
    await expect(page).toHaveURL(/\/(?:en\/)?login/);

    await expect(page.getByText(/First time\? Launch Setup Wizard/i)).toHaveCount(0);

    await context.clearCookies();

    await page.getByPlaceholder("admin@example.com").fill("e2e-admin@example.com");
    await page.getByPlaceholder("••••••••••••").fill("StrongE2ePass123!");
    await page.getByRole("button", { name: /Sign In/i }).click();

    await expect(page).toHaveURL(/\/(?:en\/)?admin/);

    await page.goto("/en/admin/audit");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await page.goto("/en/admin/posts/new");
    await page.getByPlaceholder("Article title…").first().fill("E2E Verified Post");
    const editorArea = page.locator(".ProseMirror").first();
    await editorArea.click();
    await page.keyboard.type('Clean body text <img src=x onerror="window.__xss=1">');
    await page.getByRole("button", { name: /^Publish$/i }).click();
    await expect(page).toHaveURL(/\/(?:en\/)?admin\/posts\/(?!new$)[a-zA-Z0-9_-]+$/, {
      timeout: 15_000,
    });

    await page.goto("/en");
    const postHeadingLink = page.getByRole("heading", { name: "E2E Verified Post" }).getByRole("link");
    await expect(postHeadingLink).toBeVisible();
    await postHeadingLink.click();
    await expect(page).toHaveURL(/\/(?:en\/)?entry\/e2e-verified-post/, { timeout: 20_000 });
    await expect(page.getByText("Clean body text")).toBeVisible({ timeout: 20_000 });
    const xssTriggered = await page.evaluate(() => (window as unknown as { __xss?: unknown }).__xss ?? null);
    expect(xssTriggered).toBeNull();

    await page.goto("/en/admin/posts/new");
    await page.getByPlaceholder("Article title…").first().fill("E2E Mermaid Article");
    const mermaidPostEditor = page.locator(".ProseMirror").first();
    await mermaidPostEditor.click();
    await page.keyboard.type("```mermaid ");
    await page.keyboard.type('graph TD\nA["<img src=x onerror=\'window.__xss=1\'>"]-->B\nclick B "javascript:window.__xss=2"');
    await page.getByRole("button", { name: /^Publish$/i }).click();
    await expect(page).toHaveURL(/\/(?:en\/)?admin\/posts\/(?!new$)[a-zA-Z0-9_-]+$/, {
      timeout: 15_000,
    });

    await page.goto("/en/entry/e2e-mermaid-article");
    await expect(page.locator("svg[id^='mermaid-']").first()).toBeVisible({ timeout: 20_000 });
    const postMermaidXss = await page.evaluate(() => (window as unknown as { __xss?: unknown }).__xss ?? null);
    expect(postMermaidXss).toBeNull();

    expect(pageErrors).toEqual([]);
  });

  test("enforces media upload re-encoding & SVG block, multi-tenant cookie/admin isolation, encrypted backup round-trip, and cron scheduled publish", async ({
    page,
    context,
    request,
    baseURL,
  }) => {
    const parsedBase = new URL(baseURL || "http://localhost:3917");
    const activeHostname = parsedBase.hostname;
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto("/en/login");
    await page.getByPlaceholder("admin@example.com").fill("e2e-admin@example.com");
    await page.getByPlaceholder("••••••••••••").fill("StrongE2ePass123!");
    await page.getByRole("button", { name: /Sign In/i }).click();
    await expect(page).toHaveURL(/\/(?:en\/)?admin/);

    const svgUploadRes = await page.request.post("/api/upload", {
      multipart: {
        file: {
          name: "xss.svg",
          mimeType: "image/svg+xml",
          buffer: Buffer.from('<svg xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)"><script>alert(1)</script></svg>'),
        },
      },
    });
    expect(svgUploadRes.status()).toBe(400);

    const pngUploadRes = await page.request.post("/api/upload", {
      multipart: {
        file: {
          name: "e2e-cover.png",
          mimeType: "image/png",
          buffer: Buffer.concat([VALID_PNG_BYTES, Buffer.from("<!--trailing-->")]),
        },
      },
    });
    expect(pngUploadRes.status()).toBe(200);
    const uploadJson = await pngUploadRes.json();
    expect(uploadJson.url).toMatch(/^\/api\/uploads\/sites\//);

    const servedPngRes = await page.request.get(uploadJson.url);
    expect(servedPngRes.status()).toBe(200);
    expect(servedPngRes.headers()["content-type"]).toContain("image/png");
    expect(servedPngRes.headers()["x-content-type-options"]).toBe("nosniff");

    await page.goto("/en/admin/media");
    await expect(page.getByText(/e2e-cover-/i).first()).toBeVisible({ timeout: 15_000 });
    await page.locator(".group").filter({ hasText: /e2e-cover-/i }).first().hover();
    await page.getByTitle("Preview").first().click();
    const expectedFullUrl = `${parsedBase.origin}${uploadJson.url}`;
    await expect(page.getByText(expectedFullUrl)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("link", { name: /^View$/i })).toHaveAttribute("href", expectedFullUrl);
    await page.getByRole("button", { name: "✕" }).click();

    await page.goto("/en/admin/sites");
    await page.getByRole("button", { name: /Create New Site/i }).first().click();
    await page.getByPlaceholder("e.g. Tech Blog").fill("E2E Second Blog");
    await page.getByPlaceholder("e.g. blog.mydomain.com or localhost:3000").fill("second.localhost:3917");
    await page.getByRole("button", { name: /^Create New Site$/i }).last().click();
    await expect(page.getByText("E2E Second Blog")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: /^Admin$/i }).first().click();
    await page.waitForTimeout(400);
    await page.reload();
    const cookiesAfterSiteB = await context.cookies();
    const siteBId = cookiesAfterSiteB.find((c) => c.name === "kotonoba_admin_site_id")?.value;
    expect(siteBId).toBeTruthy();
    sharedSiteBId = siteBId!;

    await page.getByRole("button", { name: /^Admin$/i }).first().click();
    await page.waitForTimeout(400);
    await page.reload();
    const cookiesAfterSiteA = await context.cookies();
    const siteAId = cookiesAfterSiteA.find((c) => c.name === "kotonoba_admin_site_id")?.value;
    expect(siteAId).toBeTruthy();
    expect(siteAId).not.toBe(siteBId);
    sharedSiteAId = siteAId!;

    await page.goto("/en/admin/users");
    const newUserButton = page.getByRole("button", { name: /New User/i });
    await expect(newUserButton).toBeVisible({ timeout: 15_000 });
    await newUserButton.click();

    const userDialog = page.getByRole("dialog");
    await expect(userDialog).toBeVisible({ timeout: 15_000 });

    const passwordInput = userDialog.locator('input[type="password"]').first();
    await expect(passwordInput).toBeVisible({ timeout: 15_000 });
    await userDialog.getByPlaceholder("e.g. Alex Rivera").fill("Tenant A Admin");
    await userDialog.getByPlaceholder("alex@example.com").fill("tenant-a@example.com");
    await passwordInput.fill("StrongTenantA123!");
    await userDialog.getByRole("button", { name: /Author - Can author/i }).click();
    await userDialog.getByRole("button", { name: /^Admin - Full access/i }).click();
    await userDialog.getByRole("button", { name: /Global Access/i }).click();
    await userDialog.getByRole("button", { name: /E2E Hardened Blog/i }).last().click();
    await userDialog.getByRole("button", { name: /^Save$/i }).click();
    await expect(page.getByText("tenant-a@example.com")).toBeVisible({ timeout: 15_000 });

    await context.clearCookies();
    await page.goto("/en/login");
    await page.getByPlaceholder("admin@example.com").fill("tenant-a@example.com");
    await page.getByPlaceholder("••••••••••••").fill("StrongTenantA123!");
    await page.getByRole("button", { name: /Sign In/i }).click();
    await expect(page).toHaveURL(/\/(?:en\/)?admin/);

    await context.addCookies([
      {
        name: "kotonoba_admin_site_id",
        value: siteBId!,
        domain: activeHostname,
        path: "/",
      },
    ]);
    await page.goto("/en/admin/posts");
    await expect(page.getByText("E2E Verified Post")).toBeVisible({ timeout: 15_000 });

    const crossSiteBackupRes = await page.request.get(`/api/backup/export?siteId=${siteBId}`);
    expect(crossSiteBackupRes.status()).toBe(403);

    const exportRes = await page.request.get(`/api/backup/export?siteId=${siteAId}`);
    expect(exportRes.status()).toBe(200);
    expect(exportRes.headers()["content-disposition"]).toContain(".kotonoba-backup");
    const archiveBytes = Buffer.from(await exportRes.body());
    expect(archiveBytes.subarray(0, 19).toString("utf8")).toBe("KOTONOBA-BACKUP-V1\n");

    const importRes = await page.request.post("/api/backup/import", {
      multipart: {
        siteId: siteAId!,
        mode: "merge",
        backup: {
          name: "site-a.kotonoba-backup",
          mimeType: "application/octet-stream",
          buffer: archiveBytes,
        },
      },
    });
    expect(importRes.status()).toBe(200);
    const importJson = await importRes.json();
    expect(importJson.success).toBe(true);

    await context.clearCookies();
    await page.goto("/en/login");
    await page.getByPlaceholder("admin@example.com").fill("e2e-admin@example.com");
    await page.getByPlaceholder("••••••••••••").fill("StrongE2ePass123!");
    await page.getByRole("button", { name: /Sign In/i }).click();
    await expect(page).toHaveURL(/\/(?:en\/)?admin/);

    await page.goto("/en/admin/posts/new");
    await page.getByPlaceholder("Article title…").first().fill("E2E Scheduled Post");
    await page.locator(".ProseMirror").first().click();
    await page.keyboard.type("Scheduled body via cron");
    await page.getByRole("button", { name: /Draft \(Hidden\)/i }).click();
    await page.getByRole("button", { name: /Scheduled \(Automatic publish\)/i }).click();
    await page.locator('input[type="datetime-local"]').fill("2099-01-01T00:00");
    await page.getByRole("button", { name: /Schedule Publication/i }).click();
    await expect(page).toHaveURL(/\/(?:en\/)?admin\/posts\/(?!new$)[a-zA-Z0-9_-]+$/, {
      timeout: 15_000,
    });

    const futureScheduledRes = await request.get("/en/entry/e2e-scheduled-post");
    expect(futureScheduledRes.status()).toBe(404);

    const unauthCronRes = await request.post("/api/cron/publish");
    expect(unauthCronRes.status()).toBe(401);

    const earlyCronRes = await request.post("/api/cron/publish", {
      headers: { Authorization: "Bearer e2e-cron-secret-key-123456" },
    });
    expect(earlyCronRes.status()).toBe(200);
    expect((await earlyCronRes.json()).publishedPostsCount).toBe(0);

    await page.locator('input[type="datetime-local"]').fill("2020-01-01T00:00");
    await Promise.all([
      page.waitForResponse(
        (res) =>
          res.request().method() === "POST" &&
          /\/admin\/posts\/(?!new$)[a-zA-Z0-9_-]+$/.test(new URL(res.url()).pathname) &&
          res.status() === 200
      ),
      page.getByRole("button", { name: /Schedule Publication/i }).click(),
    ]);

    await page.goto("/en/admin/settings/integrations");
    const blueskySwitch = page.getByRole("switch", { name: /Enable Bluesky auto-posting on publish/i });
    await expect(blueskySwitch).toHaveAttribute("aria-checked", "false");
    await blueskySwitch.click();
    await expect(blueskySwitch).toHaveAttribute("aria-checked", "true");
    await Promise.all([
      page.waitForResponse(
        (res) =>
          res.request().method() === "POST" &&
          res.url().includes("/admin/settings/integrations") &&
          res.status() === 200
      ),
      page.getByRole("button", { name: /^Save$/i }).click(),
    ]);
    await expect(page.getByText("Settings saved successfully!")).toBeVisible({ timeout: 10_000 });

    const authCronRes = await request.post("/api/cron/publish", {
      headers: { Authorization: "Bearer e2e-cron-secret-key-123456" },
    });
    expect(authCronRes.status()).toBe(200);
    const authCronJson = await authCronRes.json();
    expect(authCronJson.publishedPostsCount).toBe(1);
    expect(authCronJson.notificationsFailed).toBe(1);

    const repeatCronRes = await request.post("/api/cron/publish", {
      headers: { Authorization: "Bearer e2e-cron-secret-key-123456" },
    });
    expect(repeatCronRes.status()).toBe(200);
    const repeatCronJson = await repeatCronRes.json();
    expect(repeatCronJson.publishedPostsCount).toBe(0);
    expect(repeatCronJson.notificationsSent).toBe(0);
    expect(repeatCronJson.notificationsFailed).toBe(0);

    await blueskySwitch.click();
    await expect(blueskySwitch).toHaveAttribute("aria-checked", "false");
    await Promise.all([
      page.waitForResponse(
        (res) =>
          res.request().method() === "POST" &&
          res.url().includes("/admin/settings/integrations") &&
          res.status() === 200
      ),
      page.getByRole("button", { name: /^Save$/i }).click(),
    ]);

    await page.goto("/en/entry/e2e-scheduled-post");
    await expect(page.getByText("E2E Scheduled Post").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Scheduled body via cron")).toBeVisible();

    expect(pageErrors).toEqual([]);
  });

  test("verifies UI backup download/restore + archive pagination/i18n, custom page Mermaid XSS safety, nav javascript: stripping, self-export, and UI user site reassignment", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto("/en/login");
    await page.getByPlaceholder("admin@example.com").fill("e2e-admin@example.com");
    await page.getByPlaceholder("••••••••••••").fill("StrongE2ePass123!");
    await page.getByRole("button", { name: /Sign In/i }).click();
    await expect(page).toHaveURL(/\/(?:en\/)?admin/);

    await expect(page.locator('a[href="/api/users/me/export"]').first()).toBeVisible();
    const exportMeRes = await page.request.get("/api/users/me/export");
    expect(exportMeRes.status()).toBe(200);
    const exportMeJson = (await exportMeRes.json()) as {
      account: Record<string, unknown>;
      authoredPosts: Array<unknown>;
    };
    expect(exportMeJson.account.email).toBe("e2e-admin@example.com");
    expect("passwordHash" in exportMeJson.account).toBe(false);
    expect(exportMeJson.authoredPosts.length).toBeGreaterThanOrEqual(1);

    await page.goto("/en/admin/settings/backup");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /Download Encrypted Backup/i }).click(),
    ]);
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    const downloadedBytes = fs.readFileSync(downloadPath!);
    expect(downloadedBytes.subarray(0, 19).toString("utf8")).toBe("KOTONOBA-BACKUP-V1\n");

    const augmentedBytes = await buildAugmentedArchiveBuffer(downloadedBytes, 32);
    await page.locator('input[type="file"][accept*=".kotonoba-backup"]').setInputFiles({
      name: "augmented-archive.kotonoba-backup",
      mimeType: "application/octet-stream",
      buffer: augmentedBytes,
    });
    await page.getByRole("button", { name: /Restore from Archive/i }).click();
    await expect(page.getByText(/Backup restored successfully!/i)).toBeVisible({ timeout: 20_000 });

    await page.goto("/en/archive");
    const nextLink = page.locator('nav[aria-label="Pagination navigation"] a[rel="next"]');
    await expect(nextLink).toBeVisible();
    await expect(nextLink).toHaveText("Next");
    await nextLink.click();
    await expect(page).toHaveURL(/\/(?:en\/)?archive\?page=2/);
    const prevLink = page.locator('nav[aria-label="Pagination navigation"] a[rel="prev"]');
    await expect(prevLink).toBeVisible();
    await expect(prevLink).toHaveText("Previous");

    await page.goto("/es/archive?page=2");
    const esPrevLink = page.locator('nav[aria-label="Navegación por páginas"] a[rel="prev"]');
    await expect(esPrevLink).toBeVisible();
    await expect(esPrevLink).toHaveText("Anterior");

    await page.goto("/en/admin/pages/new");
    await page.getByPlaceholder("Article title…").first().fill("E2E Mermaid Page");
    const pageEditor = page.locator(".ProseMirror").first();
    await pageEditor.click();
    await page.keyboard.type("```mermaid ");
    await page.keyboard.type('graph TD\nA["<img src=x onerror=\'window.__xss=1\'>"]-->B\nclick B "javascript:window.__xss=2"');
    await page.getByRole("button", { name: /^Publish$/i }).click();
    await expect(page).toHaveURL(/\/(?:en\/)?admin\/pages\/(?!new$)[a-zA-Z0-9_-]+$/, {
      timeout: 15_000,
    });

    await page.goto("/en/p/e2e-mermaid-page");
    await expect(page.locator("svg[id^='mermaid-']").first()).toBeVisible({ timeout: 20_000 });
    const mermaidXss = await page.evaluate(() => (window as unknown as { __xss?: unknown }).__xss ?? null);
    expect(mermaidXss).toBeNull();

    await page.goto("/en/admin/settings/navigation");
    await page.getByRole("button", { name: /Add Link/i }).click();
    await page.getByPlaceholder("e.g. Tienda, Contacto").fill("Malicioso");
    await page.getByPlaceholder("e.g. Shop, Contact").fill("Evil Nav");
    await page.getByPlaceholder("https://... or /archive").fill("javascript:alert(1)");
    await page.getByRole("button", { name: /^Save$/i }).click();
    await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0);

    await page.goto("/en/admin/users");
    const tenantRow = page.locator("tr", { hasText: "tenant-a@example.com" }).first();
    await expect(tenantRow).toBeVisible({ timeout: 15_000 });
    await tenantRow.getByRole("button").first().click();
    const editDialog = page.getByRole("dialog");
    await expect(editDialog).toBeVisible({ timeout: 10_000 });
    await editDialog.getByRole("button", { name: /E2E Second Blog/i }).last().click();
    await editDialog.getByRole("button", { name: /^Save$/i }).click();

    expect(sharedSiteAId).toBeTruthy();
    expect(sharedSiteBId).toBeTruthy();
    expect(pageErrors).toEqual([]);
  });
});