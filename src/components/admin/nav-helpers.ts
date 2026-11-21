import { AVAILABLE_NAV_ICONS } from "@/components/blog/NavIcon";

/** Configuration structure for a custom navigation link item. */
export interface NavItemConfig {
  /** Unique item identifier. */
  id: string;
  /** Primary label fallback string. */
  label: string;
  /** Spanish label string. */
  label_es?: string;
  /** English label string. */
  label_en?: string;
  /** Multilingual dictionary of labels. */
  labels?: Record<string, string>;
  /** Destination route path or external URL. */
  url: string;
  /** Lucide icon identifier string. */
  icon?: string;
  /** Window target attribute (_self or _blank). */
  target?: "_self" | "_blank";
  /** Flag preventing deletion/modification of the core Home link. */
  isFixed?: boolean;
  /** Flag distinguishing social media icon links from standard text links. */
  isSocial?: boolean;
}

/**
 * Parses serialized navigation link JSON while pinning the immutable Home entry at index 0.
 */
export function parseInitialNavItems(initialLinks: string | null | undefined, homeLabel: string): NavItemConfig[] {
  const defaultHome: NavItemConfig = { id: "home", label: homeLabel, url: "/", isFixed: true };
  if (!initialLinks) return [defaultHome];

  try {
    const parsed = JSON.parse(initialLinks);
    if (!Array.isArray(parsed) || parsed.length === 0) return [defaultHome];

    const nonHome = parsed
      .filter((item) => item.id !== "home" && item.url !== "/" && !item.isFixed)
      .map((item) => {
        if (!item.isSocial) return item;
        const rest = { ...item };
        delete rest.label_es;
        delete rest.label_en;
        delete rest.labels;
        return rest;
      });
    return [defaultHome, ...nonHome];
  } catch {
    return [defaultHome];
  }
}

export interface BuildNavItemInput {
  editingId: string | null;
  linkMode: "custom" | "page" | "social";
  selectedPage?: { id: string; title: string; slug: string };
  itemIsSocial: boolean;
  itemIcon: string;
  itemUrl: string;
  itemTarget: "_self" | "_blank";
  itemLabelEs: string;
  itemLabelEn: string;
}

function buildPageNavItem(input: BuildNavItemInput, existing?: NavItemConfig): NavItemConfig | { errorKey: "choosePage" } {
  if (!input.selectedPage) return { errorKey: "choosePage" };
  const { title, slug } = input.selectedPage;
  return {
    id: existing?.id || `custom_${Date.now()}`,
    label: title,
    label_es: title,
    label_en: title,
    labels: { es: title, en: title },
    url: `/p/${slug}`,
    icon: undefined,
    target: "_self",
    isSocial: false,
  };
}

function buildSocialNavItem(input: BuildNavItemInput, existing?: NavItemConfig): NavItemConfig {
  const selectedIconObj = AVAILABLE_NAV_ICONS.find((ico) => ico.id === input.itemIcon);
  const socialLabel = selectedIconObj?.label || (input.itemIcon !== "none" ? input.itemIcon : "Social");
  return {
    id: existing?.id || `custom_${Date.now()}`,
    label: socialLabel,
    url: existing?.isFixed ? existing.url : input.itemUrl.trim(),
    icon: input.itemIcon === "none" ? "link" : input.itemIcon,
    target: existing?.isFixed ? "_self" : input.itemTarget,
    isSocial: true,
  };
}

function buildCustomNavItem(input: BuildNavItemInput, existing?: NavItemConfig): NavItemConfig | { errorKey: "navLabel" } {
  const mainLabel = input.itemLabelEs.trim() || input.itemLabelEn.trim();
  if (!mainLabel) return { errorKey: "navLabel" };
  const labels = {
    es: input.itemLabelEs.trim() || mainLabel,
    en: input.itemLabelEn.trim() || mainLabel,
  };
  return {
    id: existing?.id || `custom_${Date.now()}`,
    label: mainLabel,
    label_es: labels.es,
    label_en: labels.en,
    labels,
    url: existing?.isFixed ? existing.url : input.itemUrl.trim(),
    icon: undefined,
    target: existing?.isFixed ? "_self" : input.itemTarget,
    isSocial: false,
  };
}

/**
 * Builds an updated `NavItemConfig` entry for custom, internal page, or social menu items.
 */
export function buildNavItemEntry(
  input: BuildNavItemInput,
  existing?: NavItemConfig
): NavItemConfig | { errorKey: "choosePage" | "navLabel" } {
  if (input.linkMode === "page") return buildPageNavItem(input, existing);
  if (input.itemIsSocial) return buildSocialNavItem(input, existing);
  return buildCustomNavItem(input, existing);
}
