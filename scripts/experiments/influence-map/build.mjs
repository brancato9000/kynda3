import { readFileSync, writeFileSync } from "node:fs";
const g = JSON.parse(readFileSync("vonnegut.json","utf8")); const slim={};
for (const [k,v] of Object.entries(g)) { slim[k]={}; for (const t of ["predecessors","peers","successors"]) slim[k][t]=(v[t]||[]).map(n=>({name:n.name,creator:n.creator||undefined,year:n.year??undefined,claimType:n.claimType,summary:n.summary||undefined,weight:n.weight,tier:n.tier,evidence:(n.evidence||[]).slice(0,3).map(e=>({quote:e.quote||undefined,url:e.url||undefined,publication:e.publication||undefined,speaker:e.speaker||undefined}))})); }
const th = JSON.parse(readFileSync("thumbs-small.json","utf8"));
const html = readFileSync("template.html","utf8").replace("/*__DATA__*/", () => JSON.stringify(slim).replace(/<\//g,"<\\/")).replace("/*__THUMBS__*/", () => JSON.stringify(th)).replace("/*__MIXES__*/", () => readFileSync("mixes.json","utf8").replace(/<\//g,"<\\/")).replace("/*__MIX_THUMBS__*/", () => readFileSync("mix-thumbs.json","utf8"));
writeFileSync("/Users/tonybrancato/Documents/Projects/kynda3/docs/influence-map-prototype.html", html);
console.log(Math.round(html.length/1024),"KB");
