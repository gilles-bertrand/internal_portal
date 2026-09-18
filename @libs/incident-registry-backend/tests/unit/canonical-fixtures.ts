import type { IncidentEntityType } from "#src/entities/incident.entity.js";

/**
 * Ligne d'incident de référence, VOLONTAIREMENT FIGÉE.
 *
 * Sert de base aux hashs de référence qui verrouillent chaque version du jeu de
 * champs canoniques. Toute modification de cet objet invalide ces hashs et doit
 * donc être considérée comme une erreur, sauf si l'on ajoute une version.
 */
export function frozenIncidentRow(): Omit<IncidentEntityType, "hash" | "canonicalVersion"> {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    seq: 1,
    reference: "INC-2026-0001-ACME",
    prevHash: "0".repeat(64),
    reportDate: "2026-01-15T00:00:00.000Z",
    version: "1.0",
    classification: "CONFIDENTIEL",
    status: "closed",
    applicationName: "Portail",
    applicationDetail: "Module de facturation",
    environment: "production",
    clientCode: "ACME",
    clientName: "ACME SA",
    reportedBy: "Jean Dupont",
    encodedBy: "encoder-id",
    encodedAt: "2026-01-16T09:30:00.000Z",
    recipientName: "DPO ACME",
    recipientOrg: "ACME SA",
    legalContext: "RGPD art. 33",
    serviceName: "billing-api",
    deployedVersion: "2.4.1",
    incidentStartAt: "2026-01-14T22:00:00.000Z",
    incidentEndAt: "2026-01-15T02:00:00.000Z",
    detectedAt: "2026-01-15T01:00:00.000Z",
    resolvedAt: "2026-01-15T02:00:00.000Z",
    resolutionDurationMinutes: 240,
    technicalLeadId: null,
    description: "Exposition temporaire de factures.",
    descriptionSections: [{ title: "Contexte", body: "Déploiement 2.4.1." }],
    personalDataImpacted: true,
    specialCategoryData: false,
    apdNotificationRequired: false,
    impactSummary: "12 factures accessibles hors périmètre.",
    impactDetails: { nature: ["confidentialité"], severityIntro: "Faible" },
    severityOperational: "low",
    severityCompliance: "low",
    severityOverall: "low",
    affectedPersonsCount: 12,
    affectedPatientsCount: null,
    immediateCause: "Règle d'autorisation trop permissive.",
    contributingFactors: ["Revue de code incomplète"],
    correctiveActions: [{ order: 1, title: "Corriger la règle", detail: "Patch 2.4.2" }],
    preventiveMeasures: ["Test d'autorisation en CI"],
    communicationPlan: null,
    conclusion: "Risque résiduel négligeable.",
    timelineEvents: [{ date: "2026-01-15", time: "01:00", event: "Détection" }],
    accessLogs: null,
    issuerSignature: { name: "RSSI", role: "RSSI", date: "2026-01-16" },
    recipientSignature: { name: "DPO ACME", role: "DPO", date: "2026-01-16" },
    revision: 1,
    supersededById: null,
    updatedBy: null,
    updatedAt: null,
    deletedAt: null,
    deletedBy: null,
  };
}

/** La même ligne, estampillée dans une version donnée. */
export function frozenIncidentRowAt(version: number): Omit<IncidentEntityType, "hash"> {
  return { ...frozenIncidentRow(), canonicalVersion: version };
}
