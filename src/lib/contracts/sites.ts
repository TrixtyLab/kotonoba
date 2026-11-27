import { z } from "zod";
import { LOCALES } from "@/i18n/locales";

/** Schema validating blog site parameters, branding, and navigation configuration. */
export const siteSchema = z.object({
  name: z.string().min(1).max(5000),
  domain: z.string().min(1).max(500),
  subtitle: z.string().max(5000).default(""),
  description: z.string().max(5000).default(""),
  logoUrl: z.string().max(2000).optional().nullable(),
  faviconUrl: z.string().max(2000).optional().nullable(),
  locale: z.enum(LOCALES).default("en"),
  theme: z.enum(["dark", "light"]).default("dark"),
  customCss: z.string().max(50000).optional().nullable(),
  primaryColor: z.string().max(7).default("#6366f1"),
  fontFamily: z.string().max(100).default("Inter"),
  navLinks: z.string().default("[]"),
  navAlignment: z.enum(["left", "center", "right"]).default("left"),
  supportedLocales: z.string().max(2000).optional().nullable(),
});

/** Inferred payload type validated by {@link siteSchema}. */
export type SiteInput = z.infer<typeof siteSchema>;
