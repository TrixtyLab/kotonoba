import { test, expect } from "@playwright/test";

const VALID_PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

test.describe.serial("Kotonoba End-to-End Security, Setup Lockout & Publishing Flows", () => {
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

    // 1. Unauthenticated /en/admin redirects to login
    await page.goto("/en/admin");
    await expect(page).toHaveURL(/\/(?:en\/)?login/);

    // 2. Forged non-JWT access_token cookie still redirects to login
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

    // 3. Drive Setup Wizard end-to-end
    await page.goto("/en/setup");
    await page.getByPlaceholder("e.g. Alexander Vance").fill("E2E Admin");
    await page.getByPlaceholder("admin@example.com").fill("e2e-admin@example.com");
    await page.getByPlaceholder("••••••••••••").fill("StrongE2ePass123!");
    await page.getByRole("button", { name: /Continue/i }).click();

    await page.getByPlaceholder("My Tech Blog").fill("E2E Hardened Blog");
    await page.getByPlaceholder("blog.mydomain.com or localhost:3000").fill(activeHost);
    await page.getByRole("button", { name: /Continue/i }).click();

    // Step 3 -> Step 4 -> Initialize
    await page.getByRole("button", { name: /Continue/i }).click();
    await page.getByRole("button", { name: /Initialize & Publish/i }).click();

    await expect(page.getByText(/Your Blog is Ready & Live!/i)).toBeVisible({ timeout: 15_000 });

    // 4. Attempting to revisit /en/setup or POST /api/setup fails closed once admin exists
    const lockedSetupApi = await page.request.post("/api/setup", { data: {} });
    expect(lockedSetupApi.status()).toBe(403);
    await page.goto("/en/setup");
    await expect(page).toHaveURL(/\/(?:en\/)?login/);

    // Setup prompt link is hidden on login once initialized
    await expect(page.getByText(/First time\? Launch Setup Wizard/i)).toHaveCount(0);

    // Clear auto-provisioned session cookies so Step 5 tests explicit login end-to-end
    await context.clearCookies();

    // 5. Log in via Login form
    await page.getByPlaceholder("admin@example.com").fill("e2e-admin@example.com");
    await page.getByPlaceholder("••••••••••••").fill("StrongE2ePass123!");
    await page.getByRole("button", { name: /Sign In/i }).click();

    await expect(page).toHaveURL(/\/(?:en\/)?admin/);

    // 6. Visit Audit Log workspace cleanly
    await page.goto("/en/admin/audit");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // 7. Create a post via TipTap UI with literal script/HTML text and verify safe non-executing render
    await page.goto("/en/admin/posts/new");
    await page.getByPlaceholder("Article title…").first().fill("E2E Verified Post");
    const editorArea = page.locator(".ProseMirror").first();
    await editorArea.click();
    await page.keyboard.type('Clean body text <img src=x onerror="window.__xss=1">');
    await page.getByRole("button", { name: /^Publish$/i }).click();
    await expect(page).toHaveURL(/\/(?:en\/)?admin\/posts\/[a-zA-Z0-9_-]+/, { timeout: 15_000 });

    // 8. Visit public blog home and published article
    await page.goto("/en");
    const postHeadingLink = page.getByRole("heading", { name: "E2E Verified Post" }).getByRole("link");
    await expect(postHeadingLink).toBeVisible();
    await postHeadingLink.click();
    await expect(page).toHaveURL(/\/(?:en\/)?entry\/e2e-verified-post/, { timeout: 20_000 });
    await expect(page.getByText("Clean body text")).toBeVisible({ timeout: 20_000 });
    const xssTriggered = await page.evaluate(() => (window as unknown as { __xss?: unknown }).__xss ?? null);
    expect(xssTriggered).toBeNull();

    // Assert zero uncaught client exceptions across the entire flow
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

    // 1. Authenticate as Super Admin
    await page.goto("/en/login");
    await page.getByPlaceholder("admin@example.com").fill("e2e-admin@example.com");
    await page.getByPlaceholder("••••••••••••").fill("StrongE2ePass123!");
    await page.getByRole("button", { name: /Sign In/i }).click();
    await expect(page).toHaveURL(/\/(?:en\/)?admin/);

    // 2. SVG upload rejected (400) & genuine PNG re-encoded + served with nosniff + listed in Media UI
    const svgUploadRes = await page.request.post("/api/upload", {
      multipart: {
        file: {
          name: "xss.svg",
          mimeType: "image/svg+xml",
          buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
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

    // 3. Provision Site B and capture both site IDs cleanly via switcher cookie
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

    // Switch back to Site A cleanly
    await page.getByRole("button", { name: /^Admin$/i }).first().click();
    await page.waitForTimeout(400);
    await page.reload();
    const cookiesAfterSiteA = await context.cookies();
    const siteAId = cookiesAfterSiteA.find((c) => c.name === "kotonoba_admin_site_id")?.value;
    expect(siteAId).toBeTruthy();
    expect(siteAId).not.toBe(siteBId);

    // 4. Create Site-A-scoped Admin user and verify tampered cookie cannot access Site B
    await page.goto("/en/admin/users");
    await page.getByRole("button", { name: /New User/i }).click();
    const userDialog = page.getByRole("dialog");
    await userDialog.getByPlaceholder("e.g. Alex Rivera").fill("Tenant A Admin");
    await userDialog.getByPlaceholder("alex@example.com").fill("tenant-a@example.com");
    await userDialog.getByPlaceholder("Minimum 8 characters").fill("StrongTenantA123!");
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

    // 5. Encrypted backup export & merge restore on Site A
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

    // 6. Schedule a future post (must stay 404 + skipped by cron), then backdate due timestamp & publish via protected cron
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
    await expect(page).toHaveURL(/\/(?:en\/)?admin\/posts\/[a-zA-Z0-9_-]+/, { timeout: 15_000 });

    const futureScheduledRes = await request.get("/en/entry/e2e-scheduled-post");
    expect(futureScheduledRes.status()).toBe(404);

    const unauthCronRes = await request.post("/api/cron/publish");
    expect(unauthCronRes.status()).toBe(401);

    const earlyCronRes = await request.post("/api/cron/publish", {
      headers: { Authorization: "Bearer e2e-cron-secret-key-123456" },
    });
    expect(earlyCronRes.status()).toBe(200);
    expect((await earlyCronRes.json()).publishedPostsCount).toBe(0);

    // Backdate scheduled date so the post becomes due, then publish once via cron
    await page.locator('input[type="datetime-local"]').fill("2020-01-01T00:00");
    await page.getByRole("button", { name: /Schedule Publication/i }).click();
    await page.waitForTimeout(500);

    const authCronRes = await request.post("/api/cron/publish", {
      headers: { Authorization: "Bearer e2e-cron-secret-key-123456" },
    });
    expect(authCronRes.status()).toBe(200);
    expect((await authCronRes.json()).publishedPostsCount).toBe(1);

    const repeatCronRes = await request.post("/api/cron/publish", {
      headers: { Authorization: "Bearer e2e-cron-secret-key-123456" },
    });
    expect(repeatCronRes.status()).toBe(200);
    expect((await repeatCronRes.json()).publishedPostsCount).toBe(0);

    await page.goto("/en/entry/e2e-scheduled-post");
    await expect(page.getByText("E2E Scheduled Post").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Scheduled body via cron")).toBeVisible();

    expect(pageErrors).toEqual([]);
  });
});
