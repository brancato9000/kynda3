import { readFileSync, writeFileSync } from "node:fs";
const ROOT = "/Users/tonybrancato/Documents/Projects/kynda3";
for (const line of readFileSync(`${ROOT}/.env.local`, "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const { getGraphForSubject } = await import(`${ROOT}/src/lib/store.js`);
const { getPool } = await import(`${ROOT}/src/lib/db.js`);
const out = JSON.parse(readFileSync(process.argv[2],"utf8"));
const nb = g => ["predecessors","peers","successors"].flatMap(k => (g[k]||[]).map(n=>n.name));
let frontier = [...new Set(Object.values(out).flatMap(nb))].filter(n=>!(n in out));
for (const n of frontier) { const g = await getGraphForSubject({ name: n }).catch(()=>null); if (g && nb(g).length) out[n]=g; }
writeFileSync(process.argv[2], JSON.stringify(out));
const all = new Set(Object.keys(out)); for (const g of Object.values(out)) nb(g).forEach(x=>all.add(x));
console.log(Object.keys(out).length,"graphs;", all.size, "distinct nodes; size", Math.round(JSON.stringify(out).length/1024),"KB");
const big = Object.entries(out).map(([k,g])=>[k,nb(g).length]).sort((a,b)=>b[1]-a[1]).slice(0,15); console.log(big);
await getPool().end();
