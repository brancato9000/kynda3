// Subject researcher (MASTERPLAN Pillar II, role 1).
//
// Given a subject and its known connections, hunt PRIMARY SOURCES —
// interviews, autobiographies, reviews, podcast transcripts — using web
// search + fetch. The agent's output is deliberately checkable: every
// finding is a URL plus an EXACT quote, and earns nothing until the
// deterministic evidence worker confirms the quote on the fetched page
// (V3-03: never trust the claim, trust the verified artifact).

import { anthropicClient, FABLE, recordUsage } from "./anthropic.js";

export const FINDINGS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["findings"],
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["targetTitle", "targetCreator", "claimType", "sourceUrl", "quote", "speaker", "sourceDegree", "publication", "publishedDate", "note"],
        properties: {
          targetTitle: { type: "string" },
          targetCreator: { type: "string" },
          claimType: {
            type: "string",
            enum: ["influenced_by", "cited_as_influence", "covers", "covered_by", "collaborated_with", "member_of", "produced_by", "same_scene", "cross_medium_influence"],
          },
          sourceUrl: { type: "string" },
          quote: { type: "string" },
          speaker: { type: "string" },
          sourceDegree: { type: "string", enum: ["first", "second", "third"] },
          publication: { type: "string" },
          publishedDate: { type: "string" },
          note: { type: "string" },
        },
      },
    },
  },
};

const RESEARCH_SYSTEM = `You are Kynda's research agent. Given a cultural subject and its candidate connections, find PRIMARY SOURCES documenting those connections: interviews, autobiographies, memoirs, podcast transcripts, documentaries, contemporaneous reviews, liner notes, artist statements.

Method:
- Use web search to locate sources, then FETCH the page and read it. Only cite pages you actually fetched in this session.
- quote: an EXACT excerpt copied verbatim from the fetched page content (40-300 characters) that documents the connection. Copy-paste from the fetched text — never reconstruct from memory or paraphrase.
- Return EVERY finding where you fetched a page and copied a quote from its content. Do not withhold findings out of caution — a deterministic machine check downstream is the filter, not you. Your job is recall; the machine's job is precision. Only omit findings you could not fetch a page for.
- speaker: WHO is speaking in the quote — the person whose words they are, never the outlet. A Lumet quote inside a blog post has speaker "Sidney Lumet". If the quote is the writer's own prose, the speaker is that writer's name (or "" if unnamed).
- sourceDegree: attaches to the speaker, not the publication. "first" = the subject or its creators/direct collaborators speaking. "second" = a named critic, journalist, or scholar making the connection themselves. "third" = fan analysis, wikis, crowd sources.
- Strongest evidence first: the artist's own words (interviews, memoirs) > named journalists/critics > general reporting. But a good secondary source beats no finding — for connections that live in criticism rather than in artist statements (thematic echoes, structural homage), deliberately seek the named critics who have made the comparison.
- Prefer stable, fetchable pages (publications, archives, fan-maintained interview archives) over social media or video-only sources.
- Cover as many of the provided targets as the tool budget allows — a finding for each of 5 targets beats 5 findings for one. Then add up to 3 additional well-sourced connections you encountered.
- claimType: from the target when given; for new findings choose the best fit. "cited_as_influence" means the subject explicitly named the influence themselves.
- publishedDate: YYYY-MM-DD or YYYY if known, else "".
- note: one sentence on what the source establishes.`;

// Cost levers (measured 2026-07-07): uncapped fetches pushed 1.36M input
// tokens through the context (~$14/subject on Fable). max_content_tokens
// caps each fetched page — plenty to locate a quote — and 10 fetches
// suffice for a subject's targets.
const WEB_TOOLS_CURRENT = [
  { type: "web_search_20260209", name: "web_search", max_uses: 10 },
  { type: "web_fetch_20260209", name: "web_fetch", max_uses: 10, max_content_tokens: 6000 },
];
const WEB_TOOLS_BASIC = [
  { type: "web_search_20250305", name: "web_search", max_uses: 10 },
  { type: "web_fetch_20250910", name: "web_fetch", max_uses: 10, max_content_tokens: 6000 },
];

