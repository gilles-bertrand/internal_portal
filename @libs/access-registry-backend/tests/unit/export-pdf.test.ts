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

function record(
  seq: number,
  overrides: Partial<Record<string, unknown>> = {},
): AccessRecordEntityType {
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
    ...overrides,
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

// Régression de mise en page : `lineBreak: false` n'empêche PAS pdfkit de
// replier un texte dès qu'une `width` explicite est passée. Les fiches détaillées
// dessinaient donc les valeurs longues (justification) par-dessus les lignes
// suivantes, et la liste coupait les dates sur deux lignes. La fiche est
// désormais mesurée bloc par bloc : sa hauteur suit son contenu.
test("une justification longue ne fait plus déborder la fiche sur les lignes suivantes", async () => {
  const long = "Le médecin n'arrivait pas à encoder ces informations de facturation. ".repeat(3);
  const pdf = await buildPdf([record(1, { justification: long })], { ...attestation, count: 1 });

  // Le contenu reste dans le document (pas de troncature) et aucune page
  // fantôme n'est ajoutée par le repli du texte.
  expect(pageCount(pdf)).toBe(2);
});

// Cas extrême : un champ libre plus haut qu'une page entière. La fiche doit se
// poursuivre dans un cadre « (suite) » au lieu d'écrire sous la marge basse —
// et surtout la boucle de pagination doit converger.
test("une justification plus longue qu'une page se poursuit sans boucler", async () => {
  const huge = "Le secrétariat social a demandé un accès temporaire aux données. ".repeat(120);
  const pdf = await buildPdf([record(1, { justification: huge })], { ...attestation, count: 1 });

  const pages = pageCount(pdf);
  expect(pages).toBeGreaterThan(2);
  expect(pages).toBeLessThan(12);
});

// Un motif de rupture verbeux se replie sur plusieurs lignes : le cadre de
// l'attestation doit grandir avec lui plutôt que le laisser déborder.
test("l'attestation compromise reste dans son cadre quel que soit le motif", async () => {
  const pdf = await buildPdf([], {
    ...attestation,
    integrityOk: false,
    integrityBrokenAt: 3,
    integrityReason: "hash mismatch entre les enregistrements 3 et 4 ".repeat(6),
  });

  expect(pageCount(pdf)).toBe(1);
});
