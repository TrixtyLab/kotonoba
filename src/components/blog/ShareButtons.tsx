"use client";

import { useState } from "react";
import { FaXTwitter, FaFacebook, FaLinkedin, FaWhatsapp } from "react-icons/fa6";
import { Link2, Check } from "lucide-react";

export interface ShareButtonsProps {
  url: string;
  title: string;
}

/**
 * Social sharing buttons supporting X/Twitter, LinkedIn, Facebook, WhatsApp, and one-click URL copy.
 */
export function ShareButtons({ url, title }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  function copyUrl() {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  return (
    <div className="flex items-center gap-2">
      <a
        href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on X"
        className="p-2 rounded-md bg-surface-hover hover:bg-primary/20 hover:text-primary transition-colors text-text-muted btn-press"
      >
        <FaXTwitter className="w-3.5 h-3.5" />
      </a>
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on LinkedIn"
        className="p-2 rounded-md bg-surface-hover hover:bg-primary/20 hover:text-primary transition-colors text-text-muted btn-press"
      >
        <FaLinkedin className="w-3.5 h-3.5" />
      </a>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on Facebook"
        className="p-2 rounded-md bg-surface-hover hover:bg-primary/20 hover:text-primary transition-colors text-text-muted btn-press"
      >
        <FaFacebook className="w-3.5 h-3.5" />
      </a>
      <a
        href={`https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on WhatsApp"
        className="p-2 rounded-md bg-surface-hover hover:bg-primary/20 hover:text-primary transition-colors text-text-muted btn-press"
      >
        <FaWhatsapp className="w-3.5 h-3.5" />
      </a>
      <button
        onClick={copyUrl}
        aria-label="Copy link to clipboard"
        className="p-2 rounded-md bg-surface-hover hover:bg-primary/20 hover:text-primary transition-colors text-text-muted btn-press"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Link2 className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}
