"use client";

// Map-image queue (2026-10-02): every person, work and institution the
// backfill couldn't settle on its own, busiest first, with its candidates.
// Same actions as the in-page overlay on the map. "Automatic picks" lists
// what the backfill applied by itself, for spot-checking.

import { useState, useEffect, useCallback } from "react";
import { FONTS, BASE } from "../../../src/design/tokens.js";
import Wordmark from "../../../src/design/wordmark.jsx";

const mono = (size = "11px", color = "rgba(148,163,184,0.7)") => ({ fontFamily: FONTS.mono, fontSize: size, color, letterSpacing: "0.04em" });
const btn = (color) => ({ ...mono("11px", color), background: "none", border: `1px solid ${color.replace(/[\d.]+\)$/, "0.35)")}`, borderRadius: "6px", padding: "5px 12px", cursor: "pointer" });
const GOLD = "rgba(250,204,21,0.9)", GREY = "rgba(148,163,184,0.85)", RED = "rgba(248,113,113,0.9)";

export default function ImageQueue() {
  const [token, setToken] = useState(null);
  const [view, setView] = useState("queue");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  useEffect(() => { try { setToken(localStorage.getItem("kynda_admin_token") || ""); } catch { setToken(""); } }, []);

  const call = useCallback(async (method, body, query = "") => {
    const res = await fetch(`/api/admin/images${query}`, {
      method, headers: { "Content-Type": "application/json", "x-kynda-admin": token },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(res.status === 401 ? "Your admin sign-in has expired — sign in again at /admin." : json.error || "failed");
    return json;
  }, [token]);

  const load = useCallback(async () => {
    setError(null); setData(null);
    try { setData(await call("GET", null, `?view=${view}&limit=30`)); } catch (err) { setError(err.message); }
  }, [call, view]);
  useEffect(() => { if (token) load(); }, [token, load]);

  async function act(entityId, body) {
    setBusy(entityId); setError(null);
    try {
      const v = await call("POST", { entity_id: entityId, ...body });
      // Settled items leave the queue; anything still open stays with its fresh candidates.
      setData((d) => ({
        ...d,
        items: d.items.map((it) => (it.entity.id === entityId ? { ...it, ...v, done: view === "queue" && (v.current || v.settled === "none") } : it)),
      }));
    } catch (err) { setError(err.message); }
    finally { setBusy(null); }
  }

  if (token === null) return null;
  if (!token) {
    return (
      <main style={{ maxWidth: "520px", margin: "120px auto", padding: "0 24px", ...mono("13px") }}>
        Sign in at <a href="/admin" style={{ color: BASE.gold }}>/admin</a> first; this page uses the same login.
      </main>
    );
  }

  return (
    <main style={{ maxWidth: "1040px", margin: "0 auto", padding: "40px 24px 120px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "16px", flexWrap: "wrap", marginBottom: "8px" }}>
        <h1 style={{ fontFamily: FONTS.display, fontWeight: 400, fontSize: "34px", margin: 0 }}>
          <a href="/admin" style={{ color: "inherit", textDecoration: "none" }}><Wordmark /></a> <span style={{ color: BASE.gold }}>map images</span>
        </h1>
        <div style={{ display: "flex", gap: "8px" }}>
          {[["queue", "Needs a picture"], ["auto", "Automatic picks"]].map(([id, label]) => (
            <button key={id} onClick={() => setView(id)} aria-pressed={view === id}
              style={{ ...btn(view === id ? GOLD : GREY), background: view === id ? "rgba(250,204,21,0.08)" : "none" }}>{label}</button>
          ))}
          <button onClick={load} style={btn(GREY)}>Refresh</button>
        </div>
      </div>
      <p style={{ ...mono("12px"), lineHeight: 1.7, margin: "0 0 28px", maxWidth: "720px" }}>
        {view === "queue"
          ? `${data?.total ?? "…"} people, works and places on the map are waiting for a picture, busiest first. Only free licenses (and the settled fair-use classes for cover art, posters, title cards and jackets) appear here. You can also fix pictures right on any map while signed in.`
          : "Pictures the backfill applied on its own, newest first. Remove any that show the wrong person or thing."}
      </p>
      {error && <div style={{ ...mono("12px", RED), marginBottom: "16px" }}>{error}</div>}
      {!data && !error && <div style={mono("12px")}>Loading…</div>}
      {data?.items?.length === 0 && <div style={mono("12px")}>{view === "queue" ? "Nothing waiting. The queue is clear." : "No automatic picks yet."}</div>}

      <div style={{ display: "grid", gap: "14px" }}>
        {data?.items?.map((it) => (
          <section key={it.entity.id} style={{ background: BASE.surface, border: "1px solid rgba(255,255,255,0.07)", borderRadius: "10px", padding: "16px 18px", opacity: it.done ? 0.45 : 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "baseline" }}>
              <div>
                <span style={{ fontFamily: FONTS.display, fontSize: "21px" }}>{it.entity.name}</span>
                <span style={{ ...mono("11px"), marginLeft: "10px" }}>{[it.entity.kind, it.entity.domain].filter((x) => x && x !== "other").join(" · ")}{it.degree ? ` · on ${it.degree} map${it.degree === 1 ? "" : "s"}` : ""}</span>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                {it.current && <button disabled={busy === it.entity.id} onClick={() => act(it.entity.id, { action: "remove" })} style={btn(RED)}>Remove picture</button>}
                {!it.done && view === "queue" && <button disabled={busy === it.entity.id} onClick={() => act(it.entity.id, { action: "none" })} style={btn(GREY)}>No good picture</button>}
              </div>
            </div>
            {it.context?.[0] && <div style={{ fontSize: "13px", color: "rgba(226,232,240,0.7)", marginTop: "6px", lineHeight: 1.5 }}>{it.context[0]}</div>}
            {it.done && <div style={{ ...mono("11px", "rgba(52,211,153,0.85)"), marginTop: "8px" }}>{it.current ? "Picture applied." : "Marked as no good picture."}</div>}

            {view === "auto" && it.current && (
              <div style={{ display: "flex", gap: "14px", alignItems: "center", marginTop: "12px" }}>
                <img src={it.current.url} alt="" style={{ width: "84px", height: "84px", objectFit: "cover", borderRadius: "50%" }} />
                <div style={mono("11px")}>
                  {[it.current.license, it.current.credit].filter(Boolean).join(" · ")}<br />
                  {it.current.identity && <>matched by {it.current.identity}<br /></>}
                  {it.current.page && <a href={it.current.page} target="_blank" rel="noreferrer" style={{ color: GREY }}>source ↗</a>}
                </div>
              </div>
            )}

            {!it.done && view === "queue" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "10px", marginTop: "12px" }}>
                {it.candidates.map((c) => (
                  <figure key={c.id} style={{ margin: 0, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "8px", padding: "8px", display: "flex", flexDirection: "column", gap: "6px", minWidth: 0 }}>
                    <a href={c.page || c.url} target="_blank" rel="noreferrer" title="Open the source">
                      <img src={c.url} alt="" loading="lazy" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: "6px", display: "block", background: "#0f1016" }} />
                    </a>
                    <figcaption style={{ fontSize: "12px", lineHeight: 1.35, overflowWrap: "anywhere" }}>
                      <div>{c.title || c.source}</div>
                      {c.description && <div style={{ color: "rgba(148,163,184,0.8)" }}>{c.description}</div>}
                      <div style={mono("10px", c.fair_use ? "rgba(251,191,36,0.9)" : "rgba(148,163,184,0.7)")}>{c.fair_use ? "Fair use · " : ""}{[c.license, c.credit].filter(Boolean).join(" · ")}</div>
                    </figcaption>
                    <button disabled={busy === it.entity.id} onClick={() => act(it.entity.id, { action: "approve", candidate_id: c.id })} style={{ ...btn(GOLD), marginTop: "auto" }}>Use this</button>
                  </figure>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
