// The graph so far (Tony, 2026-08-11): a public stats page for demo
// readers — what's mapped, how it's verified, and how big the mountain
// is. Live numbers per request; the ambition figures come from the
// sizing session (PITCH: "How big is the mountain", 2026-08-08).

import { q } from "../../../src/lib/db.js";
import { FONTS, BASE } from "../../../src/design/tokens.js";
import Wordmark from "../../../src/design/wordmark.jsx";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return {
    title: "The Influence Graph So Far — Kynda",
    robots: { index: false, follow: false },
    openGraph: { title: "The Influence Graph So Far — Kynda", siteName: "Kynda" },
  };
}

const MOUNTAIN = {
  entities: 100_000_000, // ~200 years of culture, all mediums (sizing session)
  edges: 1_500_000_000,  // documented connections, mid-estimate
};

const fmt = (n) => Number(n).toLocaleString("en-US");

export default async function AboutPage() {
  let s = null, sources = [], domains = [], otherHosts = [];
  try {
    s = (await q(`SELECT
      (SELECT count(*) FROM entities) AS entities,
      (SELECT count(*) FROM claims) AS edges,
      (SELECT count(*) FROM provenance WHERE verification_status = 'quote_confirmed') AS citations,
      (SELECT count(*) FROM provenance WHERE verification_status = 'quote_confirmed' AND source_degree = 'first') AS first_degree,
      (SELECT count(*) FROM provenance WHERE verification_status = 'quote_confirmed' AND published_date IS NOT NULL) AS dated,
      (SELECT count(DISTINCT subject_entity_id) FROM mixes) AS subjects,
      (SELECT count(*) FROM entities WHERE metadata->>'image_url' IS NOT NULL) AS images,
      (SELECT count(*) FROM entities WHERE metadata->>'preview_url' IS NOT NULL OR metadata->>'vibe_url' IS NOT NULL) AS playable
    `)).rows[0];
    sources = (await q(`
      SELECT CASE
          WHEN source_url LIKE '%wikipedia.org%' THEN 'Wikipedia'
          WHEN source_url LIKE '%loc.gov%' THEN 'Library of Congress (Chronicling America)'
          WHEN source_url LIKE '%freshairarchive%' THEN 'Fresh Air (NPR/WHYY archive)'
          WHEN source_url LIKE '%americanarchive%' THEN 'American Archive of Public Broadcasting'
          ELSE 'other primary sources' END AS src,
        count(*) AS n,
        count(*) FILTER (WHERE source_degree = 'first') AS first
      FROM provenance WHERE verification_status = 'quote_confirmed'
      GROUP BY 1 ORDER BY n DESC`)).rows;
    // Examples for the "other" bucket — top hosts, computed live.
    otherHosts = (await q(`
      SELECT regexp_replace(regexp_replace(source_url, '^https?://(www\\.)?', ''), '/.*$', '') AS host, count(*) AS n
      FROM provenance
      WHERE verification_status = 'quote_confirmed'
        AND source_url NOT LIKE '%wikipedia.org%' AND source_url NOT LIKE '%loc.gov%'
        AND source_url NOT LIKE '%freshairarchive%' AND source_url NOT LIKE '%americanarchive%'
      GROUP BY 1 ORDER BY n DESC LIMIT 3`)).rows.map((r) => r.host);
    domains = (await q(`
      SELECT e.domain, count(DISTINCT m.subject_entity_id) AS subjects
      FROM mixes m JOIN entities e ON e.id = m.subject_entity_id
      GROUP BY 1 ORDER BY subjects DESC`)).rows;
  } catch { /* stats page must never 500 */ }

  const mono = (size, color = "rgba(148,163,184,0.7)") => ({ fontFamily: FONTS.mono, fontSize: size, color, letterSpacing: "0.05em" });
  const entityPct = s ? (s.entities / MOUNTAIN.entities) * 100 : 0;
  const edgePct = s ? (s.edges / MOUNTAIN.edges) * 100 : 0;

  return (
    <main style={{ minHeight: "100vh", background: BASE.bg, color: "#e2e8f0", fontFamily: FONTS.body }}>
      <div style={{ maxWidth: "880px", margin: "0 auto", padding: "48px 24px 80px" }}>
        <Wordmark />
        <h1 style={{ fontFamily: FONTS.display, fontWeight: 400, fontSize: "34px", margin: "26px 0 6px" }}>
          The influence graph so far
        </h1>
        <div style={{ ...mono("11px"), textTransform: "uppercase", marginBottom: "34px" }}>
          live counts · every connection machine-verified against its source
        </div>

        {s && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px", marginBottom: "40px" }}>
            {[
              ["entities", s.entities, "people, works, movements, institutions"],
              ["connections", s.edges, "edges in the graph"],
              ["verified citations", s.citations, "quotes machine-checked against their sources"],
              ["first-degree", s.first_degree, "the artist's own words"],
              ["dated receipts", s.dated, "citations carrying a publication date"],
              ["subjects mapped", s.subjects, "full influence maps generated"],
              ["images", s.images, "licensed or labeled, always credited"],
              ["playable", s.playable, "official audio samples & embeds"],
            ].map(([label, value, hint]) => (
              <div key={label} style={{ background: BASE.surface, border: "1px solid rgba(255,255,255,0.07)", borderRadius: "10px", padding: "18px 18px 14px" }}>
                <div style={{ fontFamily: FONTS.display, fontSize: "30px", lineHeight: 1 }}>{fmt(value)}</div>
                <div style={{ ...mono("10.5px", BASE.gold), textTransform: "uppercase", margin: "8px 0 4px" }}>{label}</div>
                <div style={{ ...mono("10px"), lineHeight: 1.5 }}>{hint}</div>
              </div>
            ))}
          </div>
        )}

        <h2 style={{ fontFamily: FONTS.display, fontWeight: 400, fontSize: "22px", marginBottom: "10px" }}>Where the receipts come from</h2>
        <div style={{ marginBottom: "38px" }}>
          {sources.map((r) => (
            <div key={r.src} style={{ display: "flex", justifyContent: "space-between", gap: "12px", padding: "9px 2px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <span style={{ fontSize: "14px", color: "rgba(226,232,240,0.85)" }}>
                {r.src}
                {r.src === "other primary sources" && otherHosts.length > 0 && (
                  <span style={{ fontFamily: FONTS.mono, fontSize: "10.5px", color: "rgba(148,163,184,0.55)" }}>
                    {" "}(incl. {otherHosts.join(", ")}, …)
                  </span>
                )}
              </span>
              <span style={mono("11.5px")}>{fmt(r.n)} citations · {fmt(r.first)} first-degree</span>
            </div>
          ))}
        </div>

        <h2 style={{ fontFamily: FONTS.display, fontWeight: 400, fontSize: "22px", marginBottom: "10px" }}>What's mapped</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "38px" }}>
          {domains.map((d) => (
            <span key={d.domain} style={{ ...mono("11px", "rgba(226,232,240,0.8)"), border: "1px solid rgba(255,255,255,0.1)", borderRadius: "14px", padding: "5px 12px" }}>
              {d.domain} · {d.subjects}
            </span>
          ))}
        </div>

        <h2 style={{ fontFamily: FONTS.display, fontWeight: 400, fontSize: "22px", marginBottom: "10px" }}>The mountain</h2>
        <p style={{ fontSize: "14.5px", lineHeight: 1.75, color: "rgba(226,232,240,0.8)", marginBottom: "18px" }}>
          Mapping the last ~200 years of culture — every medium, globally — is on the order of{" "}
          <strong>100 million entities</strong> and <strong>1–2 billion documented connections</strong>.
          Influence follows power laws: a core of a few hundred thousand subjects carries most of what
          any reader will ever look for, so the mountain is climbed canon-first, verification always on.
        </p>
        {s && (
          <div style={{ marginBottom: "8px" }}>
            {[
              ["entities", entityPct],
              ["connections", edgePct],
            ].map(([label, pct]) => (
              <div key={label} style={{ marginBottom: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                  <span style={mono("10.5px", BASE.gold)}>{String(label).toUpperCase()}</span>
                  <span style={mono("10.5px")}>{pct < 0.1 ? pct.toFixed(3) : pct.toFixed(2)}% of the mountain</span>
                </div>
                <div style={{ height: "6px", borderRadius: "3px", background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                  <div style={{ width: `${Math.max(pct, 0.3)}%`, height: "100%", background: BASE.gold, opacity: 0.85 }} />
                </div>
              </div>
            ))}
          </div>
        )}
        <p style={{ ...mono("10.5px"), lineHeight: 1.7 }}>
          Progress bars honest to three decimals. Everything above is counted live from the claims
          store; nothing is asserted without a receipt. — Kynda
        </p>
      </div>
    </main>
  );
}
