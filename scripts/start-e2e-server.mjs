import fs from "fs";
import path from "path";
import { spawn } from "child_process";

const rootDir = process.cwd();
const standaloneDir = path.join(rootDir, ".next", "standalone");
const standaloneServer = path.join(standaloneDir, "server.js");
const port = process.env.PORT || "3917";

function canUseStandaloneServer() {
  if (process.platform === "win32" || !fs.existsSync(standaloneServer)) {
    return false;
  }
  return true;
}

if (canUseStandaloneServer()) {
  const staticSrc = path.join(rootDir, ".next", "static");
  const staticDest = path.join(standaloneDir, ".next", "static");
  if (fs.existsSync(staticSrc)) {
    fs.mkdirSync(path.dirname(staticDest), { recursive: true });
    fs.cpSync(staticSrc, staticDest, { recursive: true, force: true });
  }

  const publicSrc = path.join(rootDir, "public");
  const publicDest = path.join(standaloneDir, "public");
  if (fs.existsSync(publicSrc)) {
    fs.cpSync(publicSrc, publicDest, { recursive: true, force: true });
  }

  const child = spawn(process.execPath, [standaloneServer], {
    cwd: standaloneDir,
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "production",
      HOSTNAME: "localhost",
      PORT: port,
    },
  });

  process.on("SIGINT", () => child.kill("SIGINT"));
  process.on("SIGTERM", () => child.kill("SIGTERM"));
  child.on("exit", (code) => process.exit(code ?? 0));
} else {
  const nextBin = path.join(rootDir, "node_modules", "next", "dist", "bin", "next");
  const devEnv = { ...process.env };
  delete devEnv.NODE_ENV;

  const child = spawn(
    process.execPath,
    [nextBin, "dev", "--webpack", "-p", port, "-H", "localhost"],
    {
      cwd: rootDir,
      stdio: "inherit",
      env: {
        ...devEnv,
        NEXT_DIST_DIR: devEnv.NEXT_DIST_DIR || ".next-e2e",
        HOSTNAME: "localhost",
        PORT: port,
      },
    }
  );

  process.on("SIGINT", () => child.kill("SIGINT"));
  process.on("SIGTERM", () => child.kill("SIGTERM"));
  child.on("exit", (code) => process.exit(code ?? 0));
}
