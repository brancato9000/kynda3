// The unfurl shell (V3-81): what link-preview crawlers see when they hit
// anything behind the site password. The middleware rewrites known preview
// bots here instead of serving the 401 wall — so shared links grow a card
// — but this page carries ONLY metadata-safe facts: the subject's name,
// the branded OG image, a one-line description. Never the mix, never
// listening-map contents (those unfurl as the generic Kynda card, no
// names). Anyone spoofing a crawler UA gets exactly this and nothing more
// — the leaky serve-full-content-to-bots pattern stays dead.
import { listSubjects } from "../../../src/lib/store.js";
import { slugify } from "../../../src/lib/slug.js";
import { FONTS, BASE } from "../../../src/design/tokens.js";
import Wordmark from "../../../src/design/wordmark.jsx";

export const dynamic = "force-dynamic";

async function resolveSubject(seg) {
  // Only subject-page shapes reveal a name: /s/<slug> and /demo/<slug>.
  if (!Array.isArray(seg) || seg.length !== 2 || !["s", "demo"].includes(seg[0])) return null;
  try {
    const subjects = await listSubjects();
    return subjects.find((s) => slugify(s.name) === seg[1]) || null;
  } catch { return null; }
}

export async function generateMetadata({ params }) {
  const { seg } = await params;
  const subject = await resolveSubject(seg);
  const title = subject ? `${subject.name}'s Influence Map on Kynda` : "Kynda — influence, with receipts";
  const description = subject
    ? `The documented influences behind ${subject.name} — every connection verified against its source.`
    : "Contextual recommendations built on documented influence — every connection carries its receipt.";
  const image = `/api/og/${subject ? slugify(subject.name) : "kynda"}`;
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, siteName: "Kynda", type: "article", images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function UnfurlShell() {
  return (
    <main style={{ minHeight: "100vh", background: BASE.background, color: "#e2e8f0", fontFamily: FONTS.body, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: FONTS.display, fontSize: "40px" }}><Wordmark /></div>
        <div style={{ fontFamily: FONTS.mono, fontSize: "12px", color: "rgba(148,163,184,0.7)", marginTop: "10px" }}>
          invite-only right now
        </div>
      </div>
    </main>
  );
}
