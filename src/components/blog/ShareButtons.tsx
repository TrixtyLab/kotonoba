"use client";

import React, { useState } from "react";
import { FaXTwitter, FaFacebook, FaLinkedin, FaWhatsapp } from "react-icons/fa6";
import { Link2, Check } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

/**
 * Properties configuring social share buttons.
 */
export interface ShareButtonsProps {
  /** Target canonical URL to share. */
  url: string;
  /** Article title used as share post caption. */
  title: string;
}

/**
 * Social sharing button cluster supporting X (Twitter), LinkedIn, Facebook, WhatsApp, and clipboard copy.
 *
 * @param props - ShareButtonsProps configuring target article URL and title.
 * @returns React JSX sharing buttons cluster.
 */
export function ShareButtons({ url, title }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  function copyUrl(): void {
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Enlace copiado al portapapeles");
    setTimeout(() => setCopied(false), 2500);
  }

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const buttonClass =
    "p-2.5 rounded-full bg-surface-hover hover:bg-primary/10 hover:text-primary transition-colors text-text-muted";

  return (
    <div className="flex items-center gap-2">
      <a
        href={`https://x.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Compartir en X"
        className={buttonClass}
        title="Compartir en X (Twitter)"
      >
        <FaXTwitter className="w-4 h-4" />
      </a>
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Compartir en LinkedIn"
        className={buttonClass}
        title="Compartir en LinkedIn"
      >
        <FaLinkedin className="w-4 h-4" />
      </a>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Compartir en Facebook"
        className={buttonClass}
        title="Compartir en Facebook"
      >
        <FaFacebook className="w-4 h-4" />
      </a>
      <a
        href={`https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Compartir en WhatsApp"
        className={buttonClass}
        title="Compartir en WhatsApp"
      >
        <FaWhatsapp className="w-4 h-4" />
      </a>
      <button
        onClick={copyUrl}
        aria-label="Copiar enlace"
        className={buttonClass}
        title="Copiar enlace"
      >
        {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Link2 className="w-4 h-4" />}
      </button>
    </div>
  );
}
