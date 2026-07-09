"use client";

// Founder dashboard (V3-27): searches, corpus stats, and the contribution
// review queue with approve/deny. Shared-secret gate (KYNDA_ADMIN_TOKEN);
// the token is remembered in this browser only.

import { useState, useEffect, useCallback } from "react";
import { FONTS, BASE } from "../../src/design/tokens.js";

const mono = (size = "11px", color = "rgba(148,163,184,0.7)") => ({
  fontFamily: FONTS.mono, fontSize: size, color, letterSpacing: "0.04em",
});

export default function Admin() {
  const [token, setToken] = useState("");
  const [input, setInput] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [acting, setActing] = useState(null);

  useEffect(() => {
    const saved = typeof window !== "undefined" && localStorage.getItem("kynda_admin_token");
    if (saved) setToken(saved);
  }, []);

  const load = useCallback(async (t) => {
    setError(null);
    try {
      const res = await fetch("/api/admin", { headers: { "x-kynda-admin": t } });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "failed");
      setData(json);
      localStorage.setItem("kynda_admin_token", t);
    } catch (err) {
      setError(err.message);
      if (err.message === "unauthorized") { localStorage.removeItem("kynda_admin_token"); setToken(""); }
    }
  }, []);

  useEffect(() => { if (token) load(token); }, [token, load]);

  async function act(id, action) {
    setActing(id);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-kynda-admin": token },
        body: JSON.stringify({ id, action }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "action failed");
      await load(token);
    } catch (err) {
      setError(err.message);
    } finally {
      setActing(null);
    }
  }

  if (!token) {
    return (
      <main style={{ maxWidth: "420px", margin: "120px auto", padding: "0 24px" }}>
        <h1 style={{ fontFamily: FONTS.display, fontWeight: 400, fontSize: "32px" }}>Kynda <span style={{ color: BASE.gold }}>admin</span></h1>
        <form onSubmit={(e) => { e.preventDefault(); setToken(input); }}>
          <input type="password" placeholder="admin token" value={input} onChange={(e) => setInput(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", background: BASE.surfaceRaised, border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", padding: "12px 16px", fontSize: "14px", color: "#e2e8f0", outline: "none", margin: "16px 0 10px" }} />
          <button type="submit" style={{ background: "rgba(250,204,21,0.12)", border: "1px solid rgba(250,204,21,0.35)", color: BASE.gold, borderRadius: "8px", padding: "10px 22px", fontFamily: FONTS.mono, fontSize: "12px", letterSpacing: "0.08em", cursor: "pointer", textTransform: "uppercase" }}>Enter</button>
        </form>
        {error && <div style={{ ...mono("12px", "rgba(248,113,113,0.85)"), marginTop: "12px" }}>{error}</div>}
      </main>
    );
  }

  const pending = (data?.contributions || []).filter((c) => ["pending", "confirmed"].includes(c.status));
  const done = (data?.contributions || []).filter((c) => !["pending", "confirmed"].includes(c.status));

  return (
    <main style={{ maxWidth: "980px", margin: "0 auto", padding: "48px 24px 120px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "28px" }}>
        <h1 style={{ fontFamily: FONTS.display, fontWeight: 400, fontSize: "36px", margin: 0 }}>Kynda <span style={{ color: BASE.gold }}>admin</span></h1>
        <button onClick={() => load(token)} style={{ ...mono("11px", BASE.gold), background: "none", border: "1px solid rgba(250,204,21,0.3)", borderRadius: "6px", padding: "6px 14px", cursor: "pointer", textTransform: "uppercase" }}>refresh</button>
      </div>

      {error && <div style={{ ...mono("12px", "rgba(248,113,113,0.85)"), marginBottom: "16px" }}>{error}</div>}
      {!data && !error && <div style={mono("12px")}>loading…</div>}

      {data && (
        <>
          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "12px", marginBottom: "36px" }}>
            {[
              ["entities", data.stats.entities], ["claims", data.stats.claims],
              ["T2 citations", data.stats.citations], ["mixes", data.stats.mixes],
              ["searches (24h)", data.stats.searches_24h], ["generations (24h)", data.stats.generations_24h],
            ].map(([label, value]) => (
              <div key={label} style={{ background: BASE.surface, border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", padding: "14px 16px" }}>
                <div style={{ fontFamily: FONTS.display, fontSize: "26px" }}>{value}</div>
                <div style={mono("10px")}>{label.toUpperCase()}</div>
              </div>
            ))}
          </div>

          {/* Review queue */}
          <h2 style={{ fontFamily: FONTS.display, fontWeight: 400, fontSize: "22px", marginBottom: "12px" }}>
            Review queue <span style={{ ...mono("12px", BASE.gold) }}>({pending.length})</span>
          </h2>
          {pending.length === 0 && <div style={{ ...mono("12px"), marginBottom: "24px" }}>nothing pending — the queue is clear</div>}
          <div style={{ display: "grid", gap: "10px", marginBottom: "40px" }}>
            {pending.map((c) => (
              <div key={c.id} style={{ background: BASE.surface, border: `1px solid ${c.kind === "flag" ? "rgba(248,113,113,0.25)" : "rgba(52,211,153,0.25)"}`, borderRadius: "8px", padding: "14px 18px", overflowWrap: "anywhere" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
                  <span style={mono("11px", c.kind === "flag" ? "rgba(248,113,113,0.85)" : "rgba(52,211,153,0.85)")}>
                    {c.kind.toUpperCase()} · {c.status} · {c.subject_name}{c.item_title ? ` → ${c.item_title}` : ""}
                  </span>
                  <span style={mono("10px")}>{c.contributor || "anonymous"} · {String(c.created_at).slice(0, 16).replace("T", " ")}</span>
                </div>
                {c.comment && <div style={{ fontSize: "13px", lineHeight: 1.6, color: "rgba(226,232,240,0.85)", marginTop: "8px" }}>{c.comment}</div>}
                {c.quote && <div style={{ fontFamily: FONTS.display, fontStyle: "italic", fontSize: "13px", lineHeight: 1.6, color: "rgba(226,232,240,0.75)", marginTop: "8px" }}>“{c.quote}”</div>}
                {c.url && <a href={c.url} target="_blank" rel="noreferrer" style={{ ...mono("10px", "rgba(52,211,153,0.75)"), textDecoration: "none", display: "inline-block", marginTop: "6px" }}>{c.url} ↗</a>}
                <div style={{ display: "flex", gap: "14px", marginTop: "12px" }}>
                  <button disabled={acting === c.id} onClick={() => act(c.id, "approve")}
                    style={{ ...mono("11px", "rgba(52,211,153,0.9)"), background: "none", border: "1px solid rgba(52,211,153,0.35)", borderRadius: "6px", padding: "5px 14px", cursor: "pointer", textTransform: "uppercase" }}>
                    {c.kind === "flag" ? "mark resolved" : "approve"}
                  </button>
                  <button disabled={acting === c.id} onClick={() => act(c.id, "reject")}
                    style={{ ...mono("11px", "rgba(248,113,113,0.9)"), background: "none", border: "1px solid rgba(248,113,113,0.35)", borderRadius: "6px", padding: "5px 14px", cursor: "pointer", textTransform: "uppercase" }}>
                    {c.kind === "flag" ? "dismiss" : "reject & pull"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Searches */}
          <h2 style={{ fontFamily: FONTS.display, fontWeight: 400, fontSize: "22px", marginBottom: "12px" }}>
            Recent searches <span style={mono("12px")}>({data.stats.searches_total} all-time)</span>
          </h2>
          <div style={{ background: BASE.surface, border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", overflow: "hidden", marginBottom: "40px" }}>
            {data.searches.map((s, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: "12px", padding: "8px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)", flexWrap: "wrap" }}>
                <span style={{ fontSize: "13px", color: "rgba(226,232,240,0.85)" }}>
                  {s.raw_query}
                  {s.resolved && s.resolved.toLowerCase() !== s.raw_query.toLowerCase() && (
                    <span style={mono("10px")}> → {s.resolved}</span>
                  )}
                </span>
                <span style={mono("10px")}>{s.disambiguation_tier || "—"} · {String(s.created_at).slice(0, 16).replace("T", " ")}</span>
              </div>
            ))}
            {data.searches.length === 0 && <div style={{ ...mono("12px"), padding: "14px 16px" }}>no searches yet</div>}
          </div>

          {/* Resolved history */}
          {done.length > 0 && (
            <>
              <h2 style={{ fontFamily: FONTS.display, fontWeight: 400, fontSize: "22px", marginBottom: "12px" }}>Contribution history</h2>
              <div style={{ display: "grid", gap: "6px" }}>
                {done.map((c) => (
                  <div key={c.id} style={{ ...mono("11px"), padding: "6px 4px" }}>
                    [{c.kind} · {c.status}] {c.subject_name}{c.item_title ? ` → ${c.item_title}` : ""} · {c.contributor || "anonymous"}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}
