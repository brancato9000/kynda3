// The thread finder (V3-41): shortest documented path between any two
// entities in the graph. Server-rendered, shareable (/path?from=X&to=Y),
// zero model calls — the demo moment the graph has been earning.

import { getPathBetween } from "../../src/lib/store.js";
import { HOP_PHRASES } from "../../src/lib/path.js";
import { slugify } from "../../src/lib/slug.js";

export const dynamic = "force-dynamic";

const SERIF = "'Instrument Serif', serif";
const MONO = "'DM Mono', monospace";
const TIER_STYLE = {
  cited: { color: "#facc15", label: "cited" },
  documented: { color: "#34d399", label: "documented" },
  synthesis: { color: "#94a3b8", label: "synthesis" },
};

export async function generateMetadata({ searchParams }) {
  const { from, to } = await searchParams;
  const title = from && to ? `${from} → ${to} — Kynda` : "Find the thread — Kynda";
  return { title, description: "The shortest documented path through the influence graph." };
}

function EntityName({ name, indexed }) {
  const style = { fontFamily: SERIF, fontSize: "22px", color: "#e2e8f0", textDecoration: "none" };
  return indexed
    ? <a href={`/s/${slugify(name)}`} style={{ ...style, borderBottom: "1px dotted rgba(250,204,21,0.4)" }}>{name}</a>
    : <span style={style}>{name}</span>;
}

