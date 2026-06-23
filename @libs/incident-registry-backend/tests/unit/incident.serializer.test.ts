import { describe, expect, it } from "vitest";
import {
  jsonApiSerializeIncident,
  jsonApiSerializeSingleIncidentDocument,
} from "#src/serializers/incident.serializer.js";
import type { IncidentEntityType } from "#src/entities/incident.entity.js";

const sampleIncident: IncidentEntityType = {
  id: "inc-1",
  seq: 1,
  reference: "INC-2026-0001-IPBW",
  reportDate: "2026-02-20T10:00:00.000Z",
  version: "1.0",
  classification: "CONFIDENTIEL",
  status: "resolved",
  applicationName: "Portail",
  applicationDetail: "Auth",
  environment: "production",
  clientCode: "IPBW",
  clientName: "IPBW SA",
  reportedBy: "Support",
  encodedBy: "user-1",
  encodedAt: "2026-02-20T10:05:00.000Z",
  recipientName: "DSI",
  recipientOrg: "IPBW",
  legalContext: "Cadre RGPD",
  serviceName: "API",
  deployedVersion: "1.0",
  incidentStartAt: "2026-02-19T08:00:00.000Z",
  incidentEndAt: "2026-02-19T12:00:00.000Z",
  detectedAt: "2026-02-19T08:15:00.000Z",
  resolvedAt: "2026-02-19T12:00:00.000Z",
  resolutionDurationMinutes: 225,
  technicalLeadId: null,
  description: "Incident test",
  descriptionSections: null,
  personalDataImpacted: false,
  specialCategoryData: false,
  apdNotificationRequired: false,
  impactSummary: "Aucun impact",
  impactDetails: null,
  severityOperational: "low",
  severityCompliance: "low",
  severityOverall: "low",
  affectedPersonsCount: 0,
  affectedPatientsCount: null,
  immediateCause: "Bug",
  contributingFactors: [],
  correctiveActions: [],
  preventiveMeasures: [],
  communicationPlan: null,
  conclusion: "Résolu",
  timelineEvents: [{ date: "2026-02-19", time: "08:00", event: "Début" }],
  accessLogs: null,
  issuerSignature: { name: "RSSI" },
  recipientSignature: { name: "DSI" },
  prevHash: "0".repeat(64),
  hash: "a".repeat(64),
};

describe("jsonApiSerializeIncident", () => {
  it("retourne le format JSON:API correct", () => {
    const result = jsonApiSerializeIncident(sampleIncident);
    expect(result.id).toBe("inc-1");
    expect(result.type).toBe("incidents");
    expect(result.attributes.reference).toBe("INC-2026-0001-IPBW");
    expect(result.attributes.seq).toBe(1);
  });

  it("expose les champs de chaînage hash et prevHash", () => {
    const result = jsonApiSerializeIncident(sampleIncident);
    expect(result.attributes.hash).toBe("a".repeat(64));
    expect(result.attributes.prevHash).toBe("0".repeat(64));
  });
});

describe("jsonApiSerializeSingleIncidentDocument", () => {
  it("enveloppe dans { data: ... }", () => {
    const doc = jsonApiSerializeSingleIncidentDocument(sampleIncident);
    expect(doc).toHaveProperty("data");
    expect(doc.data.id).toBe("inc-1");
  });
});
