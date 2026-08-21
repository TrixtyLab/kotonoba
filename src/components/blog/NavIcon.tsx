import React from "react";
import { Globe, Disc, ShoppingBag, Mail, Link as LinkIcon, Rss } from "lucide-react";
import {
  FaXTwitter, FaYoutube, FaFacebook, FaInstagram, FaGithub,
  FaDiscord, FaTiktok, FaTwitch, FaLinkedin, FaSpotify,
  FaBluesky, FaSteam, FaTelegram, FaThreads, FaReddit, FaMastodon, FaPatreon
} from "react-icons/fa6";

/**
 * Properties for rendering custom navigation icons.
 */
export interface NavIconProps {
  /** Icon identifier name. */
  name?: string | null;
  /** Custom CSS classes for dimensions and color. */
  className?: string;
}

/** Predefined catalog of selectable icons for navigation links. */
export const AVAILABLE_NAV_ICONS = [
  { id: "twitter", label: "X / Twitter", category: "Social" },
  { id: "bluesky", label: "Bluesky", category: "Social" },
  { id: "github", label: "GitHub", category: "Social" },
  { id: "discord", label: "Discord", category: "Social" },
  { id: "youtube", label: "YouTube", category: "Social" },
  { id: "twitch", label: "Twitch", category: "Social" },
  { id: "steam", label: "Steam", category: "Social" },
  { id: "instagram", label: "Instagram", category: "Social" },
  { id: "threads", label: "Threads", category: "Social" },
  { id: "tiktok", label: "TikTok", category: "Social" },
  { id: "telegram", label: "Telegram", category: "Social" },
  { id: "reddit", label: "Reddit", category: "Social" },
  { id: "mastodon", label: "Mastodon", category: "Social" },
  { id: "patreon", label: "Patreon", category: "Social" },
  { id: "linkedin", label: "LinkedIn", category: "Social" },
  { id: "spotify", label: "Spotify", category: "Social" },
  { id: "facebook", label: "Facebook", category: "Social" },
  { id: "rss", label: "RSS Feed", category: "General" },
  { id: "globe", label: "Web / Sitio", category: "General" },
  { id: "shopping-bag", label: "Tienda / Shop", category: "General" },
  { id: "disc", label: "Música / Disco", category: "General" },
  { id: "mail", label: "Contacto / Email", category: "General" },
  { id: "link", label: "Enlace Externo", category: "General" },
];

/**
 * Dynamic polymorphic icon renderer resolving social and generic navigation icons by string identifier.
 *
 * @param props - NavIconProps specifying the icon name and style classes.
 * @returns React JSX SVG icon component or null when name is invalid.
 */
export function NavIcon({ name, className = "w-3.5 h-3.5" }: NavIconProps) {
  if (!name || name === "none") return null;

  switch (name.toLowerCase()) {
    case "twitter":
    case "x":
      return <FaXTwitter className={className} />;
    case "bluesky":
    case "bsky":
      return <FaBluesky className={className} />;
    case "github":
      return <FaGithub className={className} />;
    case "discord":
      return <FaDiscord className={className} />;
    case "youtube":
      return <FaYoutube className={className} />;
    case "twitch":
      return <FaTwitch className={className} />;
    case "steam":
      return <FaSteam className={className} />;
    case "instagram":
      return <FaInstagram className={className} />;
    case "threads":
      return <FaThreads className={className} />;
    case "tiktok":
      return <FaTiktok className={className} />;
    case "telegram":
      return <FaTelegram className={className} />;
    case "reddit":
      return <FaReddit className={className} />;
    case "mastodon":
      return <FaMastodon className={className} />;
    case "patreon":
      return <FaPatreon className={className} />;
    case "linkedin":
      return <FaLinkedin className={className} />;
    case "spotify":
      return <FaSpotify className={className} />;
    case "facebook":
      return <FaFacebook className={className} />;
    case "rss":
    case "feed":
      return <Rss className={className} />;
    case "globe":
    case "web":
      return <Globe className={className} />;
    case "shopping-bag":
    case "store":
    case "shop":
      return <ShoppingBag className={className} />;
    case "disc":
    case "music":
      return <Disc className={className} />;
    case "mail":
    case "email":
    case "contact":
      return <Mail className={className} />;
    case "link":
    default:
      return <LinkIcon className={className} />;
  }
}

