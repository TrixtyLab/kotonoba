import { MetadataRoute } from "next";
import { getDb } from "@/lib/db";
import { sites } from "@/lib/db/schema";

/**
 * Generates dynamic robots.txt adhering to crawl budget guidelines.
 */
export default function robots(): MetadataRoute.Robots {
  const db = getDb();
  const primarySite = db.select().from(sites).limit(1).get();
  const baseUrl = primarySite ? `https://${primarySite.domain}` : (process.env.SITE_URL || "http://localhost:3000");

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/entry/*", "/category/*", "/tag/*", "/archive"],
        disallow: ["/admin/", "/api/", "/setup/", "/login"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
