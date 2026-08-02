// Spend ledger (V3-60): wave and harvest ledgers printed to the console and
// scrolled away — "how much did we spend?" deserved a receipt, not an
// estimate. Token-spending scripts append one JSONL line per run;
// scripts/spend.mjs sums them. Worktree runs resolve to the MAIN repo root
// so parallel sessions share one ledger (the Wave C lesson: its progress
// file lived in a worktree nobody looked at).
import { appendFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

export function spendFile(root) {
  try {
    const gitDir = execSync("git rev-parse --path-format=absolute --git-common-dir", {
      cwd: root, stdio: ["ignore", "pipe", "ignore"],
    }).toString().trim();
    return path.join(path.dirname(gitDir), "spend.jsonl");
  } catch {
    return path.join(root, "spend.jsonl");
  }
}

export function recordSpend(root, script, usd, note) {
  if (!usd || usd < 0.005) return; // don't ledger free runs
  const line = JSON.stringify({ ts: new Date().toISOString(), script, usd: Math.round(usd * 1000) / 1000, note });
  try { appendFileSync(spendFile(root), line + "\n"); } catch { /* the ledger must never break a run */ }
}