export default async function PathPage({ searchParams }) {
  const params = await searchParams;
  const from = (params.from || "").trim();
  const to = (params.to || "").trim();
  const result = from && to ? await getPathBetween(from, to) : null;

  return (
    <main style={{ maxWidth: "680px", margin: "0 auto", padding: "48px 24px 80px", color: "#e2e8f0" }}>
      <a href="/" style={{ fontFamily: SERIF, fontSize: "30px", color: "#e2e8f0", textDecoration: "none" }}>Kynda</a>
      <div style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(148,163,184,0.6)", margin: "4px 0 28px" }}>
        Find the thread · shortest documented path
      </div>

      <form method="GET" action="/path" style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "36px" }}>
        {["from", "to"].map((f) => (
          <input key={f} name={f} defaultValue={f === "from" ? from : to} placeholder={f === "from" ? "From (e.g. Bach)" : "To (e.g. Kendrick Lamar)"}
            style={{ flex: "1 1 180px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", padding: "12px 14px", fontSize: "14px", color: "#e2e8f0", outline: "none" }} />
        ))}
        <button type="submit" style={{ background: "rgba(250,204,21,0.12)", border: "1px solid rgba(250,204,21,0.4)", borderRadius: "8px", padding: "12px 22px", color: "#facc15", fontFamily: MONO, fontSize: "12px", letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer" }}>
          trace
        </button>
      </form>

      {result?.error === "not_found" && (
        <div style={{ fontFamily: MONO, fontSize: "12px", color: "rgba(148,163,184,0.8)", lineHeight: 2 }}>
          {!result.from && <div>“{from}” isn’t in the graph yet.{result.suggestions.from.length > 0 && <> Did you mean: {result.suggestions.from.map((s, i) => <a key={i} href={`/path?from=${encodeURIComponent(s)}&to=${encodeURIComponent(to)}`} style={{ color: "#facc15", textDecoration: "none" }}>{i > 0 && " · "}{s}</a>)}</>}</div>}
          {!result.to && <div>“{to}” isn’t in the graph yet.{result.suggestions.to.length > 0 && <> Did you mean: {result.suggestions.to.map((s, i) => <a key={i} href={`/path?from=${encodeURIComponent(from)}&to=${encodeURIComponent(s)}`} style={{ color: "#facc15", textDecoration: "none" }}>{i > 0 && " · "}{s}</a>)}</>}</div>}
        </div>
      )}
      {result?.error === "no_path" && (
        <div style={{ fontFamily: MONO, fontSize: "12px", color: "rgba(148,163,184,0.8)", lineHeight: 1.7 }}>
          No documented path connects {result.from} and {result.to} yet. The graph grows with every search and every harvested source — this is a map of what’s documented, not a claim that no connection exists.
        </div>
      )}

      {result?.hops && (
        <div>
          <div style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(250,204,21,0.8)", marginBottom: "22px" }}>
            {result.from} → {result.to} · {result.hopCount} hop{result.hopCount === 1 ? "" : "s"}
          </div>
          {result.hops.map((hop, i) => {
            const tier = TIER_STYLE[hop.tier] || TIER_STYLE.synthesis;
            const phrase = HOP_PHRASES[hop.claimType] || "is connected to";
            return (
              <div key={i} style={{ position: "relative", paddingLeft: "26px", paddingBottom: i === result.hops.length - 1 ? 0 : "26px" }}>
                {i < result.hops.length - 1 && <div style={{ position: "absolute", left: "7px", top: "22px", bottom: 0, width: "1px", background: "rgba(148,163,184,0.25)" }} />}
                <div style={{ position: "absolute", left: 0, top: "6px", width: "15px", height: "15px", borderRadius: "50%", border: `2px solid ${tier.color}`, background: "#0f1016" }} />
                <div style={{ marginBottom: "4px" }}>
                  {i === 0 && <><EntityName name={hop.from} indexed={hop.fromIndexed} />{" "}</>}
                </div>
                <div style={{ fontSize: "13.5px", lineHeight: 1.6, color: "rgba(226,232,240,0.85)" }}>
                  <strong style={{ fontWeight: 500 }}>{hop.subject}</strong> {phrase} <strong style={{ fontWeight: 500 }}>{hop.object}</strong>
                  <span style={{ fontFamily: MONO, fontSize: "9.5px", letterSpacing: "0.06em", textTransform: "uppercase", color: tier.color, marginLeft: "10px" }}>{tier.label}</span>
                </div>
                {hop.quote && (
                  <div style={{ margin: "6px 0 0", paddingLeft: "10px", borderLeft: "2px solid rgba(250,204,21,0.4)", fontFamily: SERIF, fontStyle: "italic", fontSize: "12.5px", lineHeight: 1.55, color: "rgba(226,232,240,0.7)" }}>
                    “{hop.quote.length > 220 ? hop.quote.slice(0, 220) + "…" : hop.quote}”
                    {hop.sourceUrl && (
                      <a href={hop.sourceUrl} target="_blank" rel="noreferrer" style={{ fontFamily: MONO, fontStyle: "normal", fontSize: "9.5px", color: "rgba(250,204,21,0.7)", textDecoration: "none", marginLeft: "8px" }}>
                        — {hop.speaker ? `${hop.speaker}, ` : ""}{hop.publication || "source"} ↗
                      </a>
                    )}
                  </div>
                )}
                {!hop.quote && hop.sourceUrl && (
                  <a href={hop.sourceUrl} target="_blank" rel="noreferrer" style={{ fontFamily: MONO, fontSize: "9.5px", color: "rgba(148,163,184,0.6)", textDecoration: "none" }}>
                    {hop.publication || "record"} ↗
                  </a>
                )}
                <div style={{ marginTop: "8px" }}>
                  <EntityName name={hop.to} indexed={hop.toIndexed} />
                </div>
              </div>
            );
          })}
          <div style={{ marginTop: "30px", fontFamily: MONO, fontSize: "10px", color: "rgba(148,163,184,0.5)", lineHeight: 1.7 }}>
            Paths prefer evidence: quote-confirmed hops rank above database-confirmed hops rank above synthesis. A longer path with receipts beats a shorter leap without them.
          </div>
        </div>
      )}

      {!result && (
        <div style={{ fontFamily: MONO, fontSize: "12px", color: "rgba(148,163,184,0.7)", lineHeight: 1.8 }}>
          Name any two entities in the graph — artists, works, movements, institutions, instruments — and Kynda traces the shortest documented chain of influence between them, every hop with its receipt.
        </div>
      )}
    </main>
  );
}
