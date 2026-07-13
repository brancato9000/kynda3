// Lane 2 contributions (V3-35): a fan names an influence and hands us a URL;
// Kynda builds the card. The fan solves source DISCOVERY — the one harvest
// cost we can't automate — and the machine does everything it already knows:
// fetch, extract, quote-confirm, attribute. Nobody has to trust the fan.
//
// Flow: preGate (free, deterministic) → harvestSource (the standard path,
// ~$0.10) → findConfirmedPair → contribution row for curator review →
// appendContributedCard on approval (one small grounded Fable call).

import { callFable } from "../ai/anthropic.js";
import { fetchPageText, waybackSnapshot } from "../verify/evidence.js";
import { q } from "../db.js";

// claim_type → the mix slot a contributed card joins. Fan-surfaced influences
// default to ghost (Influencia Obscura) — hidden connections are exactly what
// fans surface best.
export const CLAIM_SLOTS = {
  influenced_by: "ghost",
  cited_as_influence: "ghost",
  studied_under: "ghost",
  cross_medium_influence: "culture",
  same_scene: "peer",
  collaborated_with: "collaborator",
  produced_by: "collaborator",
  member_of: "collaborator",
  founded: "collaborator",
  taught_at: "collaborator",
  covers: "legacy",
  covered_by: "legacy",
  used_gear: "culture",
  recorded_at: "geography",
};

/** Case-insensitive whole-ish name check that tolerates punctuation drift. */
export function pageNamesEntity(text, name) {
  const norm = (s) => String(s || "").toLowerCase().replace(/['’‘"“”.]/g, "").replace(/\s+&\s+/g, " and ").replace(/\s+/g, " ");
  const t = norm(text);
  const n = norm(name).trim();
  return n.length >= 2 && t.includes(n);
}

/**
 * Free pre-gate: fetch the page (Wayback fallback on failure) and require
 * that it mentions BOTH ends of the proposed connection. Zero model tokens —
 * junk and spam are rejected before anything costs money.
 */
export async function preGate(url, subjectName, influenceName) {
  let page = await fetchPageText(url);
  let resolvedUrl = url;
  if (!page.ok) {
    const snapshot = await waybackSnapshot(url).catch(() => null);
    if (snapshot) {
      page = await fetchPageText(snapshot);
      resolvedUrl = snapshot;
    }
  }
  if (!page.ok) return { ok: false, reason: "unreachable", resolvedUrl: url };
  if (!pageNamesEntity(page.text, subjectName)) return { ok: false, reason: "missing_subject", resolvedUrl };
  if (!pageNamesEntity(page.text, influenceName)) return { ok: false, reason: "missing_influence", resolvedUrl };
  return { ok: true, resolvedUrl };
}

/**
 * After the harvest: did a quote-confirmed claim connecting the named pair
 * come out of THIS source? Returns the claim + its best citation, or null.
 */
export async function findConfirmedPair(subjectName, influenceName, sourceUrl) {
  // Same name normalization as the pre-gate ("Echo & the Bunnymen" must
  // match a fan's "Echo and the Bunnymen") — the two gates must agree.
  const nameEq = (col, param) =>
    `lower(regexp_replace(${col}, '\\s+&\\s+', ' and ', 'g')) = lower(regexp_replace(${param}, '\\s+&\\s+', ' and ', 'g'))`;
  const r = await q(
    `SELECT c.id AS claim_id, c.claim_type, p.quote, p.speaker, p.source_degree, p.publication,
            o.name AS target_name, o.kind AS target_kind, o.domain AS target_domain,
            o.year_start AS target_year, o.metadata->>'creator' AS target_creator
     FROM claims c
     JOIN provenance p ON p.claim_id = c.id AND p.verification_status = 'quote_confirmed' AND p.source_url = $3
     JOIN entities s ON s.id IN (c.subject_id, c.object_id) AND ${nameEq("s.name", "$1")}
     JOIN entities o ON o.id IN (c.subject_id, c.object_id) AND o.id <> s.id AND ${nameEq("o.name", "$2")}
     ORDER BY (CASE p.source_degree WHEN 'first' THEN 0 WHEN 'second' THEN 1 ELSE 2 END)
     LIMIT 1`,
    [subjectName, influenceName, sourceUrl]
  );
  return r.rows[0] || null;
}

const REASON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reason"],
  properties: { reason: { type: "string" } },
};

const REASON_SYSTEM = `You write one mix-card reason (2-3 sentences) explaining a documented cultural connection. Use ONLY the evidence provided — the quote is your entire source of truth. State what the quote establishes and why it matters for the subject; never add facts, dates, or context the quote does not contain. Plain confident prose, no hedging, no "according to the quote".`;

/**
 * Publish an approved new-card contribution: generate a grounded reason from
 * the confirmed quote (one small Fable call) and append the candidate to the
 * subject's stored mix payload. Citations render from the DB at serve time,
 * so the appended card carries its evidence automatically.
 */
export async function appendContributedCard(contribution) {
  const pair = await findConfirmedPair(contribution.subject_name, contribution.item_title, contribution.url);
  if (!pair) throw new Error("no quote-confirmed claim for this pair from that source");

  const mixRow = await q(
    `SELECT m.id, m.payload FROM mixes m JOIN entities e ON e.id = m.subject_entity_id
     WHERE lower(e.name) = lower($1) ORDER BY m.created_at DESC LIMIT 1`,
    [contribution.subject_name]
  );
  if (!mixRow.rows[0]) throw new Error("subject has no stored mix to append to");
  const { id: mixId, payload } = mixRow.rows[0];

  const already = (payload.slots || []).some((s) =>
    (s.candidates || []).some((c) => c.item?.title?.toLowerCase() === pair.target_name.toLowerCase()));
  if (already) return { appended: false, reason: "already in mix" };

  const slotType = CLAIM_SLOTS[pair.claim_type] || "ghost";
  const { reason } = await callFable({
    system: REASON_SYSTEM,
    user: `Subject: ${contribution.subject_name}\nConnection: ${pair.target_name}${pair.target_creator ? ` (${pair.target_creator})` : ""} — ${pair.claim_type.replace(/_/g, " ")}\nEvidence quote${pair.speaker ? ` (spoken by ${pair.speaker})` : ""}: "${pair.quote}"\nSource: ${pair.publication || contribution.url}`,
    schema: REASON_SCHEMA,
    maxTokens: 2000,
  });

  const candidate = {
    item: {
      slotType,
      title: pair.target_name,
      creator: pair.target_creator || "",
      year: pair.target_year ? String(pair.target_year) : "",
      medium: pair.target_domain && pair.target_domain !== "other" ? pair.target_domain : "music",
      reason,
      via: null,
      contributed: true,
    },
    // attribution "skipped" (not null): null means "still checking" to the
    // UI; a contributed card's evidence is its citation, shown below it.
    verification: { citations: [], connection: null, attribution: { status: "skipped", reason: "Community-contributed card — its evidence is the primary-source citation" } },
  };

  const slots = payload.slots || [];
  const slot = slots.find((s) => s.slotType === slotType);
  if (slot) slot.candidates = [...(slot.candidates || []), candidate];
  else slots.push({ slotType, candidates: [candidate] });

  await q("UPDATE mixes SET payload = $2 WHERE id = $1", [mixId, JSON.stringify({ ...payload, slots })]);
  return { appended: true, slotType, title: pair.target_name };
}
