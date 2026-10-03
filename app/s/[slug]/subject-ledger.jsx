// The subject page as text (Tony, 2026-10-03 — search-engine readiness,
// BACKLOG #32). The map and mix load in the browser after the page arrives,
// so a crawler reading /s/radiohead found a title and nothing else. This
// server-rendered section sits at the foot of the page, visible to everyone:
// Kynda's intro, the mix picks with their reasons, and every documented
// connection with its first receipt. Mapped subjects link to their own
// pages — the internal link mesh search engines use to find the corpus.
// Pure graph reads, zero model calls.

import { FONTS, BASE, MIX_SLOT_TYPES } from "../../../src/design/tokens.js";
import { slugify } from "../../../src/lib/slug.js";

const SLOT_LABEL = Object.fromEntries(MIX_SLOT_TYPES.map((t) => [t.id, t.label]));
const PER_GROUP = 40;

const muted = "rgba(148,163,184,0.75)";
const h3 = { fontFamily: FONTS.display, fontWeight: 400, fontSize: "21px", margin: "30px 0 10px", color: "#e2e8f0" };
const li = { fontSize: "13.5px", lineHeight: 1.65, color: "rgba(226,232,240,0.82)", margin: "0 0 10px" };
const link = { color: BASE.gold, textDecoration: "none" };

function Name({ name, mappedSlugs }) {
  const slug = slugify(name);
  return mappedSlugs.has(slug) ? <a href={`/s/${slug}`} style={link}>{name}</a> : <span style={{ color: "#e2e8f0" }}>{name}</span>;
}

function Receipt({ evidence }) {
  const e = (evidence || []).find((x) => x.quote && x.url) || (evidence || []).find((x) => x.url);
  if (!e) return null;
  const host = (() => { try { return new URL(e.url).hostname.replace(/^www\./, ""); } catch { return "source"; } })();
  return (
    <span style={{ color: muted }}>
      {e.quote ? <> “{e.quote.length > 240 ? `${e.quote.slice(0, 237)}…` : e.quote}” </> : " "}
      <a href={e.url} rel="nofollow noopener" target="_blank" style={{ color: muted }}>({e.publication || host})</a>
    </span>
  );
}

function Group({ title, nodes, subjectName, mappedSlugs }) {
  if (!nodes?.length) return null;
  const shown = [...nodes].sort((a, b) => b.weight - a.weight).slice(0, PER_GROUP);
  return (
    <>
      <h3 style={h3}>{title}</h3>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {shown.map((n) => (
          <li key={`${n.name}|${n.creator || ""}`} style={li}>
            <Name name={n.name} mappedSlugs={mappedSlugs} />
            {n.creator && n.creator !== subjectName && <> by <Name name={n.creator} mappedSlugs={mappedSlugs} /></>}
            {n.year && <span style={{ color: muted }}> ({n.year})</span>}
            {n.summary && <>. {n.summary}</>}
            {" "}<Receipt evidence={n.evidence} />
          </li>
        ))}
      </ul>
      {nodes.length > shown.length && (
        <p style={{ ...li, color: muted }}>…and {nodes.length - shown.length} more on the map above.</p>
      )}
    </>
  );
}

export default function SubjectLedger({ subject, intro, slots, graph, mappedSlugs }) {
  const picks = (slots || [])
    .map((slot) => ({ slotType: slot.slotType, item: slot.candidates?.[0]?.item }))
    .filter((p) => p.item?.title);
  return (
    <section aria-labelledby="ledger-title" style={{ marginTop: "72px", paddingTop: "28px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <h2 id="ledger-title" style={{ fontFamily: FONTS.display, fontWeight: 400, fontSize: "28px", margin: "0 0 8px", color: "#e2e8f0" }}>
        {subject.name}: influences, peers and legacy
      </h2>
      <p style={{ fontFamily: FONTS.mono, fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase", color: muted, margin: "0 0 18px" }}>
        Every connection with its receipt
      </p>
      {intro && <p style={{ fontSize: "15px", lineHeight: 1.7, color: "rgba(226,232,240,0.88)", margin: 0 }}>{intro}</p>}

      {picks.length > 0 && (
        <>
          <h3 style={h3}>The Kynda mix for {subject.name}</h3>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {picks.map(({ slotType, item }, i) => (
              <li key={i} style={li}>
                <span style={{ fontFamily: FONTS.mono, fontSize: "10.5px", letterSpacing: "0.06em", textTransform: "uppercase", color: BASE.gold }}>
                  {SLOT_LABEL[slotType] || slotType}
                </span>{" · "}
                <Name name={item.title} mappedSlugs={mappedSlugs} />
                {item.creator && item.creator !== item.title && <> by <Name name={item.creator} mappedSlugs={mappedSlugs} /></>}
                {item.year && <span style={{ color: muted }}> ({item.year})</span>}
                {item.reason && <>. {item.reason}</>}
              </li>
            ))}
          </ul>
        </>
      )}

      {graph && (
        <>
          <Group title={`What influenced ${subject.name}`} nodes={graph.predecessors} subjectName={subject.name} mappedSlugs={mappedSlugs} />
          <Group title="Peers and kindred spirits" nodes={graph.peers} subjectName={subject.name} mappedSlugs={mappedSlugs} />
          <Group title={`Who ${subject.name} influenced`} nodes={graph.successors} subjectName={subject.name} mappedSlugs={mappedSlugs} />
        </>
      )}
    </section>
  );
}
