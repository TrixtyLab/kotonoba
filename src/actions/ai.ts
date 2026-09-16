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

  const systemPrompt = `You are an SEO specialist and social metadata editor.

STRICT RULES & CONSTRAINTS:
1. 100% FACTUAL ACCURACY: Rely strictly and solely on the provided article text. Never hallucinate, extrapolate, or invent details, capabilities, or claims not present in the content.
2. TITLE SPECIFICATION: Compelling hook directly reflecting the content, under 60 characters. No clickbait or corporate buzzwords.
3. DESCRIPTION SPECIFICATION: Concrete, punchy summary under 155 characters that provides immediate standalone value. Zero PR fluff or corporate jargon ("empowers", "game-changing", "seamless", etc.).
4. LANGUAGE: Match the primary language of the article.
5. OUTPUT FORMAT: Output ONLY a valid JSON object matching the schema: {"title": "string", "description": "string"}. Do not include markdown formatting, backticks, or introductory text.`;

  const userPrompt = `Please generate the SEO title and description for this article:

${contentMd.slice(0, 15000)}`;

  try {
    const raw = await callAiChat(
      siteId,
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0.3 }
    );

    const jsonStr = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(jsonStr) as { title: string; description: string };
    return { success: true, data: parsed };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate SEO metadata.";
    return { success: false, error: message };
  }
}

/**
 * Generates a concise, high-impact summary excerpt optimized for social platforms (X/Twitter, Bluesky) and SEO.
 * Adheres to algorithm-friendly distribution principles: standalone substance, reply/share-worthy framing, and strict ban on AI buzzwords.
 *
 * @param siteId - Unique database identifier of the target site.
 * @param contentMd - Raw text or markdown content of the article.
 * @param title - Optional article title for enhanced context.
 * @returns A Promise resolving to an AiExcerptResponse containing the clean excerpt string.
 * @throws {Error} When the caller lacks an authorized administrative or editorial role.
 */
export async function generateExcerptAction(
  siteId: string,
  contentMd: string,
  title?: string
): Promise<AiExcerptResponse> {
  await requireAuth(["super_admin", "admin", "editor", "author"]);

  const rawContent = (contentMd || "").trim();
  const rawTitle = (title || "").trim();

  if (rawContent.length < 10 && rawTitle.length < 5) {
    return { success: false, error: "Content or title too short to generate excerpt." };
  }

  const systemPrompt = `You are an elite editorial writer and social media growth strategist specializing in distribution across platforms like X (Twitter), Bluesky, and LinkedIn.

BEHAVIORAL CONSTRAINTS & RULES:
1. 100% FACTUAL FIDELITY (ZERO HALLUCINATION):
   - Rely strictly and exclusively on the explicit facts, features, claims, and data provided in the article.
   - Never invent, assume, extrapolate, or embellish capabilities, dates, or results.
   - Summarize precisely what was built, launched, fixed, or argued—no more, no less. Factual accuracy overrides marketing flair.

2. STANDALONE SUBSTANCE (OPTIMIZED FOR REPLIES & SHARES):
   - Highlight the central fact, concrete takeaway, or key result.
   - Must stand completely on its own as a valuable, insight-rich post worth quoting or sharing—not just passive likes.

3. FORBIDDEN PATTERNS & VOCABULARY:
   - STRICTLY BANNED AI clichés and PR fluff: "empowers", "seamless/seamlessly", "game-changing", "fosters", "delve", "testament", "revolutionary", "unlocking", "excited to announce", "in today's digital landscape", "look no further".
   - STRICTLY BANNED engagement bait: Do not ask questions or prompt replies ("What do you think?", "RT if you agree", "Reply below", "Check out the link").

4. OUTPUT FORMAT & LENGTH:
   - Strictly 1 to 2 punchy, active-voice sentences.
   - Maximum length: under 250 characters (to fit within a 280-char tweet with link, and Bluesky 300 limit).
   - Match the primary language of the article.
   - Output ONLY the final plain excerpt text. Do not wrap in quotes, brackets, markdown prefixes, or conversational remarks.`;

  const userPrompt = `Please generate the social excerpt and summary for this article:

${rawTitle ? `Title: ${rawTitle}\n\n` : ""}Article Content:
${rawContent.slice(0, 3000)}`;

  try {
    const excerpt = await callAiChat(
      siteId,
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0.3 }
    );
    return { success: true, excerpt: excerpt.trim().replace(/^["']|["']$/g, "") };
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

  const systemPrompt = `You are an expert technical translator.

RULES:
1. Accurately translate the provided text into the requested target language code.
2. Preserve all markdown syntax, formatting, links, headers, code blocks, and Mermaid diagrams completely untouched.
3. Output ONLY the translated markdown text without introductory phrases or additional remarks.`;

  const userPrompt = `Target Language Code: ${targetLocale}

Content to translate:
${text}`;

  try {
    const translated = await callAiChat(siteId, [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
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

  const systemPrompt = `You are an expert copy editor.

RULES:
1. Rewrite the provided text to improve flow, clarity, and precision according to the specified tone.
2. Strictly maintain the core message, factual accuracy, and intent of the original text. Never invent details or fluff.
3. Output ONLY the rewritten text without quotation marks or conversational commentary.`;

  const userPrompt = `Requested Tone: ${tone}

Text to rewrite:
${text}`;

  try {
    const result = await callAiChat(siteId, [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);
    return { success: true, result: result.trim() };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Rewrite failed.";
    return { success: false, error: message };
  }
}
