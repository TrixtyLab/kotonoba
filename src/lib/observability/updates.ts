import fs from "fs";
import path from "path";
import packageJson from "../../../package.json";
import { getAppVersionEnv } from "@/lib/config/env";

/**
 * Information regarding the current installation status and remote GitHub releases for Kotonoba.
 */
export interface UpdateInfo {
  /** Flag denoting whether a newer release version is available on GitHub. */
  updateAvailable: boolean;
  /** Currently installed SemVer version string read from package.json or process environment. */
  currentVersion: string;
  /** Latest published release SemVer version string from GitHub. */
  latestVersion: string;
  /** Direct link to the GitHub release page. */
  releaseUrl: string;
  /** Direct link to the published container image registry packages. */
  containerUrl: string;
}

/**
 * Reads the current application version dynamically from environment variables or package.json on disk.
 *
 * @returns The active SemVer version string.
 */
export async function getCurrentVersion(): Promise<string> {
  const envVersion = getAppVersionEnv();
  if (envVersion) {
    return envVersion;
  }
  try {
    const pkgPath = path.resolve(process.cwd(), "package.json");
    if (fs.existsSync(pkgPath)) {
      const raw = fs.readFileSync(pkgPath, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed.version && typeof parsed.version === "string") {
        return parsed.version.trim();
      }
    }
  } catch {
    // Fall back to bundled package.json
  }
  return packageJson.version || "1.0.19";
}

function compareSemver(v1: string, v2: string): number {
  const parse = (v: string): number[] =>
    v
      .trim()
      .replace(/^[^\d]*/, "")
      .split(/[-+]/)[0]
      .split(".")
      .map((seg) => parseInt(seg, 10) || 0);

  const p1 = parse(v1);
  const p2 = parse(v2);
  const maxLen = Math.max(p1.length, p2.length);

  for (let i = 0; i < maxLen; i++) {
    const a = p1[i] || 0;
    const b = p2[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }

  return 0;
}

async function fetchLatestPackageVersion(): Promise<string | null> {
  try {
    const rawRes = await fetch("https://raw.githubusercontent.com/TrixtyLab/kotonoba/master/package.json", {
      headers: { "User-Agent": "Kotonoba-CMS" },
      cache: "no-store",
    });
    if (rawRes.ok) {
      const rawPkg = await rawRes.json();
      if (rawPkg.version && typeof rawPkg.version === "string") {
        return rawPkg.version.trim();
      }
    }
  } catch {
    // Offline fallback handled by caller
  }
  return null;
}

/**
 * Checks for updates to the Kotonoba application by querying the official GitHub Releases API with CDN fallback.
 *
 * @returns Update status metrics and release URLs.
 */
export async function checkForUpdates(): Promise<UpdateInfo> {
  const currentVersion = await getCurrentVersion();
  const defaultContainerUrl = "https://github.com/TrixtyLab/kotonoba/pkgs/container/kotonoba";
  const defaultReleaseUrl = "https://github.com/TrixtyLab/kotonoba/releases";

  let latestVersion = currentVersion;
  let releaseUrl = defaultReleaseUrl;

  try {
    const res = await fetch("https://api.github.com/repos/TrixtyLab/kotonoba/releases/latest", {
      headers: {
        "User-Agent": "Kotonoba-CMS",
        Accept: "application/vnd.github.v3+json",
      },
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      const rawTag = typeof data.tag_name === "string" ? data.tag_name : "";
      const parsedVersion = rawTag.replace(/^v/i, "").trim();
      if (parsedVersion) {
        latestVersion = parsedVersion;
        if (data.html_url) {
          releaseUrl = data.html_url;
        }
      }
    } else {
      const rawVersion = await fetchLatestPackageVersion();
      if (rawVersion) latestVersion = rawVersion;
    }
  } catch {
    const rawVersion = await fetchLatestPackageVersion();
    if (rawVersion) latestVersion = rawVersion;
  }

  return {
    updateAvailable: compareSemver(latestVersion, currentVersion) > 0,
    currentVersion,
    latestVersion,
    releaseUrl,
    containerUrl: defaultContainerUrl,
  };
}
