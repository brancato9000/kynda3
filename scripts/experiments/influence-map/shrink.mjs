import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
const t = JSON.parse(readFileSync("thumbs.json","utf8")); const out={}; let i=0;
for (const [k,v] of Object.entries(t)) {
  const m=v.match(/^data:([^;]+);base64,(.*)$/); const ext=m[1].includes("svg")?"svg":m[1].split("/")[1]||"img";
  const src=`tx/${i}.${ext}`, dst=`tx/${i}.jpg`; i++;
  writeFileSync(src, Buffer.from(m[2],"base64"));
  try { execFileSync("sips",["-s","format","jpeg","-s","formatOptions","62","-Z","96",src,"--out",dst],{stdio:"ignore"}); out[k]="data:image/jpeg;base64,"+readFileSync(dst).toString("base64"); } catch {}
}
writeFileSync("thumbs-small.json",JSON.stringify(out));
console.log(Object.keys(out).length, Math.round(JSON.stringify(out).length/1024),"KB");
