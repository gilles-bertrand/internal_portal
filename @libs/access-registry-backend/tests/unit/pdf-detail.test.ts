import { describe, expect, it } from "vitest";
import { buildRecordDetailRows } from "#src/utils/pdf-detail.js";
import type { AccessRecordEntityType } from "#src/entities/access-record.entity.js";

const record = {
  id: "rec-1",
  seq: 3,
  accessedAt: "2024-06-01T09:00:00.000Z",
  encodedAt: "2024-06-01T09:05:00.000Z",
  encodedBy: "user-42",
  accessorRef: "emp-001",
  dataSubjectRef: "cust-abc",
  dataCategories: ["identity", "health"],
  isSpecialCategory: true,
  accessType: "consultation",
  purpose: "support",
  legalBasis: "art6.1b",
  sourceSystem: "ocm-prod",
  recipient: null,
  justification: "Vérification dossier",
  retentionUntil: "2029-06-01T00:00:00.000Z",
  prevHash: "a".repeat(64),
  hash: "b".repeat(64),
} as unknown as AccessRecordEntityType;

describe("buildRecordDetailRows", () => {
  it("expose tous les champs de l'enregistrement (aucun détail masqué)", () => {
    const rows = buildRecordDetailRows(record);
    const keys = rows.map((r) => r.key);

    // Chaque propriété de l'entité doit être représentée dans la fiche détaillée.
    for (const key of [
      "seq",
      "accessedAt",
      "encodedAt",
      "encodedBy",
      "accessorRef",
      "dataSubjectRef",
      "dataCategories",
      "isSpecialCategory",
      "accessType",
      "purpose",
      "legalBasis",
      "sourceSystem",
      "recipient",
      "justification",
      "retentionUntil",
      "prevHash",
      "hash",
    ]) {
      expect(keys).toContain(key);
    }
  });

  it("rend les valeurs complètes, sans troncature (hash entiers)", () => {
    const rows = buildRecordDetailRows(record);
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));

    expect(byKey["hash"]).toBe("b".repeat(64));
    expect(byKey["prevHash"]).toBe("a".repeat(64));
    expect(byKey["dataCategories"]).toContain("identity");
    expect(byKey["dataCategories"]).toContain("health");
    expect(byKey["isSpecialCategory"]).toBe("Oui");
  });

  it("affiche un tiret pour un destinataire absent", () => {
    const rows = buildRecordDetailRows(record);
    const recipient = rows.find((r) => r.key === "recipient");
    expect(recipient?.value).toBe("—");
  });
});
