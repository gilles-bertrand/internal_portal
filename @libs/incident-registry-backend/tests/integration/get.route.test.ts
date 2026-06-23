import { afterAll, aroundEach, beforeAll, expect, test } from "vitest";
import { TestModule } from "#tests/utils/setup-module.js";
import { validIncidentPayload } from "#tests/utils/fixtures.js";
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

test("retourne le détail d'un incident", async () => {
  const created = await module.fastifyInstance.inject({
    method: "POST",
    url: "/incidents",
    headers: { authorization: module.generateBearerToken("encoder-id", "encoder") },
    payload: validIncidentPayload,
  });
  const id = created.json().data.id as string;

  const response = await module.fastifyInstance.inject({
    method: "GET",
    url: `/incidents/${id}`,
    headers: { authorization: module.generateBearerToken("auditor-id", "auditor") },
  });

  expect(response.statusCode).toBe(200);
  const body = response.json();
  expect(body.data.id).toBe(id);
  expect(body.data.attributes.reference).toMatch(/^INC-2026-/);
});

test("404 si incident inconnu", async () => {
  const response = await module.fastifyInstance.inject({
    method: "GET",
    url: "/incidents/00000000-0000-0000-0000-000000000000",
    headers: { authorization: module.generateBearerToken("auditor-id", "auditor") },
  });
  expect(response.statusCode).toBe(404);
});

test("vue unitaire journalisée (INCIDENT_VIEWED)", async () => {
  const created = await module.fastifyInstance.inject({
    method: "POST",
    url: "/incidents",
    headers: { authorization: module.generateBearerToken("encoder-id", "encoder") },
    payload: validIncidentPayload,
  });
  const id = created.json().data.id as string;

  await module.fastifyInstance.inject({
    method: "GET",
    url: `/incidents/${id}`,
    headers: { authorization: module.generateBearerToken("auditor-id", "auditor") },
  });

  const events = await module.em
    .getRepository(AuditEventEntity)
    .find({ action: "INCIDENT_VIEWED", targetRef: id });
  expect(events.length).toBeGreaterThanOrEqual(1);
});
