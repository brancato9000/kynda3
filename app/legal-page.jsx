// Shared frame for /privacy and /terms (2026-10-03). Text approved by Tony
// from the draft-2 Google Doc; edits go there first, then here.
import Wordmark from "../src/design/wordmark.jsx";
import { FONTS, BASE } from "../src/design/tokens.js";

export const LEGAL_UPDATED = "October 3, 2026";
export const COMPANY_ADDRESS = "2801 Ocean Park Blvd, Unit #2596, Santa Monica, CA 90405";

export const H2 = ({ children }) => (
  <h2 style={{ fontFamily: FONTS.display, fontWeight: 400, fontSize: "24px", margin: "34px 0 10px", color: "#e2e8f0" }}>{children}</h2>
);
export const P = ({ children }) => (
  <p style={{ fontSize: "15px", lineHeight: 1.75, color: "rgba(226,232,240,0.85)", margin: "0 0 14px" }}>{children}</p>
);
export const UL = ({ children }) => (
  <ul style={{ fontSize: "15px", lineHeight: 1.75, color: "rgba(226,232,240,0.85)", margin: "0 0 14px", paddingLeft: "22px" }}>{children}</ul>
);
export const A = ({ href, children }) => (
  <a href={href} style={{ color: BASE.gold, textDecoration: "none" }} {...(href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}>{children}</a>
);
export const Caps = ({ children }) => (
  <p style={{ fontSize: "13px", lineHeight: 1.7, color: "rgba(226,232,240,0.75)", margin: "0 0 14px", letterSpacing: "0.01em" }}>{children}</p>
);

export default function LegalPage({ title, other, children }) {
  return (
    <main style={{ maxWidth: "720px", margin: "0 auto", padding: "48px 16px 96px" }}>
      <a href="/" style={{ fontFamily: FONTS.display, fontSize: "30px", color: "#e2e8f0", textDecoration: "none" }}><Wordmark /></a>
      <h1 style={{ fontFamily: FONTS.display, fontWeight: 400, fontSize: "44px", margin: "28px 0 6px", color: "#e2e8f0" }}>{title}</h1>
      <div style={{ fontFamily: FONTS.mono, fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(148,163,184,0.65)", marginBottom: "28px" }}>
        Last updated {LEGAL_UPDATED}
      </div>
      {children}
      <div style={{ marginTop: "48px", paddingTop: "18px", borderTop: "1px solid rgba(255,255,255,0.06)", fontFamily: FONTS.mono, fontSize: "11px", color: "rgba(148,163,184,0.6)", display: "flex", gap: "16px", flexWrap: "wrap" }}>
        <span>© 2026 The O&amp;O LLC</span>
        <a href={other.href} style={{ color: "rgba(148,163,184,0.75)", textDecoration: "none" }}>{other.label}</a>
        <a href="/" style={{ color: "rgba(148,163,184,0.75)", textDecoration: "none" }}>Back to Kynda</a>
      </div>
    </main>
  );
}
