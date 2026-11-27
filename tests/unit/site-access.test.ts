import { describe, it, expect, afterEach, vi } from "vitest";
import { canAccessSite } from "@/lib/auth/site-access";
import {
  canManageBackups,
  canManageSettings,
  canManageSites,
  canManageUsers,
} from "@/lib/auth/roles";
import { getRequestHost } from "@/lib/http/request";
import { taxonomyBelongsToSite } from "@/lib/db/tenant-scope";
import { sites, categories, tags } from "@/lib/db/schema";
import { createTempDb, type TempDbContext } from "../helpers/db";

describe("tenant isolation and site access", () => {
  let ctx: TempDbContext | null = null;

  afterEach(() => {
    vi.unstubAllEnvs();
    ctx?.cleanup();
    ctx = null;
  });

  it("enforces role capabilities and ignores untrusted x-forwarded-host headers", () => {
    expect(canManageSites("super_admin")).toBe(true);
    expect(canManageSites("admin")).toBe(false);
    expect(canManageBackups("admin")).toBe(true);
    expect(canManageBackups("editor")).toBe(false);
    expect(canManageSettings("author")).toBe(false);
    expect(canManageUsers("admin")).toBe(true);

    const spoofedHeaders = new Headers({
      host: "public-blog.example.com",
      "x-forwarded-host": "localhost:3000",
    });

    vi.stubEnv("TRUSTED_PROXY_IPS", "");
    expect(getRequestHost(spoofedHeaders)).toBe("public-blog.example.com");

    vi.stubEnv("TRUSTED_PROXY_IPS", "127.0.0.1");
    expect(getRequestHost(spoofedHeaders)).toBe("localhost:3000");
  });

  it("enforces role and site ownership in canAccessSite", () => {
    expect(canAccessSite({ role: "super_admin", siteId: null }, "site-b")).toBe(true);
    expect(canAccessSite({ role: "admin", siteId: "site-a" }, "site-a")).toBe(true);
    expect(canAccessSite({ role: "admin", siteId: "site-a" }, "site-b")).toBe(false);
    expect(canAccessSite({ role: "editor", siteId: null }, "site-a")).toBe(false);
    expect(canAccessSite({ role: "author", siteId: "site-a" }, "")).toBe(false);
  });

  it("rejects taxonomy IDs belonging to a different tenant site", () => {
    ctx = createTempDb();
    const { db } = ctx;
    const now = new Date();

    db.insert(sites)
      .values([
        { id: "site-a", domain: "a.example.com", name: "Site A", createdAt: now, updatedAt: now },
        { id: "site-b", domain: "b.example.com", name: "Site B", createdAt: now, updatedAt: now },
      ])
      .run();

    db.insert(categories)
      .values([
        { id: "cat-a", siteId: "site-a", name: "Tech A", slug: "tech-a" },
        { id: "cat-b", siteId: "site-b", name: "Tech B", slug: "tech-b" },
      ])
      .run();

    db.insert(tags)
      .values([
        { id: "tag-a", siteId: "site-a", name: "Tag A", slug: "tag-a" },
        { id: "tag-b", siteId: "site-b", name: "Tag B", slug: "tag-b" },
      ])
      .run();

    expect(taxonomyBelongsToSite("site-a", ["cat-a"], ["tag-a"])).toBe(true);
    expect(taxonomyBelongsToSite("site-a", ["cat-a", "cat-a"], [])).toBe(true);
    expect(taxonomyBelongsToSite("site-a", ["cat-b"], [])).toBe(false);
    expect(taxonomyBelongsToSite("site-a", [], ["tag-b"])).toBe(false);
  });
});
