"use server";

import fs from "fs";
import path from "path";
import packageJson from "../../package.json";

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
 * @returns {string} The active SemVer version string.
 */
export async function getCurrentVersion(): Promise<string> {
  if (process.env.APP_VERSION) {
    return process.env.APP_VERSION.trim();
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

/**
 * Compares two Semantic Versioning strings (e.g., '1.0.13' vs '1.0.12').
 *
 * @param {string} v1 - First version string.
 * @param {string} v2 - Second version string to compare against.
 * @returns {number} 1 if v1 is greater, -1 if v2 is greater, or 0 if equal.
 */
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

/**
 * Checks for updates to the Kotonoba application by querying the official GitHub Releases API with CDN fallback.
 * Compares the latest remote release tag with the currently installed version.
 *
 * @returns {Promise<UpdateInfo>} A promise resolving to the update status and release URLs.
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
      // Fallback to raw repository package.json to bypass potential GitHub API 60 req/hr rate limits
      const rawRes = await fetch("https://raw.githubusercontent.com/TrixtyLab/kotonoba/master/package.json", {
        headers: { "User-Agent": "Kotonoba-CMS" },
        cache: "no-store",
      });
      if (rawRes.ok) {
        const rawPkg = await rawRes.json();
        if (rawPkg.version && typeof rawPkg.version === "string") {
          latestVersion = rawPkg.version.trim();
        }
      }
    }
  } catch {
    try {
      const rawRes = await fetch("https://raw.githubusercontent.com/TrixtyLab/kotonoba/master/package.json", {
        headers: { "User-Agent": "Kotonoba-CMS" },
        cache: "no-store",
      });
      if (rawRes.ok) {
        const rawPkg = await rawRes.json();
        if (rawPkg.version && typeof rawPkg.version === "string") {
          latestVersion = rawPkg.version.trim();
        }
      }
    } catch {
      // Offline fallback: keep latestVersion equal to currentVersion
    }
  }

  const hasNewerVersion = compareSemver(latestVersion, currentVersion) > 0;

  return {
    updateAvailable: hasNewerVersion,
    currentVersion,
    latestVersion,
    releaseUrl,
    containerUrl: defaultContainerUrl,
  };
}
