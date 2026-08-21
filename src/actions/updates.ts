"use server";

import packageJson from "../../package.json";

/**
 * Information regarding the current installation status and remote GitHub releases for Kotonoba.
 */
export interface UpdateInfo {
  /** Flag denoting whether a newer release version is available on GitHub. */
  updateAvailable: boolean;
  /** Currently installed SemVer version string read from package.json. */
  currentVersion: string;
  /** Latest published release SemVer version string from GitHub. */
  latestVersion: string;
  /** Direct link to the GitHub release page. */
  releaseUrl: string;
  /** Direct link to the published container image registry packages. */
  containerUrl: string;
}

/**
 * Compares two Semantic Versioning strings (e.g., '1.0.10' vs '1.0.9').
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
 * Checks for updates to the Kotonoba application by querying the official GitHub Releases API.
 * Compares the latest remote release tag with the currently installed version from package.json.
 *
 * @returns {Promise<UpdateInfo>} A promise resolving to the update status and container registry URLs.
 */
export async function checkForUpdates(): Promise<UpdateInfo> {
  const currentVersion = packageJson.version || "1.0.0";
  const defaultContainerUrl = "https://github.com/TrixtyLab/kotonoba/pkgs/container/kotonoba";

  try {
    const res = await fetch("https://api.github.com/repos/TrixtyLab/kotonoba/releases/latest", {
      headers: {
        "User-Agent": "Kotonoba-CMS",
        Accept: "application/vnd.github.v3+json",
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return {
        updateAvailable: false,
        currentVersion,
        latestVersion: currentVersion,
        releaseUrl: "https://github.com/TrixtyLab/kotonoba/releases",
        containerUrl: defaultContainerUrl,
      };
    }

    const data = await res.json();
    const rawTag = typeof data.tag_name === "string" ? data.tag_name : "";
    const latestVersion = rawTag.replace(/^v/i, "").trim();

    if (!latestVersion) {
      return {
        updateAvailable: false,
        currentVersion,
        latestVersion: currentVersion,
        releaseUrl: data.html_url || "https://github.com/TrixtyLab/kotonoba/releases",
        containerUrl: defaultContainerUrl,
      };
    }

    const hasNewerVersion = compareSemver(latestVersion, currentVersion) > 0;

    return {
      updateAvailable: hasNewerVersion,
      currentVersion,
      latestVersion,
      releaseUrl: data.html_url || "https://github.com/TrixtyLab/kotonoba/releases",
      containerUrl: defaultContainerUrl,
    };
  } catch {
    return {
      updateAvailable: false,
      currentVersion,
      latestVersion: currentVersion,
      releaseUrl: "https://github.com/TrixtyLab/kotonoba/releases",
      containerUrl: defaultContainerUrl,
    };
  }
}
