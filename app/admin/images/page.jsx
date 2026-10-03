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
  const [view, setView] = useState("bulk");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [bulkKey, setBulkKey] = useState(0);

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
    if (view === "bulk") return; // the bulk view loads its own data
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
  if (token && view === "bulk") {
    return (
      <main style={{ maxWidth: "1180px", margin: "0 auto", padding: "40px 24px 140px" }}>
        <Header view={view} setView={setView} onRefresh={() => setBulkKey((k) => k + 1)} />
        <BulkView key={bulkKey} call={call} />
      </main>
    );
  }
  if (!token) {
    return (
      <main style={{ maxWidth: "520px", margin: "120px auto", padding: "0 24px", ...mono("13px") }}>
        Sign in at <a href="/admin" style={{ color: BASE.gold }}>/admin</a> first; this page uses the same login.
      </main>
    );
  }

  return (
    <main style={{ maxWidth: "1040px", margin: "0 auto", padding: "40px 24px 120px" }}>
      <Header view={view} setView={setView} onRefresh={load} />
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
                <img src={it.current.url} alt="" style={{ width: "84px", height: "84px", objectFit: "cover", objectPosition: "50% 0%", borderRadius: "50%" }} />
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
                      <img src={c.url} alt="" loading="lazy" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", objectPosition: "50% 0%", borderRadius: "6px", display: "block", background: "#0f1016" }} />
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

function Header({ view, setView, onRefresh }) {
  return (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "16px", flexWrap: "wrap", marginBottom: "8px" }}>
      <h1 style={{ fontFamily: FONTS.display, fontWeight: 400, fontSize: "34px", margin: 0 }}>
        <a href="/admin" style={{ color: "inherit", textDecoration: "none" }}><Wordmark /></a> <span style={{ color: BASE.gold }}>map images</span>
      </h1>
      <div style={{ display: "flex", gap: "8px" }}>
        {[["bulk", "By category"], ["queue", "Needs a picture"], ["auto", "Automatic picks"]].map(([id, label]) => (
          <button key={id} onClick={() => setView(id)} aria-pressed={view === id}
            style={{ ...btn(view === id ? GOLD : GREY), background: view === id ? "rgba(250,204,21,0.08)" : "none" }}>{label}</button>
        ))}
        <button onClick={onRefresh} style={btn(GREY)}>Refresh</button>
      </div>
    </div>
  );
}

