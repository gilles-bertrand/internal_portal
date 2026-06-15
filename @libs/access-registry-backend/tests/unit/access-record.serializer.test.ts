import { describe, expect, it } from "vitest";
import {
  jsonApiSerializeAccessRecord,
  jsonApiSerializeSingleAccessRecordDocument,
} from "#src/serializers/access-record.serializer.js";
import type { AccessRecordEntityType } from "#src/entities/access-record.entity.js";

const sampleRecord: AccessRecordEntityType = {
  id: "rec-1",
  seq: 1,
  accessedAt: "2024-01-15T10:00:00.000Z",
  encodedAt: "2024-01-15T10:05:00.000Z",
  encodedBy: "user-1",
  accessorRef: "ref-emp-001",
  dataSubjectRef: "cust-pseudonym-abc",
  dataCategories: ["identité", "contact"],
  isSpecialCategory: false,
  accessType: "consultation",
  purpose: "support-client",
  legalBasis: "art6.1b",
  sourceSystem: "CRM",
  recipient: null,
  justification: "Demande client #12345",
  retentionUntil: "2029-01-15T10:00:00.000Z",
  prevHash: "0".repeat(64),
  hash: "a".repeat(64),
};

describe("jsonApiSerializeAccessRecord", () => {
  it("retourne le format JSON:API correct", () => {
    const result = jsonApiSerializeAccessRecord(sampleRecord);
    expect(result.id).toBe("rec-1");
    expect(result.type).toBe("access-records");
    expect(result.attributes.dataSubjectRef).toBe("cust-pseudonym-abc");
    expect(result.attributes.isSpecialCategory).toBe(false);
    expect(result.attributes.seq).toBe(1);
  });

  it("n'expose pas de données personnelles en clair (pas d'email, nom, etc.)", () => {
    const result = jsonApiSerializeAccessRecord(sampleRecord);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("email");
    expect(serialized).not.toContain("password");
    expect(serialized).not.toContain("firstName");
  });

  it("expose les champs de chaînage hash et prevHash", () => {
    const result = jsonApiSerializeAccessRecord(sampleRecord);
    expect(result.attributes.hash).toBe("a".repeat(64));
    expect(result.attributes.prevHash).toBe("0".repeat(64));
  });
});

describe("jsonApiSerializeSingleAccessRecordDocument", () => {
  it("enveloppe dans { data: ... }", () => {
    const doc = jsonApiSerializeSingleAccessRecordDocument(sampleRecord);
    expect(doc).toHaveProperty("data");
    expect(doc.data.id).toBe("rec-1");
  });
});
