// Personal listening maps (V3-79, Tony 2026-08-16): a Spotify privacy
// export, distilled to an aggregate taste profile and walked through the
// influence graph. PRIVATE by design — this route sits behind the site
// password (the middleware exempts only /demo/*), robots are refused, and
// the page renders only the derived map: no track-level history, no
// timestamps, nothing raw.
import { notFound } from "next/navigation";
import { q } from "../../../src/lib/db.js";
import { FONTS, BASE } from "../../../src/design/tokens.js";
import Wordmark from "../../../src/design/wordmark.jsx";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: "Listening Map — Kynda", robots: { index: false, follow: false } };
}

const mono = (size, color = "rgba(148,163,184,0.7)") => ({ fontFamily: FONTS.mono, fontSize: size, color, letterSpacing: "0.05em" });
const fmt = (n) => Number(n).toLocaleString("en-US");

export default async function ListeningMapPage({ params }) {
  const { slug } = await params;
  let row = null;
  try {
    row = (await q(`SELECT person, payload, created_at FROM listening_maps WHERE slug = $1`, [slug])).rows[0];
  } catch { /* table may not exist yet */ }
  if (!row) notFound();
  const p = row.payload;

  // Intersection maps (2026-08-17): two histories, one shared ancestry.
  if (p.kind === "intersection") {
    const an = p.a.name, bn = p.b.name;
    const key = (n) => n.toLowerCase();
    return (
      <main style={{ minHeight: "100vh", background: BASE.bg, color: "#e2e8f0", fontFamily: FONTS.body }}>
        <div style={{ maxWidth: "880px", margin: "0 auto", padding: "48px 24px 80px" }}>
          <Wordmark />
          <h1 style={{ fontFamily: FONTS.display, fontWeight: 400, fontSize: "34px", margin: "26px 0 6px" }}>
            {an} &amp; {bn} — a Shared Ancestry
          </h1>
          <div style={{ ...mono("11px"), textTransform: "uppercase", marginBottom: "8px" }}>
            {an}: {fmt(p.a.hours)}h · {fmt(p.a.artists)} artists&nbsp;&nbsp;·&nbsp;&nbsp;{bn}: {fmt(p.b.hours)}h · {fmt(p.b.artists)} artists&nbsp;&nbsp;·&nbsp;&nbsp;{fmt(p.overlapCount)} artists in common
          </div>
          <div style={{ ...mono("10.5px"), lineHeight: 1.6, marginBottom: "36px", maxWidth: "620px" }}>{p.note}</div>

          <h2 style={{ fontFamily: FONTS.display, fontWeight: 400, fontSize: "22px", marginBottom: "4px" }}>The common spine</h2>
          <div style={{ ...mono("10.5px"), marginBottom: "14px" }}>what both of you actually play, ranked by combined hours</div>
          <div style={{ marginBottom: "40px" }}>
            {p.shared.map((r) => (
              <div key={r.name} style={{ display: "flex", gap: "12px", alignItems: "baseline", padding: "9px 2px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <span style={{ fontSize: "14px", color: "rgba(226,232,240,0.9)" }}>
                  {r.href ? <a href={r.href} style={{ color: "inherit" }}>{r.name}</a> : r.name}
                </span>
                <span style={{ ...mono("10.5px"), marginLeft: "auto" }}>{an} {r[key(an)]}h · {bn} {r[key(bn)]}h</span>
              </div>
            ))}
          </div>

          <h2 style={{ fontFamily: FONTS.display, fontWeight: 400, fontSize: "22px", marginBottom: "4px" }}>Common roots</h2>
          <div style={{ ...mono("10.5px"), marginBottom: "14px" }}>
            documented ancestors reachable from BOTH spines — the shared inheritance, receipts required
          </div>
          <div style={{ marginBottom: "40px" }}>
            {p.commonRoots.map((r) => (
              <div key={r.name + (r.creator || "")} style={{ display: "flex", gap: "12px", alignItems: "baseline", padding: "9px 2px", borderBottom: "1px solid rgba(255,255,255,0.05)", flexWrap: "wrap" }}>
                <span style={{ fontSize: "14px", color: "rgba(226,232,240,0.9)" }}>
                  {r.href ? <a href={r.href} style={{ color: "inherit" }}>{r.name}</a> : r.name}
                  {r.kind === "work" && r.creator ? <span style={{ ...mono("10.5px") }}> — {r.creator}</span> : null}
                </span>
                <span style={{ ...mono("10.5px"), marginLeft: "auto", textAlign: "right" }}>
                  {an} via {r.viaA.slice(0, 2).join(", ")} · {bn} via {r.viaB.slice(0, 2).join(", ")} · {r.receipts} receipt{r.receipts === 1 ? "" : "s"}
                </span>
              </div>
            ))}
          </div>

          {p.together?.length ? (<>
            <h2 style={{ fontFamily: FONTS.display, fontWeight: 400, fontSize: "22px", marginBottom: "4px" }}>Listening together</h2>
            <div style={{ ...mono("10.5px"), marginBottom: "14px" }}>
              rising on both accounts in the same twelve months — household listening is fluid, and the car doesn&rsquo;t know whose account is playing. Shared days are the tell. Resonance, not attribution.
            </div>
            <div style={{ marginBottom: "40px" }}>
              {p.together.map((r) => (
                <div key={r.name} style={{ display: "flex", gap: "12px", alignItems: "baseline", padding: "9px 2px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <span style={{ fontSize: "14px", color: "rgba(226,232,240,0.9)" }}>
                    {r.href ? <a href={r.href} style={{ color: "inherit" }}>{r.name}</a> : r.name}
                  </span>
                  <span style={{ ...mono("10.5px"), marginLeft: "auto" }}>
                    {an} {r[key(an)]}h · {bn} {r[key(bn)]}h this year{r.sharedDays ? ` · ${r.sharedDays} shared day${r.sharedDays === 1 ? "" : "s"}` : ""}
                  </span>
                </div>
              ))}
            </div>
          </>) : null}

          <h2 style={{ fontFamily: FONTS.display, fontWeight: 400, fontSize: "22px", marginBottom: "4px" }}>The handoffs</h2>
          <div style={{ ...mono("10.5px"), marginBottom: "14px" }}>what each could give the other — loved by one, untouched by the other</div>
          <div style={{ ...mono("10.5px", BASE.gold), textTransform: "uppercase", marginBottom: "8px" }}>{an} → {bn}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "18px" }}>
            {p.aToB.map((g) => (
              <span key={g.name} style={{ ...mono("11px", "rgba(226,232,240,0.8)"), border: "1px solid rgba(255,255,255,0.1)", borderRadius: "14px", padding: "5px 12px" }}>
                {g.href ? <a href={g.href} style={{ color: "inherit" }}>{g.name}</a> : g.name} · {g.hours}h
              </span>
            ))}
          </div>
          <div style={{ ...mono("10.5px", BASE.gold), textTransform: "uppercase", marginBottom: "8px" }}>{bn} → {an}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "40px" }}>
            {p.bToA.length ? p.bToA.map((g) => (
              <span key={g.name} style={{ ...mono("11px", "rgba(226,232,240,0.8)"), border: "1px solid rgba(255,255,255,0.1)", borderRadius: "14px", padding: "5px 12px" }}>
                {g.href ? <a href={g.href} style={{ color: "inherit" }}>{g.name}</a> : g.name} · {g.hours}h
              </span>
            )) : (
              <span style={{ ...mono("11px") }}>none yet — everything {bn} loves, {an} has at least touched</span>
            )}
          </div>

          <div style={{ ...mono("10px"), lineHeight: 1.7 }}>
            Built {String(p.built).slice(0, 10)} · derived intersection only — the raw exports never leave the family machine.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: BASE.bg, color: "#e2e8f0", fontFamily: FONTS.body }}>
      <div style={{ maxWidth: "880px", margin: "0 auto", padding: "48px 24px 80px" }}>
        <Wordmark />
        <h1 style={{ fontFamily: FONTS.display, fontWeight: 400, fontSize: "34px", margin: "26px 0 6px" }}>
          {p.person}&rsquo;s Listening Map
        </h1>
        <div style={{ ...mono("11px"), textTransform: "uppercase", marginBottom: "8px" }}>
          {p.stats.from?.slice(0, 4)}–{p.stats.to?.slice(0, 4)} · {fmt(p.stats.plays)} plays · {fmt(p.stats.hours)} hours · {fmt(p.stats.artists)} artists
        </div>
        <div style={{ ...mono("10.5px"), lineHeight: 1.6, marginBottom: "36px", maxWidth: "620px" }}>
          {p.note}
        </div>

        {/* ── the spine ── */}
        <h2 style={{ fontFamily: FONTS.display, fontWeight: 400, fontSize: "22px", marginBottom: "4px" }}>The spine</h2>
        <div style={{ ...mono("10.5px"), marginBottom: "14px" }}>
          what fifteen years actually sound like — sleep noise filtered, aliases folded · ★ = mapped subject in the graph
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "8px", marginBottom: "40px" }}>
          {p.spine.slice(0, 24).map((a, i) => {
            const inner = (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "8px", background: BASE.surface, border: `1px solid ${a.isSubject ? "rgba(250,204,21,0.25)" : "rgba(255,255,255,0.07)"}`, borderRadius: "8px", padding: "10px 13px" }}>
                <span style={{ fontSize: "13.5px", color: "rgba(226,232,240,0.9)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {a.isSubject ? "★ " : ""}{i + 1}. {a.name}
                </span>
                <span style={{ ...mono("10.5px"), flexShrink: 0 }}>{a.hours}h · {a.tracks}t</span>
              </div>
            );
            return a.href
              ? <a key={a.name} href={a.href} style={{ textDecoration: "none" }}>{inner}</a>
              : <div key={a.name}>{inner}</div>;
          })}
        </div>

        {/* ── rising ── */}
        {p.rising?.length ? (<>
          <h2 style={{ fontFamily: FONTS.display, fontWeight: 400, fontSize: "22px", marginBottom: "4px" }}>Rising</h2>
          <div style={{ ...mono("10.5px"), marginBottom: "14px" }}>
            who you&rsquo;re becoming — the last twelve months, weighted for depth, so a new obsession registers against years of spine
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "40px" }}>
            {p.rising.map((r) => (
              <span key={r.name} style={{ ...mono("11px", "rgba(226,232,240,0.85)"), border: `1px solid ${r.isNew ? "rgba(250,204,21,0.35)" : "rgba(255,255,255,0.1)"}`, borderRadius: "14px", padding: "5px 12px" }}>
                {r.isNew ? "✧ " : "↗ "}{r.href ? <a href={r.href} style={{ color: "inherit" }}>{r.name}</a> : r.name} · {r.recentHours}h this year
              </span>
            ))}
          </div>
        </>) : null}

        {/* ── shared ancestors ── */}
        <h2 style={{ fontFamily: FONTS.display, fontWeight: 400, fontSize: "22px", marginBottom: "4px" }}>The influences behind what you love</h2>
        <div style={{ ...mono("10.5px"), marginBottom: "14px" }}>
          documented ancestors of your top artists, ranked by how many of your favorites they reach · every edge carries receipts
        </div>
        <div style={{ marginBottom: "40px" }}>
          {p.ancestors.map((r) => (
            <div key={r.name + (r.creator || "")} style={{ display: "flex", gap: "12px", alignItems: "baseline", padding: "9px 2px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <span style={{ ...mono("9.5px", r.heard ? "rgba(52,211,153,0.8)" : BASE.gold), textTransform: "uppercase", flexShrink: 0, width: "64px" }}>
                {r.heard ? "✓ heard" : "→ new"}
              </span>
              <span style={{ fontSize: "14px", color: "rgba(226,232,240,0.9)" }}>
                {r.href ? <a href={r.href} style={{ color: "inherit" }}>{r.name}</a> : r.name}
                {r.kind === "work" && r.creator ? <span style={{ ...mono("10.5px") }}> — {r.creator}</span> : null}
              </span>
              <span style={{ ...mono("10.5px"), marginLeft: "auto", textAlign: "right" }}>
                via {r.via.slice(0, 3).join(", ")}{r.via.length > 3 ? ` +${r.via.length - 3}` : ""} · {r.receipts} receipt{r.receipts === 1 ? "" : "s"}
              </span>
            </div>
          ))}
        </div>

        {/* ── the frontier ── */}
        <h2 style={{ fontFamily: FONTS.display, fontWeight: 400, fontSize: "22px", marginBottom: "4px" }}>The frontier</h2>
        <div style={{ ...mono("10.5px"), marginBottom: "14px" }}>
          documented heirs and neighbors of your artists that your history has never touched — the recommendation surface, receipts required
        </div>
        <div style={{ marginBottom: "40px" }}>
          {p.frontier.map((r) => (
            <div key={r.name + (r.creator || "")} style={{ display: "flex", gap: "12px", alignItems: "baseline", padding: "9px 2px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <span style={{ ...mono("9.5px", BASE.gold), textTransform: "uppercase", flexShrink: 0, width: "64px" }}>→ try</span>
              <span style={{ fontSize: "14px", color: "rgba(226,232,240,0.9)" }}>
                {r.href ? <a href={r.href} style={{ color: "inherit" }}>{r.name}</a> : r.name}
                {r.kind === "work" && r.creator ? <span style={{ ...mono("10.5px") }}> — {r.creator}</span> : null}
              </span>
              <span style={{ ...mono("10.5px"), marginLeft: "auto", textAlign: "right" }}>
                carries {r.via.slice(0, 3).join(", ")}{r.via.length > 3 ? ` +${r.via.length - 3}` : ""} · {r.receipts} receipt{r.receipts === 1 ? "" : "s"}
              </span>
            </div>
          ))}
        </div>

        {/* ── the gap list ── */}
        <h2 style={{ fontFamily: FONTS.display, fontWeight: 400, fontSize: "22px", marginBottom: "4px" }}>Where the graph hasn&rsquo;t reached yet</h2>
        <div style={{ ...mono("10.5px"), marginBottom: "14px" }}>
          your most-played artists with no page — the graph grows toward what you love, and this is its queue
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "40px" }}>
          {p.gaps.map((g) => (
            <span key={g.name} style={{ ...mono("11px", "rgba(226,232,240,0.8)"), border: "1px solid rgba(255,255,255,0.1)", borderRadius: "14px", padding: "5px 12px" }}>
              {g.name} · {g.hours}h
            </span>
          ))}
        </div>

        <div style={{ ...mono("10px"), lineHeight: 1.7 }}>
          Built {String(p.built).slice(0, 10)} · derived map only — the raw export never leaves the machine it was downloaded to.
        </div>
      </div>
    </main>
  );
}
