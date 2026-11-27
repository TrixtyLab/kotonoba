"use server";

import { callAiChat } from "@/lib/ai/client";
import {
  buildExcerptMessages,
  buildRewriteMessages,
  buildTranslateMessages,
} from "@/lib/ai/prompts";
import { ROLE_ALL } from "@/lib/auth/roles";
import { requireSiteAccess } from "@/lib/auth/site-access";

export type AiExcerptResponse =
  | { success: true; excerpt: string }
  | { success: false; error: string };

export type AiTranslateResponse =
  | { success: true; translated: string }
  | { success: false; error: string };

export type AiRewriteResponse =
  | { success: true; result: string }
  | { success: false; error: string };

/** Generates a concise factual social/SEO excerpt from article content. */
export async function generateExcerptAction(
  siteId: string,
  contentMd: string,
  title?: string
): Promise<AiExcerptResponse> {
  await requireSiteAccess(siteId, ROLE_ALL);
  const rawContent = (contentMd || "").trim();
  const rawTitle = (title || "").trim();
  if (rawContent.length < 10 && rawTitle.length < 5) {
    return { success: false, error: "Content or title too short to generate excerpt." };
  }

  try {
    const excerpt = await callAiChat(siteId, buildExcerptMessages(rawContent, rawTitle), { temperature: 0.3 });
    return { success: true, excerpt: excerpt.trim().replace(/^["']|["']$/g, "") };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to generate excerpt." };
  }
}

/** Translates article markdown/HTML into the requested target locale while preserving formatting. */
export async function translateAction(
  siteId: string,
  text: string,
  targetLocale: string
): Promise<AiTranslateResponse> {
  await requireSiteAccess(siteId, ROLE_ALL);
  if (!text) return { success: false, error: "No text provided." };

  try {
    const translated = await callAiChat(siteId, buildTranslateMessages(text, targetLocale));
    return { success: true, translated: translated.trim() };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Translation failed." };
  }
}

/** Rewrites draft text to match the requested editorial tone without embellishing facts. */
export async function rewriteAction(siteId: string, text: string, tone = "professional"): Promise<AiRewriteResponse> {
  await requireSiteAccess(siteId, ROLE_ALL);
  if (!text) return { success: false, error: "No text provided." };

  try {
    const result = await callAiChat(siteId, buildRewriteMessages(text, tone));
    return { success: true, result: result.trim() };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Rewrite failed." };
  }
}
