// Subject researcher on OPEN models (2026-09-16 experiment). Same system
// prompt, same findings schema, same evidence gate as researcher.js — but
// Anthropic's server-side web_search/web_fetch don't exist behind
// OpenRouter, so the tools are client-side: DuckDuckGo HTML for search,
// Kynda's own fetchPageText for fetch. That is a harness difference and it
// is reported as one; the comparison is "open model + our harness" vs
// "Claude + Anthropic's harness", which is the real deployment choice.

import { RESEARCH_SYSTEM, FINDINGS_SCHEMA, buildResearchPrompt } from "./researcher.js";
import { chatOpenRouter, parseJsonContent } from "./openrouter.js";
import { usageSummary } from "./anthropic.js";
import { fetchPageText } from "../verify/evidence.js";

const MAX_SEARCHES = 10;
const MAX_FETCHES = 10;
const FETCH_CHARS = 24_000; // ≈ the 6000-token cap on Anthropic's web_fetch
const MAX_TURNS = 24;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web. Returns up to 8 results with title, url, and snippet. Use specific queries (subject + target + 'interview').",
      parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "web_fetch",
      description: "Fetch a web page and return its text content (truncated). Only quote from pages fetched with this tool.",
      parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"], additionalProperties: false },
    },
  },
];

export async function ddgSearch(query, limit = 8) {
  const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh) Kynda/0.2 (brancato@gmail.com)" },
  });
  if (!res.ok) return [];
  const html = await res.text();
  const links = [...html.matchAll(/class="result__a"\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
  const snippets = [...html.matchAll(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => m[1]);
  const strip = (s) => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, " ").trim();
  return links.slice(0, limit).map((m, i) => {
    let url = m[1];
    try {
      const u = new URL(url.startsWith("//") ? `https:${url}` : url);
      url = u.searchParams.get("uddg") || url;
    } catch { /* keep raw */ }
    return { title: strip(m[2]), url, snippet: strip(snippets[i] || "") };
  });
}

async function runTool(name, args, budget, log) {
  if (name === "web_search") {
    if (budget.searches >= MAX_SEARCHES) return "search budget exhausted — fetch what you have and answer.";
    budget.searches += 1;
    await new Promise((r) => setTimeout(r, 1200)); // be polite to DDG
    const results = await ddgSearch(String(args.query || ""));
    log(`      🔎 ${args.query} → ${results.length} results`);
    if (!results.length) return "no results (search backend returned nothing).";
    return results.map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`).join("\n");
  }
  if (name === "web_fetch") {
    if (budget.fetches >= MAX_FETCHES) return "fetch budget exhausted — answer with the findings you have.";
    budget.fetches += 1;
    const page = await fetchPageText(String(args.url || ""));
    log(`      📄 ${args.url} → ${page.ok ? `${page.text.length} chars` : `failed (${page.status || page.error})`}`);
    if (!page.ok) return `fetch failed (${page.status || page.error})`;
    return page.text.slice(0, FETCH_CHARS);
  }
  return `unknown tool ${name}`;
}

/**
 * Same contract as researchSubject(): { findings }. Adds { budget } so the
 * caller can report tool usage alongside cost.
 */
export async function researchSubjectOpen(subject, targets = [], { model, log = () => {}, effort = "high", maxUsd = Number(process.env.KYNDA_RESEARCH_MAX_USD) || 2.5 } = {}) {
  // Hard spend ceiling per run: without prompt caching a long tool loop
  // re-pays the transcript every turn. Past the ceiling we stop searching
  // and ask for the findings gathered so far — the run still yields data.
  const startUsd = usageSummary().totalUsd;
  let ceilingHit = false;
  const messages = [
    { role: "system", content: RESEARCH_SYSTEM + "\n\nYou have two tools: web_search and web_fetch. When you have finished researching, reply with ONLY a JSON object matching {\"findings\": [...]} — no prose." },
    { role: "user", content: buildResearchPrompt(subject, targets) },
  ];
  const budget = { searches: 0, fetches: 0, turns: 0 };

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    budget.turns += 1;
    const { message, finish_reason } = await chatOpenRouter({ model, messages, tools: TOOLS, maxTokens: 16_000, effort, label: "research" });
    messages.push({ role: "assistant", content: message.content ?? "", ...(message.tool_calls ? { tool_calls: message.tool_calls } : {}) });

    if (message.tool_calls?.length && !ceilingHit) {
      if (usageSummary().totalUsd - startUsd > maxUsd) {
        ceilingHit = true;
        log(`      ⛔ spend ceiling $${maxUsd} reached after ${budget.turns} turns — collecting findings`);
        for (const call of message.tool_calls) messages.push({ role: "tool", tool_call_id: call.id, content: "budget exhausted — stop researching and output your findings now as JSON." });
        continue;
      }
      for (const call of message.tool_calls) {
        let args = {};
        try { args = JSON.parse(call.function.arguments || "{}"); } catch { /* empty */ }
        const result = await runTool(call.function.name, args, budget, log);
        messages.push({ role: "tool", tool_call_id: call.id, content: result });
      }
      continue;
    }

    if (message.tool_calls?.length && ceilingHit) {
      for (const call of message.tool_calls) messages.push({ role: "tool", tool_call_id: call.id, content: "budget exhausted — output your findings now as JSON." });
      continue;
    }
    // No tool calls: the model is done. Parse; if it didn't produce clean
    // JSON, one schema-enforced formatting call over the same transcript.
    try {
      const parsed = parseJsonContent(message.content);
      // Free-form JSON must actually carry the schema's fields (GLM 5.2 once
      // answered with its own key names); otherwise fall through to the
      // schema-enforced formatting pass.
      const wellFormed = Array.isArray(parsed?.findings) && parsed.findings.every((f) => f && typeof f.targetTitle === "string" && typeof f.quote === "string" && typeof f.sourceUrl === "string");
      if (wellFormed) return { findings: parsed.findings, budget };
    } catch { /* fall through to the formatting pass */ }
    if (finish_reason === "length") throw new Error("output truncated (max_tokens)");
    const fmt = await chatOpenRouter({
      model,
      messages: [...messages, { role: "user", content: "Output your findings now as JSON matching the schema. Include every finding where you fetched the page and copied a quote." }],
      schema: FINDINGS_SCHEMA,
      maxTokens: 16_000,
      label: "research",
    });
    const parsed = parseJsonContent(fmt.message.content);
    return { findings: parsed.findings || [], budget };
  }
  throw new Error(`research loop did not complete within ${MAX_TURNS} turns (ceiling ${ceilingHit ? "hit" : "not hit"})`);
}
