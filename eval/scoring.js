// Scores a KyndaMix result against a golden subject. Used by the Phase 1
// pipeline evals; self-tested now against fixtures so the metric definitions
// are locked before any pipeline exists.

import { norm } from "../src/lib/entities/musicbrainz.js";

/**
 * @param {{items: Array}} mix - a mix payload ({ items: [{slotType,title,creator,confidence,provenance?}] })
 * @param {object} golden - a golden-set subject file
 * @returns {{itemCount:number, violations:Array, pass:boolean}}
 *
 * Violation types:
 *   self_reference          - subject appears as creator outside the essential slot (AD-10)
 *   self_reference_title    - one of the subject's own works recommended as an external influence
 *   essential_not_subject   - essential slot's creator is not the subject
 *   trap_attribution        - a known-wrong attribution (seeded from CORRECTIONS.md)
 *   unearned_verified_badge - confidence "verified" without a provenance record (V3-02)
 */
export function scoreMixResult(mix, golden) {
  const violations = [];
  const subject = norm(golden.subject);
  const selfTitles = (golden.self_reference_traps || []).map(norm);
  const traps = golden.attribution_traps || [];

  const items = mix?.items || [];
  items.forEach((item, i) => {
    const title = norm(item.title);
    const creator = norm(item.creator);
    const where = { index: i, slotType: item.slotType, title: item.title, creator: item.creator };

    if (item.slotType === "essential") {
      if (creator !== subject) violations.push({ type: "essential_not_subject", ...where });
    } else {
      if (creator === subject) violations.push({ type: "self_reference", ...where });
      if (selfTitles.includes(title)) violations.push({ type: "self_reference_title", ...where });
    }

    for (const trap of traps) {
      if (title === norm(trap.title) && creator === norm(trap.creator)) {
        violations.push({ type: "trap_attribution", actual_creator: trap.actual_creator, ...where });
      }
    }

    if (item.confidence === "verified" && !item.provenance) {
      violations.push({ type: "unearned_verified_badge", ...where });
    }
  });

  return { itemCount: items.length, violations, pass: violations.length === 0 };
}
