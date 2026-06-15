import type { EntityManager } from "@mikro-orm/core";
import { randomUUID } from "node:crypto";
import {
  canonicalSerialize,
  computeRecordHash,
  computeRetentionUntil,
  GENESIS_HASH,
} from "@libs/backend-shared";
import { AccessRecordEntity } from "#src/entities/access-record.entity.js";
import { RetentionPolicyEntity } from "#src/entities/retention-policy.entity.js";
import type { AccessRecordEntityType } from "#src/entities/access-record.entity.js";

const DEFAULT_RETENTION_DAYS = 365 * 5;
const ADVISORY_LOCK_KEY = 1_000_000_001;

export interface NewAccessRecordInput {
  accessedAt: string;
  encodedBy: string;
  accessorRef: string;
  dataSubjectRef: string;
  dataCategories: string[];
  isSpecialCategory: boolean;
  accessType: string;
  purpose: string;
  legalBasis: string;
  sourceSystem: string;
  recipient: string | null;
  justification: string;
}

export class AppendService {
  public constructor(private em: EntityManager) {}

  public async append(input: NewAccessRecordInput): Promise<AccessRecordEntityType> {
    return this.em.transactional(async (tx) => {
      await tx.execute(`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_KEY})`);

      const [last] = await tx.findAll(AccessRecordEntity, {
        orderBy: { seq: "DESC" },
        limit: 1,
      });
      const prevHash = last?.hash ?? GENESIS_HASH;
      const seq = (last?.seq ?? 0) + 1;
      const encodedAt = new Date().toISOString();

      const policy = await tx.findOne(RetentionPolicyEntity, {
        category: input.dataCategories[0] ?? "",
      });
      const durationDays = policy?.durationDays ?? DEFAULT_RETENTION_DAYS;
      const retentionUntil = computeRetentionUntil(input.accessedAt, durationDays);

      const id = randomUUID();
      const partialRecord = {
        id,
        seq,
        encodedAt,
        retentionUntil,
        prevHash,
        ...input,
      };

      const canonical = canonicalSerialize(
        partialRecord as unknown as Record<string, unknown>,
      );
      const hash = computeRecordHash(prevHash, canonical);

      const record: AccessRecordEntityType = { ...partialRecord, hash };
      await tx.getRepository(AccessRecordEntity).insert(record);

      return record;
    });
  }
}
