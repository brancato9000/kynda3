"use client";

// Influence graph (V3-25) — ported from kynda2 (AD-04: let D3 own the SVG,
// React manages the container). Two upgrades over the original:
//   - node size = EVIDENCE weight (T2 citations ≫ documentation ≫ bare claim),
//     replacing the model-vibes "significance" score
//   - single click opens a provenance panel with the actual quotes/links
//     (kynda2 spent a Haiku call here; this is a free database read)
// Double-click navigates to the node as a new subject (AD-07).

import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";
import { FONTS, GRAPH_COLORS, BASE } from "../src/design/tokens.js";

const TYPE_COLORS = {
  ...GRAPH_COLORS,
  subject: { fill: "#1a1b22", stroke: "rgba(250,204,21,0.5)" },
};

const CLAIM_LABELS = {
  influenced_by: "influence", cited_as_influence: "cited influence",
  cross_medium_influence: "cross-medium influence", same_scene: "shared scene",
  collaborated_with: "collaboration", produced_by: "production", member_of: "membership",
  covers: "cover", covered_by: "covered by", used_gear: "gear", recorded_at: "recorded at",
  founded: "founded", taught_at: "taught at", studied_under: "studied under",
};

export default function GraphView({ data, subjectName, onNavigate }) {
  const containerRef = useRef(null);
  const simRef = useRef(null);
  const clickTimer = useRef(null);
  const [selected, setSelected] = useState(null);

  const handleNode = useCallback((d) => {
    if (d.type === "subject") return;
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      onNavigate?.(d.name);
      return;
    }
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      setSelected(d);
    }, 280);
  }, [onNavigate]);

  useEffect(() => {
    if (!data || !containerRef.current) return;
    const container = containerRef.current;
    d3.select(container).selectAll("svg").remove();

    const w = container.clientWidth;
    const h = container.clientHeight;

    const nodes = [{ id: "subject", name: subjectName, type: "subject", weight: 10, r: 44, fx: w / 2, fy: h / 2 }];
    const links = [];
    const addGroup = (items, type, targetX) => {
      (items || []).forEach((item, i) => {
        const r = 10 + (item.weight / 10) * 26;
        nodes.push({
          ...item, id: `${type}-${i}`, type, r,
          x: targetX + (Math.random() - 0.5) * 120,
          y: h / 2 + (Math.random() - 0.5) * (h * 0.6),
        });
        if (type === "predecessor") links.push({ source: `${type}-${i}`, target: "subject", type });
        else if (type === "successor") links.push({ source: "subject", target: `${type}-${i}`, type });
        else links.push({ source: `${type}-${i}`, target: "subject", type });
      });
    };
    addGroup(data.predecessors, "predecessor", w * 0.18);
    addGroup(data.peers, "peer", w * 0.5);
    addGroup(data.successors, "successor", w * 0.82);

    const svg = d3.select(container).append("svg")
      .attr("width", w).attr("height", h)
      .style("position", "absolute").style("top", 0).style("left", 0);

    const defs = svg.append("defs");
    ["predecessor", "successor"].forEach((type) => {
      defs.append("marker")
        .attr("id", `arrow-${type}`).attr("viewBox", "0 -5 10 10")
        .attr("refX", 10).attr("refY", 0).attr("markerWidth", 7).attr("markerHeight", 7)
        .attr("orient", "auto").append("path")
        .attr("d", "M0,-4L10,0L0,4").attr("fill", TYPE_COLORS[type].stroke);
    });

    const link = svg.append("g").selectAll("path").data(links).join("path")
      .attr("fill", "none")
      .attr("stroke", (d) => TYPE_COLORS[d.type].stroke)
      .attr("stroke-width", (d) => (d.type === "peer" ? 1 : 1.2))
      .attr("stroke-dasharray", (d) => (d.type === "peer" ? "3,5" : null))
      .attr("marker-end", (d) => (d.type === "peer" ? null : `url(#arrow-${d.type})`));

    const node = svg.append("g").selectAll("g").data(nodes).join("g")
      .style("cursor", (d) => (d.type === "subject" ? "default" : "pointer"));

    node.filter((d) => d.type !== "subject").append("circle")
      .attr("r", (d) => d.r)
      .attr("fill", (d) => TYPE_COLORS[d.type].fill)
      .attr("opacity", (d) => 0.55 + (d.weight / 10) * 0.45)
      // T2-cited nodes wear a gold ring — evidence is visible at a glance
      .attr("stroke", (d) => (d.tier === "cited" ? BASE.gold : "none"))
      .attr("stroke-width", (d) => (d.tier === "cited" ? 2 : 0));

    node.filter((d) => d.type === "subject").append("circle")
      .attr("r", 44).attr("fill", TYPE_COLORS.subject.fill)
      .attr("stroke", TYPE_COLORS.subject.stroke).attr("stroke-width", 3);

    node.append("text")
      .text((d) => (d.name.length > 26 ? d.name.slice(0, 25) + "…" : d.name))
      .attr("text-anchor", "middle").attr("dy", (d) => d.r + 16)
      .attr("fill", "rgba(220,230,240,0.8)")
      .attr("font-size", (d) => (d.type === "subject" ? "14px" : `${Math.max(10, 9 + d.weight * 0.4)}px`))
      .attr("font-weight", (d) => (d.type === "subject" ? "600" : "400"))
      .attr("font-family", "'DM Sans', sans-serif").attr("pointer-events", "none");

    node.filter((d) => d.year && d.type !== "subject").append("text")
      .text((d) => d.year).attr("text-anchor", "middle").attr("dy", (d) => d.r + 30)
      .attr("fill", "rgba(148,163,184,0.35)").attr("font-size", "10px")
      .attr("font-family", "'DM Mono', monospace").attr("pointer-events", "none");

    node.on("mouseenter", function (event, d) {
      if (d.type === "subject") return;
      d3.select(this).select("circle").transition().duration(150)
        .attr("opacity", 1).attr("stroke", TYPE_COLORS[d.type].fill).attr("stroke-width", 2);
    });
    node.on("mouseleave", function (event, d) {
      if (d.type === "subject") return;
      d3.select(this).select("circle").transition().duration(200)
        .attr("opacity", 0.55 + (d.weight / 10) * 0.45)
        .attr("stroke", d.tier === "cited" ? BASE.gold : "none")
        .attr("stroke-width", d.tier === "cited" ? 2 : 0);
    });
    node.on("click", (event, d) => handleNode(d));

    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d) => d.id).distance(150).strength(0.25))
      .force("charge", d3.forceManyBody().strength((d) => (d.type === "subject" ? -500 : -130)))
      .force("collide", d3.forceCollide((d) => d.r + 16).strength(0.8))
      .force("x", d3.forceX((d) => {
        if (d.type === "subject") return w / 2;
        if (d.type === "predecessor") return w * 0.2;
        if (d.type === "peer") return w * 0.5;
        return w * 0.8;
      }).strength(0.12))
      .force("y", d3.forceY(h / 2).strength(0.06))
      .alphaDecay(0.02)
      .on("tick", () => {
        nodes.forEach((d) => {
          if (d.id !== "subject") {
            d.x = Math.max(d.r + 5, Math.min(w - d.r - 5, d.x));
            d.y = Math.max(d.r + 30, Math.min(h - d.r - 45, d.y));
          }
        });
        link.attr("d", (d) => {
          const sx = d.source.x, sy = d.source.y, tx = d.target.x, ty = d.target.y;
          const dx = tx - sx, dy = ty - sy, dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const ex = tx - (dx / dist) * (d.target.r + 6);
          const ey = ty - (dy / dist) * (d.target.r + 6);
          const midX = (sx + ex) / 2, midY = (sy + ey) / 2;
          return `M${sx},${sy} Q${midX - (ey - sy) * 0.12},${midY + (ex - sx) * 0.12} ${ex},${ey}`;
        });
        node.attr("transform", (d) => `translate(${d.x},${d.y})`);
      });
    simRef.current = simulation;

    const drag = d3.drag()
      .on("start", (event, d) => {
        if (d.type === "subject") return;
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
      })
      .on("drag", (event, d) => { if (d.type !== "subject") { d.fx = event.x; d.fy = event.y; } })
      .on("end", (event, d) => {
        if (d.type === "subject") return;
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null; d.fy = null;
      });
    node.call(drag);

    if (data.domain) {
      svg.append("text").text(data.domain)
        .attr("x", w - 24).attr("y", h - 20).attr("text-anchor", "end")
        .attr("fill", "rgba(255,255,255,0.07)").attr("font-size", "72px")
        .attr("font-weight", "900").attr("font-family", "'DM Sans', sans-serif")
        .attr("pointer-events", "none");
    }

    return () => simulation.stop();
  }, [data, subjectName, handleNode]);

  return (
    <div>
      <div ref={containerRef} style={{ position: "relative", width: "100%", height: "540px", background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", overflow: "hidden" }} />
      <div style={{ display: "flex", gap: "18px", alignItems: "center", marginTop: "10px", flexWrap: "wrap", fontFamily: FONTS.mono, fontSize: "10px", letterSpacing: "0.06em", color: "rgba(148,163,184,0.6)" }}>
        {[["INFLUENCES", GRAPH_COLORS.predecessor.fill], ["PEERS & PARTNERS", GRAPH_COLORS.peer.fill], ["SUCCESSORS", GRAPH_COLORS.successor.fill]].map(([label, color]) => (
          <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: color }} />{label}
          </span>
        ))}
        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", border: `2px solid ${BASE.gold}` }} />PRIMARY-SOURCE CITED
        </span>
        <span>· NODE SIZE = DOCUMENTED EVIDENCE · CLICK FOR SOURCES · DOUBLE-CLICK TO EXPLORE</span>
      </div>

      {selected && (
        <div style={{ marginTop: "14px", padding: "18px 20px", background: "rgba(15,16,22,0.95)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: "10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "12px" }}>
            <div>
              <span style={{ fontFamily: FONTS.display, fontSize: "20px" }}>{selected.name}</span>
              <span style={{ fontFamily: FONTS.mono, fontSize: "11px", marginLeft: "10px", color: TYPE_COLORS[selected.type]?.fill, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {CLAIM_LABELS[selected.claimType] || selected.claimType}
              </span>
            </div>
            <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "rgba(148,163,184,0.5)", cursor: "pointer", fontSize: "16px" }}>×</button>
          </div>
          {selected.creator && (
            <div style={{ fontFamily: FONTS.mono, fontSize: "11px", color: "rgba(148,163,184,0.7)", marginTop: "2px" }}>
              {selected.creator}{selected.year ? ` · ${selected.year}` : ""}
            </div>
          )}
          {selected.evidence?.length > 0 ? (
            <div style={{ marginTop: "12px", display: "grid", gap: "10px" }}>
              {selected.evidence.map((p, i) => (
                <div key={i} style={{ paddingLeft: "12px", borderLeft: "2px solid rgba(52,211,153,0.35)" }}>
                  {p.quote && (
                    <div style={{ fontFamily: FONTS.display, fontStyle: "italic", fontSize: "13px", lineHeight: 1.6, color: "rgba(226,232,240,0.78)" }}>
                      “{p.quote.length > 240 ? p.quote.slice(0, 237) + "…" : p.quote}”
                    </div>
                  )}
                  <a href={p.url} target="_blank" rel="noreferrer"
                    style={{ fontFamily: FONTS.mono, fontSize: "10px", color: "rgba(52,211,153,0.75)", textDecoration: "none" }}>
                    — {p.speaker ? `${p.speaker}, via ` : ""}{p.publication || p.method} ↗
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ marginTop: "10px", fontFamily: FONTS.mono, fontSize: "11px", color: "rgba(148,163,184,0.55)" }}>
              Kynda’s synthesis — no independent documentation confirmed yet. Double-click the node to explore it as a subject.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
