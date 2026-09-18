import { expect, test } from "vitest";
import { buildIncidentPdf } from "#src/utils/export-incident-pdf.js";
import { buildRegistryPdf, type PdfAttestation } from "#src/utils/export-registry-pdf.js";
import type { IncidentEntityType } from "#src/entities/incident.entity.js";

const attestation: PdfAttestation = {
  generatedAt: "2026-08-19T10:00:00.000Z",
  generatedBy: "dpo-id",
  count: 0,
  chainHeadHash: "a".repeat(64),
  integrityOk: true,
};

function incident(seq: number, overrides: Record<string, unknown> = {}): IncidentEntityType {
  return {
    id: `inc-${seq}`,
    seq,
    reference: `TPK-INC-2026-${String(seq).padStart(3, "0")}`,
    reportDate: "2026-04-03T09:00:00.000Z",
    version: "1.0",
    classification: "CONFIDENTIEL",
    status: "resolved",
    applicationName: "Portail Extranet",
    applicationDetail: "Module de consultation",
    environment: "production",
    clientCode: "OCM",
    clientName: "Organisme de Contrôle Médical",
    reportedBy: "Laetitia Manias",
    encodedBy: "Gilles Bertrand",
    encodedAt: "2026-04-03T09:00:00.000Z",
    recipientName: "OCM — Direction",
    recipientOrg: "OCM",
    legalContext: "Conformément au RGPD, Triptyk SRL informe ses parties prenantes.",
    description: "Des feuillets médicaux étaient visibles par les entreprises clientes.",
    descriptionSections: null,
    impactDetails: null,
    impactSummary: "Impact limité à quatre personnes.",
    severityOverall: "Faible",
    severityOperational: "Basse",
    severityCompliance: "Modérée",
    affectedPersonsCount: 4,
    affectedPatientsCount: 1,
    personalDataImpacted: true,
    specialCategoryData: true,
    incidentStartAt: "2026-04-02T07:58:00.000Z",
    incidentEndAt: "2026-04-03T09:47:00.000Z",
    detectedAt: "2026-04-03T09:13:00.000Z",
    resolvedAt: "2026-04-03T09:47:00.000Z",
    resolutionDurationMinutes: 34,
    timelineEvents: [{ date: "2026-04-02", time: "07h58", event: "Premiers accès non autorisés" }],
    immediateCause: "Permissions trop larges sur le portail extranet.",
    contributingFactors: ["Absence de test d'isolation"],
    correctiveActions: [
      { phase: "Phase 1", order: 1, title: "Détection", detail: "Incident détecté" },
    ],
    preventiveMeasures: ["Audit de sécurité global"],
    conclusion: "La Phase 1 est terminée.",
    apdNotificationRequired: true,
    accessLogs: [
      {
        date: "2026-04-02",
        user: "HERBIET Anne",
        email: "anne.herbiet@imaje-interco.be",
        files: "Feuillet Patient",
        count: 5,
      },
    ],
    issuerSignature: { name: "Gilles Bertrand", role: "Gérant", org: "Triptyk SRL" },
    recipientSignature: { name: "Patrick Burgeon", role: "Administrateur", org: "OCM" },
    prevHash: "0".repeat(64),
    hash: `${seq}`.padStart(64, "b"),
    ...overrides,
  } as unknown as IncidentEntityType;
}

// Les dictionnaires d'objets page ne sont pas compressés par pdfkit : compter
// les `/Type /Page` (hors nœud racine `/Type /Pages`) donne le nombre de pages
// réel du document généré.
function pageCount(pdf: Buffer): number {
  return pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g)?.length ?? 0;
}

// Régression : le pied de page s'écrit sous la marge basse et le line-wrapper de
// pdfkit (activé par la `width` nécessaire à l'alignement) y déclenchait un
// addPage() par pied posé — chaque page réelle était suivie d'une page vide ne
// portant que son numéro, soit un registre de 2 pages pour 2 incidents.
test("le registre ne gagne aucune page fantôme à la pose des pieds de page", async () => {
  const pdf = await buildRegistryPdf([incident(1), incident(2)], { ...attestation, count: 2 });
  expect(pageCount(pdf)).toBe(1);
});

test("un registre vide tient sur une seule page", async () => {
  const pdf = await buildRegistryPdf([], attestation);
  expect(pageCount(pdf)).toBe(1);
});

// Même régression sur le rapport unitaire, qui rendait 2 pages fantômes pour ses
// 2 pages réelles (et 6 pour 3 sur un incident de production).
test("le rapport d'incident ne double plus son nombre de pages", async () => {
  const pdf = await buildIncidentPdf(incident(1));
  expect(pageCount(pdf)).toBe(2);
});

// Les lignes de table sont mesurées : une valeur longue se replie DANS sa
// cellule et pousse la hauteur de la ligne, au lieu d'écrire sur la suivante.
// Le document grandit donc, et reste borné.
test("des valeurs longues font grandir les lignes sans faire exploser le document", async () => {
  const long = "Portail Extranet Entreprises Clientes de l'Organisme de Contrôle Médical";
  const pdf = await buildIncidentPdf(
    incident(1, {
      applicationName: long,
      recipientName: `${long} — service destinataire`,
      timelineEvents: Array.from({ length: 30 }, (_, i) => ({
        date: "2026-04-02",
        time: "07h58",
        event: `Événement ${i + 1} — ${long}, description qui déborde de sa colonne`,
      })),
      issuerSignature: {
        name: "Gilles Bertrand",
        role: "Gérant et délégué à la protection des données du groupe Triptyk",
        org: "Triptyk SRL, société à responsabilité limitée de droit belge",
      },
    }),
  );

  const pages = pageCount(pdf);
  expect(pages).toBeGreaterThan(1);
  expect(pages).toBeLessThan(10);
});

// Un motif de rupture verbeux se replie sur plusieurs lignes : le cadre de
// l'attestation doit grandir avec lui plutôt que le laisser déborder.
test("l'attestation compromise reste dans son cadre quel que soit le motif", async () => {
  const pdf = await buildRegistryPdf([], {
    ...attestation,
    integrityOk: false,
    integrityBrokenAt: 7,
    integrityReason: "hash mismatch entre les incidents 7 et 8 ".repeat(6),
  });
  expect(pageCount(pdf)).toBe(1);
});

// Robustesse : la troncature au caractère plantait (`value.length` sur null) dès
// qu'un champ optionnel du journal était absent. Le rendu tronque désormais à la
// mesure et remplace une valeur manquante par un tiret.
test("le journal ne plante pas sur un champ absent", async () => {
  const pdf = await buildRegistryPdf(
    [incident(1, { clientCode: null, status: null, reference: null })],
    { ...attestation, count: 1 },
  );
  expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
});
