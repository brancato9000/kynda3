// Replays the Wikipedia article-image lookup with full logging, no writes —
// the V3-83 autopsy tool. Shows, per card, which search hits came back and
// how the title and creator gates judged each one. Pass "Title|Creator" pairs.
//   node scripts/experiments/probe-article-image.mjs "Bring the Pain|Chris Rock" "Gremlins|Joe Dante"
const UA = { "User-Agent": "Kynda/3.0 (kynda3.vercel.app; brancato@gmail.com)" };
const nrm = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const stripParen = (s) => (s || "").replace(/\s*\(.*?\)\s*$/, "");
async function enwiki(params) {
  const u = new URL("https://en.wikipedia.org/w/api.php");
  for (const [k, v] of Object.entries({ format: "json", ...params })) u.searchParams.set(k, v);
  return (await fetch(u, { headers: UA })).json();
}
async function page(titles) {
  const d = await enwiki({ action: "query", titles, redirects: "1", prop: "pageimages|extracts", exintro: "1", explaintext: "1", piprop: "name|original", pithumbsize: "640", pilicense: "any" });
  const p = Object.values(d.query?.pages || {})[0];
  return p && p.missing === undefined ? p : null;
}
const judge = (p, title, creator) => {
  const opening = (p.extract || "").split(/(?<=[.!?])\s+/).slice(0, 2).join(" ");
  const tm = nrm(stripParen(p.title)) === nrm(stripParen(title)) || nrm(p.title) === nrm(title);
  const cm = nrm(opening).includes(nrm(creator)) || nrm(p.title).includes(nrm(creator));
  return `"${p.title}" img:${p.pageimage ? "Y" : "-"} title:${tm ? "✓" : "✗"} creator(opening):${cm ? "✓" : "✗"} | ${(p.extract || "").slice(0, 80).replace(/\n/g, " ")}`;
};
for (const arg of process.argv.slice(2)) {
  const [title, creator] = arg.split("|").map((s) => s.trim());
  console.log(`\n${title} — ${creator}`);
  const pre = await page(`${creator}: ${title}`);
  console.log(`  prefixed: ${pre ? judge(pre, title, creator) : "(no article)"}`);
  const bare = await page(title);
  console.log(`  direct:   ${bare ? judge(bare, title, creator) : "(no article)"}`);
  const s = await enwiki({ action: "query", list: "search", srsearch: `${title} ${creator}`, srlimit: "3" });
  for (const hit of s.query?.search || []) {
    const p = await page(hit.title);
    if (p) console.log(`  search:   ${judge(p, title, creator)}`);
  }
}
