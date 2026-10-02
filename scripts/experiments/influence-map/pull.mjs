import { readFileSync, writeFileSync } from "node:fs";
const ROOT = "/Users/tonybrancato/Documents/Projects/kynda3";
for (const line of readFileSync(`${ROOT}/.env.local`, "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const { getGraphForSubject } = await import(`${ROOT}/src/lib/store.js`);
const { getPool, q } = await import(`${ROOT}/src/lib/db.js`);
const out = {};
const root = await getGraphForSubject({ name: "Kurt Vonnegut", wikidata_qid: "Q49074" });
out["Kurt Vonnegut"] = root;
const names = new Set();
for (const k of ["predecessors","peers","successors"]) for (const n of root?.[k]||[]) names.add(n.name);
for (const n of names) { const g = await getGraphForSubject({ name: n }).catch(()=>null); if (g) out[n] = g; }
writeFileSync(`${process.argv[2]}`, JSON.stringify(out));
console.log(Object.keys(out).length, "graphs");
for (const [k,g] of Object.entries(out)) console.log(k, ["predecessors","peers","successors"].map(x=>(g[x]||[]).length).join("/"));
console.log(JSON.stringify(root.predecessors?.[0], null, 1).slice(0,1500));
await getPool().end();
