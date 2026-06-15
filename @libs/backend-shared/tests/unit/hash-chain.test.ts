import { describe, expect, it } from "vitest";
import { canonicalSerialize } from "#src/hash-chain/canonical.js";
import {
  GENESIS_HASH,
  computeRecordHash,
  verifyChain,
  type ChainLink,
} from "#src/hash-chain/hash-chain.js";
import { computeRetentionUntil } from "#src/hash-chain/retention.js";

describe("canonicalSerialize", () => {
  it("est déterministe quel que soit l'ordre des clés", () => {
    const a = { b: 2, a: 1 };
    const b = { a: 1, b: 2 };
    expect(canonicalSerialize(a)).toBe(canonicalSerialize(b));
  });

  it("exclut les champs hash et prevHash", () => {
    const record = { id: "1", value: "test", hash: "abc", prevHash: "def" };
    const result = canonicalSerialize(record);
    expect(result).not.toContain('"hash"');
    expect(result).not.toContain('"prevHash"');
    expect(result).toContain('"value"');
  });

  it("sérialise les objets imbriqués de façon déterministe", () => {
    const a = { z: { b: 2, a: 1 }, a: "x" };
    const b = { a: "x", z: { a: 1, b: 2 } };
    expect(canonicalSerialize(a)).toBe(canonicalSerialize(b));
  });

  it("sérialise les tableaux correctement", () => {
    const r = { cats: ["santé", "identité"] };
    expect(canonicalSerialize(r)).toBe('{"cats":["santé","identité"]}');
  });
});

describe("verifyChain", () => {
  it("retourne null pour une chaîne vide", () => {
    expect(verifyChain([])).toBeNull();
  });

  it("retourne null pour un seul maillon valide (genèse)", () => {
    const canonical = canonicalSerialize({ id: "1", value: "test" });
    const hash = computeRecordHash(GENESIS_HASH, canonical);
    const links: ChainLink[] = [{ hash, prevHash: GENESIS_HASH, canonical }];
    expect(verifyChain(links)).toBeNull();
  });

  it("retourne null pour une chaîne multi-maillons valide", () => {
    const links: ChainLink[] = [];
    let prev = GENESIS_HASH;
    for (let i = 0; i < 5; i++) {
      const canonical = canonicalSerialize({ id: String(i), seq: i });
      const hash = computeRecordHash(prev, canonical);
      links.push({ hash, prevHash: prev, canonical });
      prev = hash;
    }
    expect(verifyChain(links)).toBeNull();
  });

  it("détecte la falsification du hash d'un maillon", () => {
    const canonical = canonicalSerialize({ id: "1", value: "test" });
    const hash = computeRecordHash(GENESIS_HASH, canonical);
    const links: ChainLink[] = [
      { hash: "0000" + hash.slice(4), prevHash: GENESIS_HASH, canonical },
    ];
    const result = verifyChain(links);
    expect(result).not.toBeNull();
    expect(result?.brokenAt).toBe(0);
    expect(result?.reason).toBe("hash mismatch");
  });

  it("détecte un prevHash incorrect", () => {
    const canonical = canonicalSerialize({ id: "1", value: "test" });
    const hash = computeRecordHash(GENESIS_HASH, canonical);
    const links: ChainLink[] = [{ hash, prevHash: "wrong_prev", canonical }];
    const result = verifyChain(links);
    expect(result).not.toBeNull();
    expect(result?.brokenAt).toBe(0);
    expect(result?.reason).toBe("prevHash mismatch");
  });

  it("détecte un maillon falsifié au milieu de la chaîne", () => {
    const links: ChainLink[] = [];
    let prev = GENESIS_HASH;
    for (let i = 0; i < 4; i++) {
      const canonical = canonicalSerialize({ id: String(i), seq: i });
      const hash = computeRecordHash(prev, canonical);
      links.push({ hash, prevHash: prev, canonical });
      prev = hash;
    }
    // Falsification du contenu canonique du maillon 2
    const link2 = links[2];
    if (link2) {
      links[2] = {
        ...link2,
        canonical: canonicalSerialize({ id: "2", seq: 999 }),
      };
    }
    const result = verifyChain(links);
    expect(result).not.toBeNull();
    expect(result?.brokenAt).toBe(2);
    expect(result?.reason).toBe("hash mismatch");
  });
});

describe("computeRetentionUntil", () => {
  it("ajoute durationDays à accessedAt", () => {
    // 2023 n'est pas une année bissextile (365 j), donc +365j = même jour l'année suivante
    const result = computeRetentionUntil("2023-01-01T00:00:00.000Z", 365);
    expect(result).toBe("2024-01-01T00:00:00.000Z");
  });

  it("gère les années bissextiles", () => {
    const result = computeRetentionUntil("2024-02-29T00:00:00.000Z", 1);
    expect(result).toBe("2024-03-01T00:00:00.000Z");
  });

  it("renvoie une date ISO UTC", () => {
    const result = computeRetentionUntil("2024-06-15T10:30:00.000Z", 30);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});
