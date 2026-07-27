import { describe, expect, it } from "vitest";
import { buildSummaryCells } from "#src/utils/pdf-summary.js";
import { SUMMARY_COLUMNS } from "#src/utils/pdf-constants.js";
import type { AccessRecordEntityType } from "#src/entities/access-record.entity.js";

const record = {
  seq: 2,
  accessedAt: "2024-06-01T09:00:00.000Z",
  dataSubjectRef: "cust-abc",
  accessType: "consultation",
  purpose: "support",
  isSpecialCategory: true,
  sourceSystem: "ocm-prod",
  hash: "b".repeat(64),
} as unknown as AccessRecordEntityType;

describe("buildSummaryCells", () => {
  it("produit une cellule par colonne du récapitulatif", () => {
    expect(buildSummaryCells(record)).toHaveLength(SUMMARY_COLUMNS.length);
  });

  it("expose les champs clés (seq, personne, source system, art.9)", () => {
    const cells = buildSummaryCells(record);
    expect(cells).toContain("2");
    expect(cells).toContain("cust-abc");
    expect(cells).toContain("ocm-prod");
    expect(cells).toContain("Oui");
  });
});
