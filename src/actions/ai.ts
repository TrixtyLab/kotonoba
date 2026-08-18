"use server";

import { callAiChat } from "@/lib/ai/client";
import { requireAuth } from "@/lib/auth/session";

export type AiSeoResponse =
  | { success: true; data: { title: string; description: string } }
  | { success: false; error: string };

export type AiExcerptResponse =
  | { success: true; excerpt: string }
  | { success: false; error: string };

export type AiTranslateResponse =
  | { success: true; translated: string }
  | { success: false; error: string };

export type AiRewriteResponse =
  | { success: true; result: string }
  | { success: false; error: string };

/**
 * Generates an SEO meta title and description from article markdown content.
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
 * Generates a concise 2-sentence excerpt from article content.
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
 * Translates article content into the target language.
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
 * Rewrites, expands, or simplifies selected text based on an instruction.
 */
export async function rewriteAction(siteId: string, text: string, instruction: string): Promise<AiRewriteResponse> {
  await requireAuth(["super_admin", "admin", "editor", "author"]);

  if (!text) return { success: false, error: "No text selected." };

  const prompt = `Apply the following instruction to the text below. Return only the revised text.
Instruction: ${instruction}

Text:
${text}`;

  try {
    const result = await callAiChat(siteId, [
      { role: "system", content: "You are a professional writing assistant." },
      { role: "user", content: prompt },
    ]);
    return { success: true, result: result.trim() };
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI assistance failed.";
    return { success: false, error: message };
  }
}
