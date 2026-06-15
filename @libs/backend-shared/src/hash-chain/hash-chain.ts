import { createHash } from "node:crypto";

export const GENESIS_HASH = "0".repeat(64);

export interface ChainLink {
  hash: string;
  prevHash: string;
  canonical: string;
}

export function computeRecordHash(prevHash: string, canonical: string): string {
  return createHash("sha256").update(prevHash + "||" + canonical).digest("hex");
}

export function verifyChain(links: ChainLink[]): { brokenAt: number; reason: string } | null {
  let expectedPrev = GENESIS_HASH;
  for (let i = 0; i < links.length; i++) {
    const l = links[i];
    if (!l) {
      return { brokenAt: i, reason: "null link" };
    }
    if (l.prevHash !== expectedPrev) {
      return { brokenAt: i, reason: "prevHash mismatch" };
    }
    const expected = computeRecordHash(l.prevHash, l.canonical);
    if (expected !== l.hash) {
      return { brokenAt: i, reason: "hash mismatch" };
    }
    expectedPrev = l.hash;
  }
  return null;
}
