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
  return extractJson(response);
}
