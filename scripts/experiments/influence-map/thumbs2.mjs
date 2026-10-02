import { readFileSync, writeFileSync } from "node:fs";
const data = JSON.parse(readFileSync("vonnegut.json","utf8"));
const out = JSON.parse(readFileSync("thumbs.json","utf8"));
const names = new Set(Object.keys(data));
for (const g of Object.values(data)) for (const k of ["predecessors","peers","successors"]) for (const n of g[k]||[]) names.add(n.name);
const st={ok:0,nf:0,nothumb:0,dis:0,err:{}};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const UA={"User-Agent":"KyndaPrototype/0.1 (brancato@gmail.com)"};
async function get(u){ for(let i=0;i<4;i++){ const r=await fetch(u,{headers:UA}); if(r.status!==429) return r; await sleep(1500*(i+1)); } return {ok:false,status:429}; }
for (const n of names) {
  if (out[n]) continue;
  const r = await get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(n.replace(/ /g,"_"))}?redirect=true`);
  if(!r.ok){ st.err[r.status]=(st.err[r.status]||0)+1; await sleep(120); continue; }
  const j=await r.json(); if(j.type==="disambiguation"){st.dis++;continue} if(!j.thumbnail){st.nothumb++;continue}
  const ir=await get(j.thumbnail.source.replace(/\/\d+px-/,"/120px-"));
  if(!ir.ok){ st.err["img"+ir.status]=(st.err["img"+ir.status]||0)+1; continue; }
  const buf=Buffer.from(await ir.arrayBuffer()); if(buf.length>40000) continue;
  out[n]=`data:${ir.headers.get("content-type")};base64,${buf.toString("base64")}`; st.ok++;
  await sleep(120);
}
writeFileSync("thumbs.json",JSON.stringify(out));
console.log(JSON.stringify(st), Object.keys(out).length,"total thumbs", Math.round(JSON.stringify(out).length/1024),"KB");
