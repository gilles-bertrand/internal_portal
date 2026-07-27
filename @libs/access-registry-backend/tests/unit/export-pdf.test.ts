import { expect, test } from "vitest";
import { buildPdf, type PdfAttestation } from "#src/utils/export-pdf.js";
import type { AccessRecordEntityType } from "#src/entities/access-record.entity.js";

const attestation: PdfAttestation = {
  generatedAt: "2026-07-27T10:00:00.000Z",
  generatedBy: "dpo-id",
  count: 0,
  chainHeadHash: "a".repeat(64),
  integrityOk: true,
};

function record(seq: number): AccessRecordEntityType {
  return {
    id: `rec-${seq}`,
    accessedAt: new Date("2026-06-11T14:00:00.000Z"),
    encodedAt: new Date("2026-06-11T14:02:00.000Z"),
    encodedBy: "encoder-id",
    accessorRef: "Amaury Deflorenne",
    dataSubjectRef: `cust-${seq}`,
    dataCategories: ["identity"],
    isSpecialCategory: false,
    accessType: "consultation",
    purpose: "support",
    legalBasis: "art6.1b",
    sourceSystem: "crm",
    recipient: null,
    justification: "Consultation du dossier",
    retentionUntil: new Date("2031-06-11T14:00:00.000Z"),
    seq,
    prevHash: "0".repeat(64),
    hash: "b".repeat(64),
    archivedAt: null,
  } as unknown as AccessRecordEntityType;
}

// Les dictionnaires d'objets page ne sont pas compressés par pdfkit : compter
// les `/Type /Page` (hors nœud racine `/Type /Pages`) donne le nombre de pages
// réel du document généré.
function pageCount(pdf: Buffer): number {
  const matches = pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g);
  return matches?.length ?? 0;
}

// Régression : le footer s'écrit sous la marge basse, et le line-wrapper de
// pdfkit déclenchait un addPage() automatique à chaque pose de numéro de page —
// le PDF gonflait de pages vides ne contenant que « Page X / Y ».
test("un export vide tient sur une seule page (pas de page fantôme du footer)", async () => {
  const pdf = await buildPdf([], attestation);
  expect(pageCount(pdf)).toBe(1);
});

test("l'export garde le découpage attendu : attestation+liste puis détail", async () => {
  const pdf = await buildPdf([record(1), record(2)], { ...attestation, count: 2 });
  // Page 1 (attestation + liste) + pages de détail : le total exact dépend de
  // la densité des fiches, mais AUCUNE page fantôme ne doit s'ajouter — pour 2
  // enregistrements le détail tient sur une page, donc 2 pages en tout.
  expect(pageCount(pdf)).toBe(2);
});
