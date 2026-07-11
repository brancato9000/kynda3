// Home (V3-33): server component so the browsable index of everything in
// the graph renders below the search bar — a demo recipient should never
// have to guess what's been built.

import KyndaApp from "./kynda-app.jsx";
import { listSubjects } from "../src/lib/store.js";
import { slugify } from "../src/lib/slug.js";

export const dynamic = "force-dynamic";

export default async function Page() {
  let indexedSubjects = [];
  try {
    const subjects = await listSubjects();
    indexedSubjects = subjects
      .map((s) => ({ name: s.name, domain: s.domain || "other", slug: slugify(s.name) }))
      .sort((a, b) => a.domain.localeCompare(b.domain) || a.name.localeCompare(b.name));
  } catch {
    // no database → no index; search still works
  }
  return <KyndaApp indexedSubjects={indexedSubjects} />;
}
