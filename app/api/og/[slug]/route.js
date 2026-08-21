// Share cards (V3-81): a branded 1200×630 OG image for any subject with a
// stored mix, served publicly (the middleware exempts /api/og/) so link
// previews can always fetch it. The card carries only what is already
// public-safe: the subject's name, aggregate counts, and the Commons
// portrait that passed the license gate at backfill time — fair-use assets
// must never be the page's ambassador (2026-08-11 rule), and nothing from
// the mix itself appears. /api/og/kynda serves the generic site card.
import { ImageResponse } from "next/og";
import { q } from "../../../../src/lib/db.js";
import { listSubjects } from "../../../../src/lib/store.js";
import { slugify } from "../../../../src/lib/slug.js";

export const dynamic = "force-dynamic";

const UA = { "User-Agent": "Kynda/3.0 (kynda3.vercel.app; brancato@gmail.com)" };
const BG = "#0f1016";
const GREEN = "#34d399";

// Satori needs raw font data; Google returns TTF urls to a UA-less fetch.
// Cached at module scope — one fetch per lambda instance.
let fontsPromise = null;
async function loadFonts() {
  if (!fontsPromise) fontsPromise = (async () => {
    const load = async (family) => {
      const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family}&display=swap`)).text();
      const url = css.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/)?.[1];
      return url ? await (await fetch(url)).arrayBuffer() : null;
    };
    const [serif, mono] = await Promise.all([load("Instrument+Serif"), load("DM+Mono")]);
    return [
      serif && { name: "Instrument Serif", data: serif, weight: 400, style: "normal" },
      mono && { name: "DM Mono", data: mono, weight: 400, style: "normal" },
    ].filter(Boolean);
  })();
  return fontsPromise;
}

// Satori fetches remote images without a UA, which Wikimedia refuses —
// pre-fetch the portrait ourselves and inline it as a data URI.
async function portraitDataUri(url) {
  try {
    const r = await fetch(url, { headers: UA });
    if (!r.ok) return null;
    const type = r.headers.get("content-type") || "image/jpeg";
    if (!/^image\//.test(type)) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 4_000_000) return null;
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch { return null; }
}

const Wordmark = ({ size }) => (
  <div style={{ display: "flex", fontFamily: "'Instrument Serif'", fontSize: size, color: "#e2e8f0" }}>
    Kyn<span style={{ marginLeft: "-0.045em" }}>da</span>
  </div>
);

export async function GET(req, ctx) {
  const { slug } = await ctx.params;
  const fonts = await loadFonts();

  let subject = null, portrait = null, credit = null, counts = null;
  if (slug !== "kynda") {
    try {
      const subjects = await listSubjects();
      subject = subjects.find((s) => slugify(s.name) === slug) || null;
    } catch { /* card must degrade, never 500 */ }
  }
  if (subject) {
    try {
      const pr = await q(
        `SELECT metadata->>'image_url' AS url, metadata->>'image_credit' AS credit
         FROM entities WHERE id = $1 AND metadata->>'image_url' IS NOT NULL
           AND metadata->>'image_license' NOT ILIKE '%fair use%' LIMIT 1`, [subject.id]);
      if (pr.rows[0]?.url) {
        portrait = await portraitDataUri(pr.rows[0].url);
        credit = pr.rows[0].credit || null;
      }
      const cr = (await q(
        `SELECT count(DISTINCT c.id)::int AS claims, count(p.id)::int AS receipts
         FROM claims c LEFT JOIN provenance p ON p.claim_id = c.id
           AND p.verification_status IN ('quote_confirmed','db_relationship')
         WHERE c.subject_id = $1`, [subject.id])).rows[0];
      if (cr?.claims > 0) counts = cr;
    } catch { /* plain card without portrait/counts */ }
  }

  const name = subject?.name || null;
  const title = name || "Influence, with receipts";
  // Long names step down so Satori never clips (Beyoncé fits huge;
  // "Live Art in Microgravity" needs room).
  const titleSize = title.length > 26 ? 56 : title.length > 16 ? 72 : 88;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: BG, color: "#e2e8f0", padding: "56px 64px", position: "relative" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "10px", background: GREEN, display: "flex" }} />
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between", paddingRight: portrait ? "48px" : 0 }}>
          <Wordmark size={44} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            {name ? (
              <div style={{ display: "flex", fontFamily: "'DM Mono'", fontSize: 22, color: "rgba(148,163,184,0.85)", letterSpacing: "0.14em", marginBottom: 14 }}>
                THE INFLUENCE MAP OF
              </div>
            ) : null}
            <div style={{ display: "flex", fontFamily: "'Instrument Serif'", fontSize: titleSize, lineHeight: 1.05, color: "#f8fafc" }}>
              {title}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {counts ? (
              <div style={{ display: "flex", fontFamily: "'DM Mono'", fontSize: 24, color: GREEN, marginBottom: 10 }}>
                {counts.claims} documented connections · {counts.receipts} receipts
              </div>
            ) : null}
            <div style={{ display: "flex", fontFamily: "'DM Mono'", fontSize: 20, color: "rgba(148,163,184,0.7)" }}>
              every connection verified against its source
            </div>
          </div>
        </div>
        {portrait ? (
          <div style={{ display: "flex", flexDirection: "column", width: "360px", justifyContent: "center" }}>
            <img src={portrait} width={360} height={440} style={{ objectFit: "cover", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)" }} />
            {credit ? (
              <div style={{ display: "flex", fontFamily: "'DM Mono'", fontSize: 13, color: "rgba(148,163,184,0.55)", marginTop: 8 }}>
                {String(credit).slice(0, 60)} · Wikimedia Commons
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts,
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    }
  );
}
