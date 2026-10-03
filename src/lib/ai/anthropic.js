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
  // USD per million tokens: [input, output] (sticker prices, checked against
  // platform.claude.com/docs/en/about-claude/pricing on 2026-09-22).
  // Sonnet 5 was listed here at $3/$15 from July to 2026-09-22; its real
  // price has been $2/$10 since launch (the planned Sept 1 increase was
  // cancelled), so every Sonnet figure in spend.jsonl before that date is
  // overstated by 1.5×. The Anthropic console is the only true receipt.
  "claude-fable-5-1": [10, 50],
  "claude-fable-5": [10, 50],
  "claude-opus-5-5": [4, 20],
  "claude-opus-5": [5, 25],
  "claude-opus-4-8": [5, 25],
  "claude-sonnet-5-5": [2, 10],
  "claude-sonnet-5": [2, 10],
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
    // OpenRouter responses carry the charged USD (a receipt); sticker math
    // is the fallback for Anthropic calls.
    const c = typeof usage.cost === "number" ? usage.cost :
      ((usage.input_tokens || 0) / 1e6) * inP +
      ((usage.cache_read_input_tokens || 0) / 1e6) * inP * (model?.startsWith("claude-fable-5-1") ? 0.025 : model?.startsWith("claude-opus-5-5") ? 0.05 : 0.1) +
      ((usage.cache_creation_input_tokens || 0) / 1e6) * inP * 1.25 +
      ((usage.output_tokens || 0) / 1e6) * outP +
      (usage.server_tool_use?.web_search_requests || 0) * WEB_SEARCH_PER_CALL;
    const charged = usage.batch ? c * 0.5 : c; // Message Batches bill at 50%
    cost += charged;
    byLabel[label] = byLabel[label] || { calls: 0, in: 0, out: 0, searches: 0, usd: 0 };
    byLabel[label].calls += 1;
    byLabel[label].in += (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0) + (usage.cache_creation_input_tokens || 0);
    byLabel[label].out += usage.output_tokens || 0;
    byLabel[label].searches += usage.server_tool_use?.web_search_requests || 0;
    byLabel[label].usd += charged;
  }
  return { totalUsd: cost, byLabel };
}

function extractJson(response) {
  if (response.stop_reason === "refusal") {
    // Whole fallback chain refused — should not happen for cultural queries.
    throw new Error("Model declined the request");
  }
  if (response.stop_reason === "max_tokens") {
    // Thinking shares the max_tokens budget with the JSON text: on dense
    // inputs the model can think the budget away and leave a JSON stump.
    // Name the condition so callers can retry with a bigger budget instead
    // of surfacing "Unterminated string in JSON at position 137".
    throw new Error("output truncated (max_tokens)");
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
  // Streamed accumulation (2026-08-16): the SDK refuses non-streaming
  // calls whose max_tokens could exceed 10 minutes, and Fable at a 32k
  // budget trips that. .stream().finalMessage() is byte-identical output.
  const response = await client().beta.messages.stream({
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
  }).finalMessage();
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

/**
 * Message Batches (V3-86): the same structured-output request as callModel,
 * submitted in bulk at half price. Results usually land within the hour
 * (24h max). requests: [{ id, model, system, user, schema, maxTokens, effort }]
 * — ids must match ^[A-Za-z0-9_-]{1,64}$.
 */
export async function submitBatch(requests) {
  const batch = await client().messages.batches.create({
    requests: requests.map((r) => ({
      custom_id: r.id,
      params: {
        model: r.model,
        max_tokens: r.maxTokens || 16_000,
        system: r.system,
        output_config: {
          ...(r.effort ? { effort: r.effort } : {}),
          format: { type: "json_schema", schema: r.schema },
        },
        messages: [{ role: "user", content: r.user }],
      },
    })),
  });
  return batch.id;
}

/** Poll until the batch ends; returns Map(id → { ok, value } | { ok: false, error }). */
export async function collectBatch(batchId, { label = "batch", pollMs = 60_000, log = console.log } = {}) {
  for (;;) {
    const b = await client().messages.batches.retrieve(batchId);
    if (b.processing_status === "ended") break;
    const n = b.request_counts;
    log(`  batch ${batchId}: ${n.processing} processing, ${n.succeeded} done, ${n.errored} errored`);
    await new Promise((r) => setTimeout(r, pollMs));
  }
  const out = new Map();
  for await (const r of await client().messages.batches.results(batchId)) {
    if (r.result.type !== "succeeded") {
      out.set(r.custom_id, { ok: false, error: r.result.type === "errored" ? r.result.error?.error?.message || r.result.error?.type || "errored" : r.result.type });
      continue;
    }
    const msg = r.result.message;
    recordUsage(label, msg.model, { ...msg.usage, batch: true });
    try { out.set(r.custom_id, { ok: true, value: extractJson(msg) }); }
    catch (err) { out.set(r.custom_id, { ok: false, error: err.message }); }
  }
  return out;
}

export const SONNET = "claude-sonnet-5";
// Production readers (V3-85, Tony 2026-10-02): GPT-6 Sol via OpenRouter for
// Wikipedia/source reading and interview hunting — 100% quote-wall pass and
// roughly 2–7× the confirmed yield of Sonnet 5/5.5 at the same list price
// (reports/open-model-compare-2026-09-22.md, -09-29.md). Maps stay on Opus 5.
// Without an OpenRouter key (e.g. a deploy that lacks it) both fall back to
// Sonnet 5 rather than failing; read at call time, after env is loaded.
const SOL = "openai/gpt-6-sol";
export const READER = () => (process.env.OPENROUTER_API_KEY ? SOL : SONNET);
export const RESEARCHER = () => (process.env.OPENROUTER_API_KEY ? SOL : SONNET);

/**
 * Single structured-output call on an arbitrary model (no tools, no loops) —
 * the harvest workhorse (V3-29): one call per source, many claims out.
 */
export async function callModel(model, { system, user, schema, maxTokens = 8000, effort, label = "model" }) {
  // Open-weight models (moonshotai/kimi-k3, z-ai/glm-5.2, …) live behind
  // OpenRouter; the "/" in the id is the routing signal.
  if (model.includes("/")) {
    const { callOpenRouter } = await import("./openrouter.js");
    return callOpenRouter(model, { system, user, schema, maxTokens, effort, label });
  }
  // Streamed (then reassembled) because the SDK rejects non-streaming
  // requests that could run >10 min — which a 32k-token harvest retry can.
  const response = await client().messages.stream({
    model,
    max_tokens: maxTokens,
    system,
    output_config: {
      ...(effort ? { effort } : {}),
      format: { type: "json_schema", schema },
    },
    messages: [{ role: "user", content: user }],
  }).finalMessage();
  recordUsage(label, response.model, response.usage);
  return extractJson(response);
}
