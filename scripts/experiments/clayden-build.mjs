// Pauline Clayden (Tony, 2026-08-19, from the NYT homepage): a dance
// subject with a fresh, citation-rich obituary by Alastair Macaulay —
// the Sydney thesis in one page. QID-first per V3-80; the NYT text was
// supplied by Tony (gift-link PDF) and the wall verifies against the
// text we hold, same as OCR and podcast transcripts. Reader comments
// are deliberately NOT ingested: anonymous, no stable per-comment URL,
// identity unverifiable — eyewitness gems, but not citations.
//   node scripts/experiments/clayden-build.mjs   (expects data/sources/nyt-pauline-clayden-2026-08-17.txt, gitignored)
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
for (const line of readFileSync(`${ROOT}/.env.local`, "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const { q, getPool } = await import(`${ROOT}/src/lib/db.js`);
const { upsertEntity } = await import(`${ROOT}/src/lib/store.js`);
const { harvestSubjectWikipedia, harvestText } = await import(`${ROOT}/src/lib/pipeline/harvest.js`);
const { generateMix, loadSubjectArticle, verifyAttribution, verifyConnection } = await import(`${ROOT}/src/lib/pipeline/mix.js`);
const { persistMixRun } = await import(`${ROOT}/src/lib/store.js`);
const { getIntroExtract } = await import(`${ROOT}/src/lib/entities/wikipedia.js`);
const { usageSummary } = await import(`${ROOT}/src/lib/ai/anthropic.js`);

const QID = "Q18387176";
const UA = { "User-Agent": "Kynda/3.0 (kynda3.vercel.app; brancato@gmail.com)" };
const ALLOW = /^(public domain|pd|cc0|cc[ -]by(-sa)?([ -]\d(\.\d)?)?)/i;

// 1 — entity, QID in hand
const id = await upsertEntity({ name: "Pauline Clayden", kind: "person", domain: "dance", wikidata_qid: QID });
await q(`UPDATE entities SET kind = 'person', domain = 'dance', wikidata_qid = COALESCE(wikidata_qid, $2) WHERE id = $1`, [id, QID]);
console.log("entity:", id);

// portrait via P18, license-gated
const wd = await (await fetch(`https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${QID}&property=P18&format=json`, { headers: UA })).json();
const file = wd.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
if (file) {
  const c = await (await fetch(`https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent("File:" + file)}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=800&format=json`, { headers: UA })).json();
  const ii = Object.values(c.query?.pages || {})[0]?.imageinfo?.[0];
  const lic = ii?.extmetadata?.LicenseShortName?.value || "";
  console.log("P18:", file, "|", lic);
  if (ii && ALLOW.test(lic)) {
    const credit = ((ii.extmetadata?.Artist?.value || "").replace(/<[^>]+>/g, "").trim() || "Wikimedia Commons").slice(0, 120);
    await q(`UPDATE entities SET metadata = metadata || $2::jsonb WHERE id = $1`,
      [id, JSON.stringify({ image_url: ii.thumburl || ii.url, image_page: ii.descriptionurl, image_license: lic, image_credit: credit })]);
    console.log("portrait stamped");
  }
} else console.log("no P18");

// 2 — Wikipedia harvest (QID sitelink)
const hw = await harvestSubjectWikipedia({ name: "Pauline Clayden", wikidata_qid: QID }).catch((e) => ({ error: e.message }));
console.log("wikipedia harvest:", JSON.stringify(hw).slice(0, 140));

// 3 — the NYT obituary, text-in-hand
const text = readFileSync(`${ROOT}/data/sources/nyt-pauline-clayden-2026-08-17.txt`, "utf8");
const hn = await harvestText({
  url: "https://www.nytimes.com/2026/08/17/arts/dance/pauline-clayden-dead.html",
  text,
  publication: "The New York Times",
  publishedDate: "2026-08-17",
  sourceNote: "Obituary by Alastair Macaulay; text supplied via Tony's gift-link copy, quotes wall-verified against the held text.",
  log: () => {},
}).catch((e) => ({ error: e.message }));
console.log("NYT harvest:", JSON.stringify({ confirmed: hn?.confirmed, claims: hn?.claims, error: hn?.error }).slice(0, 200));

// 4 — the mix, with the obituary's facts as curated context
const bio = await getIntroExtract({ name: "Pauline Clayden", qid: QID, maxChars: 900 }).catch(() => null);
const subject = { name: "Pauline Clayden", kind: "person", domain: "dance", wikidata_qid: QID, bio: bio ? { text: bio.text } : null };
const NOTES = [
  `Facts from her New York Times obituary (Alastair Macaulay, 2026-08-17) — treat as reliable and build the map around them:`,
  `She was the last known surviving soloist of the opening night of Sadler's Wells Ballet's "The Sleeping Beauty" at the Metropolitan Opera House, Oct 9 1949 — the performance that reset the bar for American dance; dancers of the year-old New York City Ballet and of American Ballet Theatre took crucial inspiration from it. She danced the Fairy of the Songbirds. Ninette de Valois directed the staging and company. Margot Fonteyn was the Aurora; Clayden was often her second cast.`,
  `Training and scenes: accepted 1939 into the opera ballet at the Royal Opera House, Covent Garden, under the young Antony Tudor (soon to leave for American Ballet Theatre). In wartime joined the London Ballet at the Arts Theatre Club, closely intertwined with Ballet Rambert, dancing through doodlebug raids. Joined Sadler's Wells (Vic-Wells) in 1942; the 1946 Royal Opera House "Sleeping Beauty" (Tchaikovsky) had her as Songbirds Fairy from the start. Born Lewisham, southeast London, 1922.`,
  `Frederick Ashton: she created supporting roles in the premieres of SEVEN Ashton ballets 1946–1955, including "Scènes de ballet" (1948, polyrhythmic Stravinsky score — she drew colored diagrams of his Euclidean patterning); danced a goat with Brian Shaw in "Sylvia" (1952); Ashton made an exception to his Fonteyn preference for her Chloë in "Daphnis and Chloë" (1951); he coached her Giselle (1953) and wrote in 1956 that hers was among the best he had ever seen. After retiring she returned to the Royal Ballet to coach the Fonteyn-Ashton roles ("Nocturne", "Daphnis and Chloë", "Homage to the Queen").`,
  `Prefer candidates these facts support; where a card comes from the obituary, ground the reason in it.`,
];
const mix = await generateMix(subject, [], { model: "claude-opus-5", maxTokens: 32_000, notes: NOTES });
console.log("\nintro:", (mix.intro || "").slice(0, 200));
const article = await loadSubjectArticle(subject);
const slots = [];
let n = 0, verified = 0, documented = 0;
for (const slot of mix.slots) {
  const cands = [];
  for (const item of slot.candidates) {
    const [attribution, connection] = [
      await verifyAttribution(item).catch(() => null),
      await verifyConnection(item, subject, article, []).catch(() => null),
    ];
    cands.push({ item, verification: { attribution, connection, citations: [] } });
    n += 1;
    if (attribution?.status === "verified") verified += 1;
    if (connection?.status?.startsWith("documented")) documented += 1;
    console.log(`  [${item.slotType}] ${item.title} — ${item.creator} (${item.year || "?"}) | attr:${attribution?.status || "-"} conn:${connection?.status || "-"}`);
  }
  slots.push({ slotType: slot.slotType, candidates: cands });
}
await persistMixRun({ subject, rawQuery: "Pauline Clayden", intro: mix.intro, slots, modelVersion: "claude-opus-5" });
console.log(`\n${n} cards | verified ${verified} | documented ${documented} | spend $${usageSummary().totalUsd.toFixed(2)}`);
await getPool().end();
