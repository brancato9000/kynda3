// Home (V3-33): server component so the browsable index of everything in
// the graph renders below the search bar — a demo recipient should never
// have to guess what's been built.

import KyndaApp from "./kynda-app.jsx";
import { listSubjects } from "../src/lib/store.js";
import { slugify } from "../src/lib/slug.js";

export const dynamic = "force-dynamic";

export default async function Page() {
  // Modern-canon gate (V3-57, Tony's call): six 18th/19th-century architects
  // greeting visitors made Kynda feel stodgy — pre-20th-century subjects
  // hide from browse in the domains below until the older canon is large
  // enough not to read as the whole product. Decided SECTION BY SECTION
  // (Tony reviews each): architecture is gated; art/literature keep their
  // old masters for now. People are modern if their work touched 1900+
  // (death year 1900+, or no recorded death and not born before 1850 —
  // keeps Frank Lloyd Wright, b. 1867). Works gate on creation year.
  // Unknown years stay visible. Search and direct links reach everything.
  const MODERN_ONLY_DOMAINS = new Set(["architecture"]);
  const isModern = (s) =>
    s.kind === "person" || s.kind === "group"
      ? !(s.year_end != null && s.year_end < 1900) && !(s.year_end == null && s.year_start != null && s.year_start < 1850)
      : !(s.year_start != null && s.year_start < 1900);
  const browsable = (s) => !MODERN_ONLY_DOMAINS.has(s.domain) || isModern(s);

  let indexedSubjects = [];
  try {
    const subjects = await listSubjects();
    indexedSubjects = subjects
      .filter(browsable)
      .map((s) => ({
        name: s.name,
        domain: s.domain || "other",
        slug: slugify(s.name),
        // Creators vs creations (V3-51): the browse experience keeps them
        // distinct — a person and their work have different signatures.
        isWork: s.kind === "work",
        creator: s.creator || null,
      }))
      .sort((a, b) => a.domain.localeCompare(b.domain) || (a.isWork === b.isWork ? a.name.localeCompare(b.name) : a.isWork ? 1 : -1));
  } catch {
    // no database → no index; search still works
  }
  return <KyndaApp indexedSubjects={indexedSubjects} />;
}
