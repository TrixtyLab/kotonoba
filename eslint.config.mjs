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
    },
  },
  {
    files: ["src/components/SafeHtml.tsx", "src/components/SafeSvg.tsx"],
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
        "warn",
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
