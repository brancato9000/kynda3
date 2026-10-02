import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
const ROOT = "/Users/tonybrancato/Documents/Projects/kynda3", S = process.argv[2];
for (const line of readFileSync(`${ROOT}/.env.local`, "utf8").split("\n")) { const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const { getStoredMix } = await import(`${ROOT}/src/lib/store.js`);
const { getPool } = await import(`${ROOT}/src/lib/db.js`);
const graphs = JSON.parse(readFileSync(`${S}/vonnegut.json`, "utf8"));
const out = {}; const imgs = {};
for (const name of Object.keys(graphs)) {
  const mix = await getStoredMix(name === "Kurt Vonnegut" ? { name, wikidata_qid: "Q49074" } : { name }).catch(() => null);
  if (!mix?.slots) continue;
  out[name] = mix.slots.flatMap((s) => (s.candidates || []).map((c) => { const it = c.item || c; return { title: it.title, creator: it.creator, year: it.year ? +it.year || undefined : undefined, slotType: s.slotType || it.slotType, reason: it.reason, medium: it.medium, imageUrl: it.imageUrl }; }));
}
await getPool().end();
console.log(Object.keys(out).length, "subjects with mixes;", Object.values(out).reduce((a, b) => a + b.length, 0), "cards");
mkdirSync(`${S}/mx`, { recursive: true });
const UA = { "User-Agent": "KyndaPrototype/0.1 (brancato@gmail.com)" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let i = 0, ok = 0;
for (const cards of Object.values(out)) for (const c of cards) {
  if (!c.imageUrl || imgs[c.title]) continue;
  let u = c.imageUrl.split("?")[0];
  const m = u.match(/^https:\/\/upload\.wikimedia\.org\/wikipedia\/(\w+)\/(\w)\/(\w\w)\/([^/]+)$/);
  if (m) u = `https://upload.wikimedia.org/wikipedia/${m[1]}/thumb/${m[2]}/${m[3]}/${m[4]}/120px-${m[4]}${/\.svg$/i.test(m[4]) ? ".png" : ""}`;
  else u = u.replace(/\/\d+px-/, "/120px-");
  try {
    let r; for (let t = 0; t < 3; t++) { r = await fetch(u, { headers: UA }); if (r.status !== 429) break; await sleep(1500 * (t + 1)); }
    if (!r.ok) { r = await fetch(c.imageUrl, { headers: UA }); if (!r.ok) continue; }
    const src = `${S}/mx/${i}.img`, dst = `${S}/mx/${i}.jpg`; i++;
    writeFileSync(src, Buffer.from(await r.arrayBuffer()));
    execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "65", "-Z", "120", src, "--out", dst], { stdio: "ignore" });
    imgs[c.title] = "data:image/jpeg;base64," + readFileSync(dst).toString("base64"); ok++;
  } catch {}
  await sleep(100);
}
for (const cards of Object.values(out)) for (const c of cards) delete c.imageUrl;
writeFileSync(`${S}/mixes.json`, JSON.stringify(out));
writeFileSync(`${S}/mix-thumbs.json`, JSON.stringify(imgs));
console.log(ok, "mix images,", Math.round(JSON.stringify(imgs).length / 1024), "KB");
