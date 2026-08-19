"use server";

import { callAiChat } from "@/lib/ai/client";
import { requireAuth } from "@/lib/auth/session";

/**
 * Result payload returned from AI-driven SEO meta generation.
 */
export type AiSeoResponse =
  | { success: true; data: { title: string; description: string } }
  | { success: false; error: string };

/**
 * Result payload returned from AI excerpt generation.
 */
export type AiExcerptResponse =
  | { success: true; excerpt: string }
  | { success: false; error: string };

/**
 * Result payload returned from AI automated translation.
 */
export type AiTranslateResponse =
  | { success: true; translated: string }
  | { success: false; error: string };

/**
 * Result payload returned from AI text refinement.
 */
export type AiRewriteResponse =
  | { success: true; result: string }
  | { success: false; error: string };

/**
 * Generates an SEO-optimized title and description meta tag pair from markdown article content.
 *
 * @param siteId - Unique database identifier of the target site.
 * @param contentMd - Raw markdown text of the article.
 * @returns A Promise resolving to an AiSeoResponse containing the structured title and meta description.
 * @throws {Error} When the caller lacks an authorized administrative or editorial role.
 */
export async function generateSeoAction(siteId: string, contentMd: string): Promise<AiSeoResponse> {
  await requireAuth(["super_admin", "admin", "editor", "author"]);

  if (!contentMd || contentMd.trim().length < 10) {
    return { success: false, error: "Please write more content before generating SEO metadata." };
  }

  const prompt = `You are an SEO specialist. Analyze the following article content and output a JSON object with "title" (under 60 characters) and "description" (under 155 characters).
Output ONLY valid JSON in format: {"title": "...", "description": "..."}

Article:
${contentMd.slice(0, 3000)}`;

  try {
    const raw = await callAiChat(siteId, [
      { role: "system", content: "You output JSON only." },
      { role: "user", content: prompt },
    ]);

    const jsonStr = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(jsonStr) as { title: string; description: string };
    return { success: true, data: parsed };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate SEO metadata.";
    return { success: false, error: message };
  }
}

/**
 * Generates a concise two-sentence summary excerpt from the provided article body.
 *
 * @param siteId - Unique database identifier of the target site.
 * @param contentMd - Raw markdown text of the article.
 * @returns A Promise resolving to an AiExcerptResponse containing the clean excerpt string.
 * @throws {Error} When the caller lacks an authorized administrative or editorial role.
 */
export async function generateExcerptAction(siteId: string, contentMd: string): Promise<AiExcerptResponse> {
  await requireAuth(["super_admin", "admin", "editor", "author"]);

  if (!contentMd || contentMd.trim().length < 10) {
    return { success: false, error: "Content too short to generate excerpt." };
  }

  const prompt = `Write a compelling 2-sentence summary/excerpt for the following article. Do not include quotes or prefixes:
${contentMd.slice(0, 2500)}`;

  try {
    const excerpt = await callAiChat(siteId, [
      { role: "system", content: "You are a concise blog editor." },
      { role: "user", content: prompt },
    ]);
    return { success: true, excerpt: excerpt.trim() };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate excerpt.";
    return { success: false, error: message };
  }
}

/**
 * Translates article markdown text into a target language while preserving markdown structures and diagram blocks.
 *
 * @param siteId - Unique database identifier of the target site.
 * @param text - Raw source text or markdown content to translate.
 * @param targetLocale - Target BCP 47 language code (e.g., 'es', 'en', 'ja', 'fr').
 * @returns A Promise resolving to an AiTranslateResponse containing the translated markdown string.
 * @throws {Error} When the caller lacks an authorized administrative or editorial role.
 */
export async function translateAction(siteId: string, text: string, targetLocale: string): Promise<AiTranslateResponse> {
  await requireAuth(["super_admin", "admin", "editor", "author"]);

  if (!text) return { success: false, error: "No text provided." };

  const prompt = `Translate the following markdown text accurately into language code "${targetLocale}". Preserve all markdown syntax, links, headers, code blocks, and Mermaid diagrams untouched:
${text}`;

  try {
    const translated = await callAiChat(siteId, [
      { role: "system", content: "You are an expert technical translator." },
      { role: "user", content: prompt },
    ]);
    return { success: true, translated: translated.trim() };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Translation failed.";
    return { success: false, error: message };
  }
}

/**
 * Rewrites and improves the clarity, tone, and grammar of the provided text.
 *
 * @param siteId - Unique database identifier of the target site.
 * @param text - Raw text to refine.
 * @param tone - Preferred stylistic tone (e.g., 'professional', 'casual', 'concise').
 * @returns A Promise resolving to an AiRewriteResponse with the rewritten text.
 * @throws {Error} When the caller lacks an authorized administrative or editorial role.
 */
export async function rewriteAction(siteId: string, text: string, tone = "professional"): Promise<AiRewriteResponse> {
  await requireAuth(["super_admin", "admin", "editor", "author"]);

  if (!text) return { success: false, error: "No text provided." };

  const prompt = `Rewrite the following text with a ${tone} tone. Improve flow, clarity, and precision while maintaining the core message:
${text}`;

  try {
    const result = await callAiChat(siteId, [
      { role: "system", content: "You are an expert editor." },
      { role: "user", content: prompt },
    ]);
    return { success: true, result: result.trim() };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Rewrite failed.";
    return { success: false, error: message };
  }
}
