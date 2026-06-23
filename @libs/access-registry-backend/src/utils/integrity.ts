import { canonicalSerialize, verifyChain } from "@libs/backend-shared";
import type { AccessRecordEntityType } from "#src/entities/access-record.entity.js";

export interface IntegrityCheckResult {
  ok: boolean;
  total: number;
  brokenAt?: number;
  reason?: string;
}

export function verifyAccessRecordChain(records: AccessRecordEntityType[]): IntegrityCheckResult {
  const links = records.map((record) => ({
    hash: record.hash,
    prevHash: record.prevHash,
    canonical: canonicalSerialize({
      id: record.id,
      seq: record.seq,
      accessedAt: record.accessedAt,
      encodedAt: record.encodedAt,
      encodedBy: record.encodedBy,
      accessorRef: record.accessorRef,
      dataSubjectRef: record.dataSubjectRef,
      dataCategories: record.dataCategories,
      isSpecialCategory: record.isSpecialCategory,
      accessType: record.accessType,
      purpose: record.purpose,
      legalBasis: record.legalBasis,
      sourceSystem: record.sourceSystem,
      recipient: record.recipient,
      justification: record.justification,
      retentionUntil: record.retentionUntil,
    }),
  }));

  const broken = verifyChain(links);
  if (broken) {
    return { ok: false, total: records.length, ...broken };
  }
  return { ok: true, total: records.length };
}
