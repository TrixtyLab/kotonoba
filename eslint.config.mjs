import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    settings: {
      react: {
        version: "19",
      },
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "react/no-danger": "error",
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    // Tenant media and editor previews use arbitrary remote URLs and unknown
    // dimensions; the self-hosted deployment does not run the Next.js image
    // optimizer, so plain <img> is the intended primitive.
    files: ["src/**/*.tsx"],
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
  {
    // App Router loads the font stylesheet from the root layout <head>; the
    // no-page-custom-font rule targets the legacy Pages Router document.
    files: ["src/app/layout.tsx"],
    rules: {
      "@next/next/no-page-custom-font": "off",
    },
  },
  {
    files: ["src/components/SafeHtml.tsx", "src/components/SafeSvg.tsx", "src/components/SafeCustomCss.tsx"],
    rules: {
      "react/no-danger": "off",
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/config/**"],
    rules: {
      "no-restricted-properties": [
        "error",
        {
          object: "process",
          property: "env",
          message: "Read runtime environment variables through src/lib/config/env.ts or src/lib/config/secrets.ts.",
        },
      ],
    },
  },
  {
    files: ["src/actions/**/*.{ts,tsx}"],
    rules: {
      "max-lines": [
        "error",
        {
          max: 150,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/db", "@/lib/db/*", "better-sqlite3", "drizzle-orm"],
              message: "Server Actions must stay thin adapters delegating persistence to src/lib/services/*.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/components/**/*.{ts,tsx}"],
    rules: {
      "max-lines": [
        "error",
        {
          max: 450,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      complexity: ["error", 15],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/lib/db",
                "@/lib/db/*",
                "better-sqlite3",
                "drizzle-orm",
                "@/lib/config/secrets",
                "@/lib/security/crypto",
                "@/lib/storage",
                "@/lib/storage/*",
              ],
              message: "UI components must not import database internals, storage backends, or secret cryptography modules.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/lib/**/*.{ts,tsx}"],
    rules: {
      "max-lines": [
        "error",
        {
          max: 450,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      complexity: ["error", 15],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/components/*"],
              message: "Core domain libraries in src/lib must remain independent of UI components.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/hooks/**/*.{ts,tsx}"],
    rules: {
      "max-lines": [
        "error",
        {
          max: 450,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      complexity: ["error", 15],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/lib/db",
                "@/lib/db/*",
                "better-sqlite3",
                "drizzle-orm",
                "@/lib/config/secrets",
                "@/lib/security/crypto",
                "@/lib/storage",
                "@/lib/storage/*",
              ],
              message: "Client hooks must not import database internals, storage backends, or secret cryptography modules.",
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      "src/app/[locale]/**/*.{ts,tsx}",
      "src/app/robots.ts",
      "src/app/sitemap.ts",
      "src/app/feed.xml/route.ts",
      "src/app/llms.txt/route.ts",
      "src/app/llms-full.txt/route.ts",
    ],
    rules: {
      "max-lines": [
        "error",
        {
          max: 450,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      complexity: ["error", 15],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/db", "@/lib/db/*", "better-sqlite3", "drizzle-orm"],
              message: "App pages and public SEO/feed entrypoints must delegate SQL queries to src/lib/queries/* or src/lib/services/*.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-e2e/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
