import { disambiguate } from "../../../src/lib/pipeline/disambiguate.js";

export const maxDuration = 60;

export async function POST(req) {
  try {
    const { query } = await req.json();
    if (!query || typeof query !== "string" || !query.trim()) {
      return Response.json({ error: "query required" }, { status: 400 });
    }
    const result = await disambiguate(query.trim());
    return Response.json(result);
  } catch (err) {
    console.error("disambiguate error:", err);
    return Response.json({ error: err.message || "disambiguation failed" }, { status: 500 });
  }
}
