import type { EntityManager } from "@mikro-orm/postgresql";
import { randomUUID } from "node:crypto";
import { canonicalSerialize, computeRecordHash, GENESIS_HASH } from "@libs/backend-shared";
import { AuditEventEntity } from "#src/entities/audit-event.entity.js";
import type { AuditLogInput } from "#src/types.js";

const ADVISORY_LOCK_KEY = 1_000_000_002;

export class AuditAppendService {
  public constructor(private em: EntityManager) {}

  public async log(input: AuditLogInput): Promise<void> {
    await this.em.transactional(async (tx) => {
      await tx.execute(`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_KEY})`);

      const [last] = await tx.findAll(AuditEventEntity, { orderBy: { seq: "DESC" }, limit: 1 });
      const prevHash = last?.hash ?? GENESIS_HASH;
      const seq = (last?.seq ?? 0) + 1;
      const occurredAt = new Date().toISOString();

      const partial = { id: randomUUID(), seq, occurredAt, prevHash, ...input };
      const canonical = canonicalSerialize(partial as unknown as Record<string, unknown>);
      const hash = computeRecordHash(prevHash, canonical);

      await tx.insert(AuditEventEntity, { ...partial, hash });
    });
  }
}
