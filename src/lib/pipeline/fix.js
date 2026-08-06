// Flag repair (V3-68): a flag is a repair request, but the admin queue only
// offered triage — Tony had no mechanism to actually resolve the issue.
// Now the curator can have Kynda propose a fix: the model repairs ONLY the
// reported defect in the card's reason prose, the curator sees before/after
// and applies. Facts, titles, creators, badges are untouchable here — a flag
// alleging a factual error gets an honest "needs re-verification" note
// instead of a silent prose edit.

import { callFable } from "../ai/anthropic.js";
import { q } from "../db.js";

const FIX_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["fixed_reason", "note", "fixable"],
  properties: {
    fixable: { type: "boolean" },
    fixed_reason: { type: "string" },
    note: { type: "string" },
  },
};

const FIX_SYSTEM = `You are Kynda's copy-repair function. A reader flagged a defect on a recommendation card. Repair ONLY what the flag describes, in the reason text below — nothing else.

Rules:
- Change the minimum necessary. Keep the author's substance, structure, and voice.
- You may fix typos, stray characters, truncation artifacts, grammar, formatting leaks (like a trailing "medium: dance" fragment).
- You may NOT change facts, names, titles, dates, or claims. If the flag alleges a FACTUAL error (wrong attribution, wrong date, wrong person), set fixable=false, return the reason unchanged, and explain in note that this needs re-verification rather than a prose edit.
- note: one sentence describing exactly what you changed (or why you didn't).`;

async function findFlaggedCard(contribution) {
  const row = (await q(
    `SELECT m.id, m.payload FROM mixes m JOIN entities e ON e.id = m.subject_entity_id
     WHERE lower(e.name) = lower($1) ORDER BY m.created_at DESC LIMIT 1`,
    [contribution.subject_name]
  )).rows[0];
  if (!row) throw new Error(`no mix found for "${contribution.subject_name}"`);
  for (const slot of row.payload.slots || []) {
    for (const c of slot.candidates || []) {
      if (c?.item?.title === contribution.item_title) return { mixId: row.id, payload: row.payload, card: c, slotType: slot.slotType };
    }
  }
  throw new Error(`card "${contribution.item_title}" not found in the stored mix`);
}

/** Phase 1: the model proposes; nothing is written. */
export async function proposeFlagFix(contribution) {
  const { card, slotType } = await findFlaggedCard(contribution);
  const out = await callFable({
    system: FIX_SYSTEM,
    user: `Card: "${card.item.title}" — ${card.item.creator} (${slotType} slot on ${contribution.subject_name}'s page).
Reader's flag: "${contribution.comment || "(no comment — inspect for obvious defects)"}"

Reason text to repair:
${card.item.reason}`,
    schema: FIX_SCHEMA,
    maxTokens: 2000,
  });
  return {
    cardTitle: card.item.title,
    before: card.item.reason,
    after: out.fixed_reason,
    note: out.note,
    fixable: out.fixable && out.fixed_reason !== card.item.reason,
  };
}

/** Phase 2: the curator approved the proposal; write it and resolve the flag. */
export async function applyFlagFix(contribution, fixedReason) {
  if (!fixedReason?.trim()) throw new Error("fixed_reason required");
  const { mixId, payload, card } = await findFlaggedCard(contribution);
  card.item.reason = fixedReason.trim();
  await q("UPDATE mixes SET payload = $2 WHERE id = $1", [mixId, JSON.stringify(payload)]);
  await q("UPDATE contributions SET status = 'resolved' WHERE id = $1", [contribution.id]);
  return { applied: true, cardTitle: card.item.title };
}
