/** Chat message payload compatible with `callAiChat`. */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Builds chat messages for concise factual social/SEO excerpt generation. */
export function buildExcerptMessages(contentMd: string, title?: string): ChatMessage[] {
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

  const rawTitle = (title || "").trim();
  const userPrompt = `Please generate the social excerpt and summary for this article:\n\n${
    rawTitle ? `Title: ${rawTitle}\n\n` : ""
  }Article Content:\n${contentMd.slice(0, 3000)}`;

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
}

/** Builds chat messages for markdown-preserving article translation. */
export function buildTranslateMessages(text: string, targetLocale: string): ChatMessage[] {
  const systemPrompt = `You are an expert technical translator.

RULES:
1. Accurately translate the provided text into the requested target language code.
2. Preserve all markdown syntax, formatting, links, headers, code blocks, and Mermaid diagrams completely untouched.
3. Output ONLY the translated markdown text without introductory phrases or additional remarks.`;

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: `Target Language Code: ${targetLocale}\n\nContent to translate:\n${text}` },
  ];
}

/** Builds chat messages for editorial clarity/tone rewriting. */
export function buildRewriteMessages(text: string, tone: string): ChatMessage[] {
  const systemPrompt = `You are an expert copy editor.

RULES:
1. Rewrite the provided text to improve flow, clarity, and precision according to the specified tone.
2. Strictly maintain the core message, factual accuracy, and intent of the original text. Never invent details or fluff.
3. Output ONLY the rewritten text without quotation marks or conversational commentary.`;

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: `Requested Tone: ${tone}\n\nText to rewrite:\n${text}` },
  ];
}