// ── By category: a page of best guesses at a time; strong matches arrive checked. ──
function BulkView({ call }) {
  const [cats, setCats] = useState(null);
  const [cat, setCat] = useState(null);
  const [page, setPage] = useState(null);
  const [choice, setChoice] = useState({});   // entity id → index into [pick, ...alts]
  const [checked, setChecked] = useState({}); // entity id → bool
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);  // two-step confirm for "no good picture"
  const [note, setNote] = useState(null);
  const [error, setError] = useState(null);

  const loadCats = useCallback(async () => {
    try { setCats(await call("GET", null, "?view=categories")); } catch (e) { setError(e.message); }
  }, [call]);
  const loadPage = useCallback(async (name) => {
    setPage(null); setArmed(false); setError(null);
    try {
      const p = await call("GET", null, `?view=bulk&category=${encodeURIComponent(name)}`);
      setPage(p);
      setChoice({});
      setChecked(Object.fromEntries(p.items.map((it) => [it.entity.id, it.strong])));
    } catch (e) { setError(e.message); }
  }, [call]);
  useEffect(() => { loadCats(); }, [loadCats]);
  useEffect(() => { if (cat) loadPage(cat); }, [cat, loadPage]);

  const options = (it) => [it.pick, ...(it.alts || [])];
  const current = (it) => options(it)[choice[it.entity.id] || 0];
  const nChecked = page ? page.items.filter((it) => checked[it.entity.id]).length : 0;
  const nUnchecked = page ? page.items.length - nChecked : 0;

  async function approve() {
    setBusy(true); setNote(null);
    try {
      const items = page.items.filter((it) => checked[it.entity.id]).map((it) => ({ entity_id: it.entity.id, candidate_id: current(it).id }));
      const r = await call("POST", { action: "approve_many", items });
      setNote(`${r.applied} picture${r.applied === 1 ? "" : "s"} applied.`);
      await Promise.all([loadPage(cat), loadCats()]);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function noneForUnchecked() {
    if (!armed) { setArmed(true); return; }
    setBusy(true); setNote(null);
    try {
      const ids = page.items.filter((it) => !checked[it.entity.id]).map((it) => it.entity.id);
      const r = await call("POST", { action: "none_many", entity_ids: ids });
      setNote(`${r.marked} marked as having no good picture.`);
      await Promise.all([loadPage(cat), loadCats()]);
    } catch (e) { setError(e.message); } finally { setBusy(false); setArmed(false); }
  }

  return (
    <>
      <p style={{ ...mono("12px"), lineHeight: 1.7, margin: "0 0 20px", maxWidth: "760px" }}>
        The queue sorted by what each entry's best candidate says it is. Strong matches (the exact name on Wikipedia or Wikidata, described as the right kind of thing, or an exact album-cover match) arrive checked. Uncheck anything wrong, check anything right, approve the page. Unchecked entries stay in the queue.
      </p>
      {error && <div style={{ ...mono("12px", RED), marginBottom: "12px" }}>{error}</div>}
      {!cats && !error && <div style={mono("12px")}>Sorting the queue…</div>}
      {cats && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "22px" }}>
          {cats.categories.map((c) => (
            <button key={c.name} onClick={() => setCat(c.name)} aria-pressed={cat === c.name}
              style={{ ...btn(cat === c.name ? GOLD : GREY), background: cat === c.name ? "rgba(250,204,21,0.08)" : "none" }}>
              {c.name} <span style={{ opacity: 0.7 }}>{c.total}</span>{c.strong ? <span style={{ color: "rgba(52,211,153,0.9)" }}> · {c.strong} strong</span> : null}
            </button>
          ))}
        </div>
      )}
      {cat && !page && !error && <div style={mono("12px")}>Loading {cat}…</div>}
      {page && (
        <>
          <div style={{ ...mono("12px"), marginBottom: "12px" }}>
            {cat}: showing {page.items.length} of {page.total}{note ? <span style={{ color: "rgba(52,211,153,0.9)", marginLeft: "12px" }}>{note}</span> : null}
          </div>
          {page.items.length === 0 && <div style={mono("12px")}>Nothing left in {cat}.</div>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: "12px" }}>
            {page.items.map((it) => {
              const c = current(it), on = !!checked[it.entity.id], n = options(it).length;
              return (
                <figure key={it.entity.id} style={{ margin: 0, background: BASE.surface, border: `1px solid ${on ? "rgba(52,211,153,0.55)" : "rgba(255,255,255,0.07)"}`, borderRadius: "10px", padding: "8px", display: "flex", flexDirection: "column", gap: "6px", minWidth: 0, opacity: on ? 1 : 0.72 }}>
                  <label style={{ position: "relative", cursor: "pointer", display: "block" }}>
                    <img src={c.url} alt="" loading="lazy" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", objectPosition: "50% 0%", borderRadius: "7px", display: "block", background: "#0f1016" }} />
                    <input type="checkbox" checked={on} onChange={(e) => setChecked((x) => ({ ...x, [it.entity.id]: e.target.checked }))}
                      aria-label={`Use this picture for ${it.entity.name}`} style={{ position: "absolute", top: "8px", left: "8px", width: "20px", height: "20px", accentColor: "#34d399" }} />
                    {it.strong && (choice[it.entity.id] || 0) === 0 && <span style={{ position: "absolute", top: "8px", right: "8px", ...mono("9px", "#0f1016"), background: "rgba(52,211,153,0.9)", borderRadius: "8px", padding: "1px 6px" }}>STRONG</span>}
                  </label>
                  <div style={{ fontFamily: FONTS.display, fontSize: "16px", lineHeight: 1.15, overflowWrap: "anywhere" }}>{it.entity.name}</div>
                  <div style={{ fontSize: "11.5px", lineHeight: 1.35, color: "rgba(226,232,240,0.8)", overflowWrap: "anywhere" }}>
                    {c.title && c.title !== it.entity.name ? <b style={{ fontWeight: 500 }}>{c.title}: </b> : null}{(c.description || c.source).replace(/ · role:.*$/, "")}
                  </div>
                  <div style={mono("9.5px", c.fair_use ? "rgba(251,191,36,0.9)" : "rgba(148,163,184,0.7)")}>{c.fair_use ? "Fair use · " : ""}{[c.license, c.credit].filter(Boolean).join(" · ").slice(0, 90)}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
                    <a href={c.page || c.url} target="_blank" rel="noreferrer" style={mono("10px", GREY)}>source ↗</a>
                    {n > 1 && (
                      <button onClick={() => setChoice((x) => ({ ...x, [it.entity.id]: ((x[it.entity.id] || 0) + 1) % n }))}
                        title="Show the next candidate" style={{ ...btn(GREY), padding: "2px 8px" }}>↻ {(choice[it.entity.id] || 0) + 1}/{n}</button>
                    )}
                  </div>
                </figure>
              );
            })}
          </div>
          {page.items.length > 0 && (
            <div style={{ position: "sticky", bottom: 0, marginTop: "18px", padding: "14px 0", background: "rgba(15,16,22,0.94)", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
              <button disabled={busy || !nChecked} onClick={approve} style={{ ...btn("rgba(52,211,153,0.95)"), background: "rgba(52,211,153,0.1)", padding: "8px 16px" }}>
                {busy ? "Working…" : `Approve ${nChecked} checked`}
              </button>
              <button disabled={busy || !nUnchecked} onClick={noneForUnchecked} style={{ ...btn(armed ? RED : GREY), padding: "8px 16px" }}>
                {armed ? `Click again: mark ${nUnchecked} as no good picture` : `Mark ${nUnchecked} unchecked as no good picture`}
              </button>
              <button disabled={busy} onClick={() => setChecked(Object.fromEntries(page.items.map((it) => [it.entity.id, false])))} style={btn(GREY)}>Uncheck all</button>
              <button disabled={busy} onClick={() => setChecked(Object.fromEntries(page.items.map((it) => [it.entity.id, true])))} style={btn(GREY)}>Check all</button>
            </div>
          )}
        </>
      )}
    </>
  );
}
