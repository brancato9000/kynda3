// Server-side Anthropic client. All model calls in Kynda v3 go through here.
//
// Model strategy (V3-09):
//   - claude-fable-5 for KyndaMix generation — best factual grounding available;
//     effort "low" keeps latency interactive (Fable at low effort still exceeds
//     prior models at max). Thinking is always on for Fable — no thinking param.
//   - claude-haiku-4-5 for disambiguation ranking — the model only ranks real
//     candidates retrieved from MusicBrainz/Wikidata; it cannot invent entities.
//
// Structured outputs (output_config.format) guarantee schema-valid JSON —
// this deletes kynda2's hand-rolled streaming JSON parser and every
// "respond ONLY with valid JSON" prompt plea.
//
// Fable calls opt into the server-side refusal fallback to Opus 4.8
// (benign cultural content should never trigger the classifiers, but a
// false positive then degrades gracefully instead of failing the request).

import Anthropic from "@anthropic-ai/sdk";

export const FABLE = "claude-fable-5";
export const HAIKU = "claude-haiku-4-5";

let _client = null;
function client() {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }
    _client = new Anthropic();
  }
  return _client;
}

/** Raw client access for pipelines with bespoke loops (research agents). */
export function anthropicClient() {
  return client();
}

// ─── Usage metering ───────────────────────────────────────────
// Per-call usage capture so sprint economics are measured, not guessed.

const PRICES = {
  // USD per million tokens: [input, output] (sticker prices)
  "claude-fable-5": [10, 50],
  "claude-opus-4-8": [5, 25],
  "claude-sonnet-5": [3, 15],
  "claude-haiku-4-5": [1, 5],
};
const WEB_SEARCH_PER_CALL = 0.01; // $10 per 1,000 searches

export const usageEvents = [];

export function recordUsage(label, model, usage) {
  if (!usage) return;
  usageEvents.push({ label, model, usage });
}

export function usageSummary() {
  let cost = 0;
  const byLabel = {};
  for (const { label, model, usage } of usageEvents) {
    const key = Object.keys(PRICES).find((k) => model?.startsWith(k.replace(/-\d+$/, ""))) || model;
    const [inP, outP] = PRICES[model] || PRICES[key] || [10, 50];
    const c =
      ((usage.input_tokens || 0) / 1e6) * inP +
      ((usage.cache_read_input_tokens || 0) / 1e6) * inP * 0.1 +
      ((usage.cache_creation_input_tokens || 0) / 1e6) * inP * 1.25 +
      ((usage.output_tokens || 0) / 1e6) * outP +
      (usage.server_tool_use?.web_search_requests || 0) * WEB_SEARCH_PER_CALL;
    cost += c;
    byLabel[label] = byLabel[label] || { calls: 0, in: 0, out: 0, searches: 0, usd: 0 };
    byLabel[label].calls += 1;
    byLabel[label].in += (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0) + (usage.cache_creation_input_tokens || 0);
    byLabel[label].out += usage.output_tokens || 0;
    byLabel[label].searches += usage.server_tool_use?.web_search_requests || 0;
    byLabel[label].usd += c;
  }
  return { totalUsd: cost, byLabel };
}

function extractJson(response) {
  if (response.stop_reason === "refusal") {
    // Whole fallback chain refused — should not happen for cultural queries.
    throw new Error("Model declined the request");
  }
  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  return JSON.parse(text);
}

/**
 * Fable 5 call with structured output. Returns the parsed, schema-valid object.
 */
export async function callFable({ system, user, schema, maxTokens = 8000, effort = "low" }) {
  const response = await client().beta.messages.create({
    model: FABLE,
    max_tokens: maxTokens,
    betas: ["server-side-fallback-2026-06-01"],
    fallbacks: [{ model: "claude-opus-4-8" }],
    system,
    output_config: {
      effort,
      format: { type: "json_schema", schema },
    },
    messages: [{ role: "user", content: user }],
  });
  recordUsage("fable", response.model, response.usage);
  return extractJson(response);
}

/**
 * Haiku call with structured output. Returns the parsed, schema-valid object.
 */
export async function callHaiku({ system, user, schema, maxTokens = 2000 }) {
  const response = await client().messages.create({
    model: HAIKU,
    max_tokens: maxTokens,
    system,
    output_config: {
      format: { type: "json_schema", schema },
    },
    messages: [{ role: "user", content: user }],
  });
  recordUsage("haiku", response.model, response.usage);
  return extractJson(response);
}

export const SONNET = "claude-sonnet-5";

/**
 * Single structured-output call on an arbitrary model (no tools, no loops) —
 * the harvest workhorse (V3-29): one call per source, many claims out.
 */
export async function callModel(model, { system, user, schema, maxTokens = 8000, effort, label = "model" }) {
  const response = await client().messages.create({
    model,
    max_tokens: maxTokens,
    system,
    output_config: {
      ...(effort ? { effort } : {}),
      format: { type: "json_schema", schema },
    },
    messages: [{ role: "user", content: user }],
  });
  recordUsage(label, response.model, response.usage);
  return extractJson(response);
}
