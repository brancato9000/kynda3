// Design tokens ported verbatim from kynda2 (KyndaApp.jsx + DECISIONS DD-01..DD-05).
// The v3 frontend consumes these; do not restyle during Phase 1 (parity + trust only).

export const FONTS = {
  display: "'Instrument Serif', serif",
  mono: "'DM Mono', monospace",
  body: "'DM Sans', sans-serif",
};

export const BASE = {
  background: "#0f1016",
  surface: "rgba(255,255,255,0.025)",
  surfaceRaised: "rgba(255,255,255,0.04)",
  textMuted: "rgba(148,163,184,0.5)",
  gold: "#facc15",
};

// KyndaMix slot taxonomy — the product's core vocabulary. Labels are final
// (e.g. "Influencia Obscura" was a deliberate kynda2 rename).
export const MIX_SLOT_TYPES = [
  { id: "titan", label: "Key Influence", emoji: "◆", description: "A foundational work cited as a seminal influence" },
  { id: "ghost", label: "Influencia Obscura", emoji: "◇", description: "An obscure or avant-garde influence not widely recognized" },
  { id: "geography", label: "Local Roots", emoji: "◈", description: "A connection rooted in shared geography or scene" },
  { id: "culture", label: "Beyond the Medium", emoji: "✦", description: "An influence from outside the subject's primary domain" },
  { id: "peer", label: "Peer", emoji: "◎", description: "A contemporary working in similar creative orbit" },
  { id: "essential", label: "From the Canon", emoji: "★", description: "A definitive work from the subject themselves" },
  { id: "legacy", label: "Legacy", emoji: "▹", description: "A successor carrying the creative torch forward" },
  { id: "collaborator", label: "Key Collaborator", emoji: "⊕", description: "A crucial creative partner who shaped the work" },
];

export const SLOT_COLORS = {
  titan: { bg: "rgba(255,140,50,0.06)", border: "rgba(255,140,50,0.22)", text: "#ff8c32" },
  ghost: { bg: "rgba(148,163,184,0.04)", border: "rgba(148,163,184,0.15)", text: "#94a3b8" },
  geography: { bg: "rgba(56,189,248,0.05)", border: "rgba(56,189,248,0.18)", text: "#38bdf8" },
  culture: { bg: "rgba(168,85,247,0.05)", border: "rgba(168,85,247,0.18)", text: "#a855f7" },
  peer: { bg: "rgba(251,113,133,0.05)", border: "rgba(251,113,133,0.18)", text: "#fb7185" },
  essential: { bg: "rgba(250,204,21,0.05)", border: "rgba(250,204,21,0.18)", text: "#facc15" },
  legacy: { bg: "rgba(52,211,153,0.05)", border: "rgba(52,211,153,0.18)", text: "#34d399" },
  collaborator: { bg: "rgba(129,140,248,0.05)", border: "rgba(129,140,248,0.18)", text: "#818cf8" },
};

// Influence graph palette (DD-03). Subject node: dark fill, gold border.
export const GRAPH_COLORS = {
  predecessor: { fill: "#a8c8d8", stroke: "rgba(168,200,216,0.3)" },
  peer: { fill: "#e04040", stroke: "rgba(224,64,64,0.3)" },
  successor: { fill: "#8844cc", stroke: "rgba(136,68,204,0.3)" },
  subjectBorder: "#facc15",
};

// Confidence badge colors (kynda2 confidence tiers UI, remapped to the v3
// provenance-derived tiers: verified / sourced / inferred).
export const CONFIDENCE_COLORS = {
  verified: "rgba(52,211,153,0.8)",
  sourced: "rgba(250,204,21,0.8)",
  inferred: "rgba(148,163,184,0.6)",
};

// Typewriter pacing (DD-02): ms per word, delay before start.
export const REVEAL_TIMING = {
  bio: { msPerWord: 55, delayMs: 400 },
  intro: { msPerWord: 45, delayMs: 900 },
  connectionContext: { msPerWord: 40, delayMs: 100 },
};
