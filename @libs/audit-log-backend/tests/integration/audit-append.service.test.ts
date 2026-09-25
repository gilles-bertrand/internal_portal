import { afterAll, aroundEach, beforeAll, expect, test } from "vitest";
import { TestModule } from "#tests/utils/setup-module.js";
import { AuditEventEntity } from "#src/entities/audit-event.entity.js";
import {
  canonicalSerialize,
  computeRecordHash,
  GENESIS_HASH,
  verifyChain,
} from "@libs/backend-shared";

let module: TestModule;

beforeAll(async () => {
  module = await TestModule.init();
});

afterAll(async () => {
  await module.close();
});

aroundEach(async (runTest) => {
  await module.em.begin();
  await runTest();
  await module.em.rollback();
});

const sampleInput = {
  actorId: "user-1",
  action: "LOGIN",
  targetType: "session",
  targetRef: "sess-1",
  outcome: "success" as const,
  ip: "127.0.0.1",
  userAgent: "vitest",
};

test("le 1er événement référence le hash de genèse (seq=1)", async () => {
  await module.service.log(sampleInput);

  const events = await module.em
    .getRepository(AuditEventEntity)
    .findAll({ orderBy: { seq: "ASC" } });

  expect(events).toHaveLength(1);
  expect(events[0]!.seq).toBe(1);
  expect(events[0]!.prevHash).toBe(GENESIS_HASH);
  expect(events[0]!.hash).toHaveLength(64);
});

test("le 2e événement est chaîné sur le 1er (prevHash == hash précédent)", async () => {
  await module.service.log(sampleInput);
  await module.service.log({ ...sampleInput, action: "REGISTRY_VIEWED" });

  const events = await module.em
    .getRepository(AuditEventEntity)
    .findAll({ orderBy: { seq: "ASC" } });

  expect(events).toHaveLength(2);
  expect(events[1]!.seq).toBe(2);
  expect(events[1]!.prevHash).toBe(events[0]!.hash);
});

test("la chaîne d'événements est intègre (verifyChain → null)", async () => {
  for (let i = 0; i < 5; i++) {
    await module.service.log({ ...sampleInput, targetRef: `ref-${i}` });
  }

  const events = await module.em
    .getRepository(AuditEventEntity)
    .findAll({ orderBy: { seq: "ASC" } });

  const links = events.map((e) => ({
    hash: e.hash,
    prevHash: e.prevHash,
    canonical: canonicalSerialize({
      id: e.id,
      seq: e.seq,
      occurredAt: e.occurredAt,
      actorId: e.actorId,
      action: e.action,
      targetType: e.targetType,
      targetRef: e.targetRef,
      outcome: e.outcome,
      ip: e.ip,
      userAgent: e.userAgent,
    }),
  }));

  expect(verifyChain(links)).toBeNull();
});

test("une falsification du contenu est détectable par recalcul du hash", async () => {
  await module.service.log(sampleInput);

  const event = (
    await module.em.getRepository(AuditEventEntity).findAll({ orderBy: { seq: "ASC" } })
  )[0]!;

  // Recalcul avec un contenu altéré (action falsifiée)
  const tamperedCanonical = canonicalSerialize({
    id: event.id,
    seq: event.seq,
    occurredAt: event.occurredAt,
    actorId: event.actorId,
    action: "DELETED_EVIDENCE",
    targetType: event.targetType,
    targetRef: event.targetRef,
    outcome: event.outcome,
    ip: event.ip,
    userAgent: event.userAgent,
  });
  const recomputed = computeRecordHash(event.prevHash, tamperedCanonical);

  expect(recomputed).not.toBe(event.hash);
});

test("UPDATE direct → exception trigger (append-only)", async () => {
  await module.service.log(sampleInput);

  await expect(
    module.em.execute(`UPDATE audit_event SET action = 'tampered' WHERE seq = 1`),
  ).rejects.toThrow(/append-only/i);
});

test("DELETE direct → exception trigger (append-only)", async () => {
  await module.service.log(sampleInput);

  await expect(module.em.execute(`DELETE FROM audit_event WHERE seq = 1`)).rejects.toThrow(
    /append-only/i,
  );
});