function findingsFromText(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("no JSON object in research output");
  return JSON.parse(text.slice(start, end + 1));
}

async function runLoop(client, tools, user, useFormat, model) {
  const messages = [{ role: "user", content: user }];
  // Refusal fallback applies to Fable only (its allowed fallback is Opus 4.8).
  const fallbackOpts = model === FABLE
    ? { betas: ["server-side-fallback-2026-06-01"], fallbacks: [{ model: "claude-opus-4-8" }] }
    : {};
  for (let turn = 0; turn < 10; turn++) {
    let response;
    // Turn-level retry: long SSE streams die ("terminated") and 529 bursts
    // outlast the SDK's built-in retries. Losing a whole research run to a
    // transient mid-stream failure wasted 95 minutes on one pilot subject.
    for (let attempt = 0; ; attempt++) {
      try {
        const stream = client.beta.messages.stream({
          model,
          max_tokens: 16_000,
          ...fallbackOpts,
          // Auto-cache the growing prefix: pause_turn continuations otherwise
          // re-pay the whole conversation at full input price every turn —
          // measured at $23.69/subject before this line existed.
          cache_control: { type: "ephemeral" },
          system: RESEARCH_SYSTEM,
          tools,
          output_config: useFormat
            ? { effort: "high", format: { type: "json_schema", schema: FINDINGS_SCHEMA } }
            : { effort: "high" },
          messages,
        });
        response = await stream.finalMessage();
        break;
      } catch (err) {
        const detail = String(err?.message || "") + String(err?.cause?.message || "") + (err?.status === 529 ? " overloaded" : "");
        const transient = /terminated|Connection error|fetch failed|ENOTFOUND|ETIMEDOUT|ECONNRESET|overloaded|529/i.test(detail);
        if (attempt < 3 && transient) {
          await new Promise((r) => setTimeout(r, 45_000 * (attempt + 1)));
          continue;
        }
        throw err;
      }
    }
    recordUsage("research", response.model, response.usage);
    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }
    if (response.stop_reason === "refusal") throw new Error("research request declined by safety classifiers");
    const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    return useFormat ? JSON.parse(text) : findingsFromText(text);
  }
  throw new Error("research loop did not complete within 10 turns");
}

/**
 * @param {object} subject - { name, domain, bio?, description? }
 * @param {Array} targets - [{ title, creator, claimType, slotType? }] known connections to source
 * @returns {{findings: Array}}
 */
export async function researchSubject(subject, targets = [], { model = FABLE } = {}) {
  const client = anthropicClient();
  const lines = [
    `Subject: "${subject.name}"${subject.domain ? ` (${subject.domain})` : ""}`,
    subject.description ? `Identified as: ${subject.description}` : null,
    subject.bio?.text ? `Bio (Wikipedia): ${subject.bio.text}` : null,
    "",
    targets.length
      ? `Target connections to find primary sources for:\n${targets
          .map((t, i) => `${i + 1}. ${t.title}${t.creator ? ` (${t.creator})` : ""} — ${t.claimType || "influenced_by"}`)
          .join("\n")}`
      : "No specific targets — find the best-documented influence connections for this subject.",
  ].filter((l) => l !== null);
  const user = lines.join("\n");

  // Degrade twice if needed: current web tools → basic variants; with
  // structured output → without (JSON extracted from text).
  const attempts = [
    { tools: WEB_TOOLS_CURRENT, useFormat: true },
    { tools: WEB_TOOLS_BASIC, useFormat: true },
    { tools: WEB_TOOLS_CURRENT, useFormat: false },
    { tools: WEB_TOOLS_BASIC, useFormat: false },
  ];
  let lastErr;
  for (const { tools, useFormat } of attempts) {
    try {
      return await runLoop(client, tools, user, useFormat, model);
    } catch (err) {
      lastErr = err;
      if (err?.status !== 400) throw err; // only param-shape errors trigger degradation
    }
  }
  throw lastErr;
}
