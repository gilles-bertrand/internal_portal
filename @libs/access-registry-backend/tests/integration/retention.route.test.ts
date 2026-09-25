import { afterAll, aroundEach, beforeAll, expect, test } from "vitest";
import { createHmac } from "node:crypto";
import { TestModule } from "#tests/utils/setup-module.js";
import { AccessRecordEntity } from "#src/entities/access-record.entity.js";
import { AuditEventEntity } from "@libs/audit-log-backend";

let module: TestModule;

beforeAll(async () => {
  module = await TestModule.init();
});

afterAll(async () => {
  await module.close();
});

aroundEach(async (runTest) => {
  const em = module.em;
  await em.begin();
  await runTest();
  await em.rollback();
});

// Insère directement un enregistrement déjà échu (retentionUntil dans le passé)
async function seedExpiredRecord(em = module.em) {
  await em.getRepository(AccessRecordEntity).insert({
    id: "expired-1",
    seq: 1,
    accessedAt: "2010-01-01T00:00:00.000Z",
    encodedAt: "2010-01-01T00:00:00.000Z",
    encodedBy: "encoder-id",
    accessorRef: "emp-001",
    dataSubjectRef: "cust-old",
    dataCategories: ["identité"],
    isSpecialCategory: false,
    accessType: "consultation",
    purpose: "support",
    legalBasis: "art6.1b",
    sourceSystem: "CRM",
    recipient: null,
    justification: "Vieux dossier",
    retentionUntil: "2011-01-01T00:00:00.000Z",
    prevHash: "0".repeat(64),
    hash: "deadbeef".repeat(8),
  });
}

test("la rétention archive les échus (archive signée vérifiable) sans suppression", async () => {
  await seedExpiredRecord();

  const response = await module.fastifyInstance.inject({
    method: "POST",
    url: "/access-records/retention/run",
    headers: { authorization: module.generateBearerToken("dpo-id", "dpo") },
  });

  expect(response.statusCode).toBe(200);
  const { data } = response.json();
  expect(data.expiredCount).toBe(1);
  expect(data.purged).toBe(0); // pas de suppression physique (append-only préservé)

  // Archive signée vérifiable
  const expected = createHmac("sha256", TestModule.EXPORT_SIGNING_KEY)
    .update(Buffer.from(data.archive.content, "utf-8"))
    .digest("hex");
  expect(data.archive.signature).toBe(expected);

  // L'enregistrement échu est TOUJOURS présent (pas de suppression silencieuse)
  const still = await module.em.getRepository(AccessRecordEntity).findOne({ id: "expired-1" });
  expect(still).not.toBeNull();
});

test("la purge est tracée dans le méta-journal (RETENTION_PURGE)", async () => {
  await seedExpiredRecord();

  await module.fastifyInstance.inject({
    method: "POST",
    url: "/access-records/retention/run",
    headers: { authorization: module.generateBearerToken("dpo-id", "dpo") },
  });

  const events = await module.em
    .getRepository(AuditEventEntity)
    .find({ action: "RETENTION_PURGE" });
  expect(events.length).toBeGreaterThanOrEqual(1);
});

test("sans échus : expiredCount = 0", async () => {
  const response = await module.fastifyInstance.inject({
    method: "POST",
    url: "/access-records/retention/run",
    headers: { authorization: module.generateBearerToken("dpo-id", "dpo") },
  });

  expect(response.statusCode).toBe(200);
  expect(response.json().data.expiredCount).toBe(0);
});

test("auditeur ne peut pas lancer la rétention (403)", async () => {
  const response = await module.fastifyInstance.inject({
    method: "POST",
    url: "/access-records/retention/run",
    headers: { authorization: module.generateBearerToken("auditor-id", "auditor") },
  });
  expect(response.statusCode).toBe(403);
});
