// OpenRouter client (2026-09-16 open-model experiment). OpenAI-compatible
// chat completions over plain fetch — no new dependency. Any model id with a
// "/" in it (moonshotai/kimi-k3, z-ai/glm-5.2) routes here from callModel.
//
// Cost is a RECEIPT, not an estimate: `usage: { include: true }` makes
// OpenRouter return the charged USD on every response, which recordUsage
// stores as usage.cost and usageSummary prefers over sticker math.

import { recordUsage } from "./anthropic.js";

const BASE = "https://openrouter.ai/api/v1";

export function openRouterConfigured() {
  return !!process.env.OPENROUTER_API_KEY;
}

function normalizeUsage(u = {}) {
  const cached = u.prompt_tokens_details?.cached_tokens || 0;
  return {
    input_tokens: Math.max(0, (u.prompt_tokens || 0) - cached),
    cache_read_input_tokens: cached,
    output_tokens: u.completion_tokens || 0,
    cost: typeof u.cost === "number" ? u.cost : undefined,
  };
}

/**
 * One chat-completion round trip. Returns { message, finish_reason, usage }.
 * Retries transient failures (429/5xx/network) with backoff.
 */
export async function chatOpenRouter({ model, messages, schema = null, tools = null, maxTokens = 8000, effort, label = "openrouter", temperature = 0 }) {
  if (!openRouterConfigured()) throw new Error("OPENROUTER_API_KEY is not set (add it to .env.local)");
  const body = {
    model,
    messages,
    max_tokens: maxTokens,
    // OpenAI's reasoning models (GPT-6 family) reject a temperature
    // parameter; with require_parameters that leaves no routable endpoint.
    ...(model.startsWith("openai/") ? {} : { temperature }),
    usage: { include: true },
    // Only route to providers that honor every parameter we send
    // (structured output / tools), otherwise a silent downgrade would
    // corrupt the comparison.
    provider: { require_parameters: true },
  };
  if (effort) body.reasoning = { effort };
  if (schema) body.response_format = { type: "json_schema", json_schema: { name: "kynda", strict: true, schema } };
  if (tools) { body.tools = tools; body.tool_choice = "auto"; }

  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`${BASE}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://kynda.app",
          "X-Title": "Kynda research eval",
        },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      if (!res.ok) {
        const err = new Error(`OpenRouter ${res.status}: ${text.slice(0, 300)}`);
        err.status = res.status;
        if (res.status === 429 || res.status >= 500) throw err;
        return Promise.reject(err);
      }
      const data = JSON.parse(text);
      if (data.error) throw Object.assign(new Error(`OpenRouter: ${data.error.message}`), { status: data.error.code });
      const choice = data.choices?.[0];
      if (!choice) throw new Error("OpenRouter: empty choices");
      const usage = normalizeUsage(data.usage);
      recordUsage(label, data.model || model, usage);
      return { message: choice.message, finish_reason: choice.finish_reason, usage, model: data.model || model };
    } catch (err) {
      lastErr = err;
      const transient = err.status === 429 || (err.status >= 500) || /fetch failed|ECONNRESET|ETIMEDOUT|terminated/i.test(String(err.message));
      if (!transient || attempt === 3) throw err;
      await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
    }
  }
  throw lastErr;
}

export function parseJsonContent(content) {
  const text = typeof content === "string" ? content : (content || []).map((b) => b.text || "").join("");
  try { return JSON.parse(text); } catch { /* fall through */ }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("no JSON object in model output");
  return JSON.parse(text.slice(start, end + 1));
}

/**
 * Single structured-output call — the callModel contract, on an open model.
 */
export async function callOpenRouter(model, { system, user, schema, maxTokens = 8000, effort, label = "model" }) {
  const { message, finish_reason } = await chatOpenRouter({
    model,
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
    schema,
    maxTokens,
    effort,
    label,
  });
  if (finish_reason === "length") throw new Error("output truncated (max_tokens)");
  return parseJsonContent(message.content);
}
