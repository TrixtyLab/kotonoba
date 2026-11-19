import fs from "fs";
import os from "os";
import path from "path";
import { defineConfig, devices } from "@playwright/test";

const port = process.env.E2E_PORT || "3917";
const baseURL = `http://localhost:${port}`;

const e2eRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kotonoba-e2e-"));
const dbPath = path.join(e2eRoot, "e2e.db");
const uploadDir = path.join(e2eRoot, "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const edgeWin64 = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const edgeWinArm = "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe";
const hasSystemEdge =
  !process.env.CI && (fs.existsSync(edgeWin64) || fs.existsSync(edgeWinArm));

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: {
    timeout: 15_000,
  },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(hasSystemEdge ? { channel: "msedge" } : {}),
      },
    },
  ],
  webServer: {
    command: "node ./scripts/start-e2e-server.mjs",
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 90_000,
    env: {
      ...process.env,
      PORT: port,
      HOSTNAME: "localhost",
      ADMIN_DOMAIN: "",
      SITE_URL: baseURL,
      DB_PATH: dbPath,
      UPLOAD_DIR: uploadDir,
      JWT_SECRET: "e2e-jwt-secret-key-minimum-32-characters!!",
      ENCRYPTION_KEY: "e2e-encryption-secret-key-minimum-32chars!!",
      BACKUP_ENCRYPTION_KEY: Buffer.alloc(32, 0x51).toString("base64"),
      CRON_SECRET: "e2e-cron-secret-key-123456",
      CSP_MODE: "report-only",
      SINGLE_TENANT_FALLBACK: "false",
    },
  },
});
