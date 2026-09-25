import { defineEntity, p, type InferEntity } from "@mikro-orm/core";

export const AccessRecordEntity = defineEntity({
  name: "AccessRecord",
  tableName: "access_record",
  properties: {
    id: p.string().primary(),
    seq: p.integer().unique(),
    accessedAt: p.string(),
    encodedAt: p.string(),
    encodedBy: p.string(),
    accessorRef: p.string(),
    dataSubjectRef: p.string(),
    dataCategories: p.array(),
    isSpecialCategory: p.boolean().default(false),
    accessType: p.string(),
    purpose: p.string(),
    legalBasis: p.string(),
    sourceSystem: p.string(),
    recipient: p.string().nullable(),
    justification: p.string(),
    retentionUntil: p.string(),
    prevHash: p.string(),
    hash: p.string().unique(),
  },
});

export type AccessRecordEntityType = InferEntity<typeof AccessRecordEntity>;
