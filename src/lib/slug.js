// Shared slug logic (V3-28): /s/[slug] permanent subject pages.
// Diacritics fold (Björk → bjork); non-alphanumerics become hyphens.
export function slugify(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
