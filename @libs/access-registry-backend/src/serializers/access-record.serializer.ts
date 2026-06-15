import type { AccessRecordEntityType } from "#src/entities/access-record.entity.js";
import { array, boolean, object, string } from "zod";
import { z } from "zod";
import { makeJsonApiDocumentSchema } from "@libs/backend-shared";

export const SerializedAccessRecordSchema = makeJsonApiDocumentSchema(
  "access-records",
  object({
    accessedAt: string(),
    encodedAt: string(),
    encodedBy: string(),
    accessorRef: string(),
    dataSubjectRef: string(),
    dataCategories: array(string()),
    isSpecialCategory: boolean(),
    accessType: string(),
    purpose: string(),
    legalBasis: string(),
    sourceSystem: string(),
    recipient: string().nullable(),
    justification: string(),
    retentionUntil: string(),
    seq: z.number().int(),
    prevHash: string(),
    hash: string(),
  }),
);

export type SerializedAccessRecord = z.infer<typeof SerializedAccessRecordSchema>;

export function jsonApiSerializeAccessRecord(
  record: AccessRecordEntityType,
): SerializedAccessRecord {
  return {
    id: record.id,
    type: "access-records" as const,
    attributes: {
      accessedAt: record.accessedAt,
      encodedAt: record.encodedAt,
      encodedBy: record.encodedBy,
      accessorRef: record.accessorRef,
      dataSubjectRef: record.dataSubjectRef,
      dataCategories: record.dataCategories as string[],
      isSpecialCategory: record.isSpecialCategory,
      accessType: record.accessType,
      purpose: record.purpose,
      legalBasis: record.legalBasis,
      sourceSystem: record.sourceSystem,
      recipient: record.recipient,
      justification: record.justification,
      retentionUntil: record.retentionUntil,
      seq: record.seq,
      prevHash: record.prevHash,
      hash: record.hash,
    },
  };
}

export function jsonApiSerializeManyAccessRecords(records: AccessRecordEntityType[]) {
  return records.map(jsonApiSerializeAccessRecord);
}

export function jsonApiSerializeSingleAccessRecordDocument(record: AccessRecordEntityType) {
  return { data: jsonApiSerializeAccessRecord(record) };
}

export function jsonApiSerializeManyAccessRecordsDocument(records: AccessRecordEntityType[]) {
  return { data: jsonApiSerializeManyAccessRecords(records) };
}
