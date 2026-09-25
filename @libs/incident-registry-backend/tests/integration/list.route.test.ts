import { afterAll, aroundEach, beforeAll, expect, test } from "vitest";
import { TestModule } from "#tests/utils/setup-module.js";
import { validIncidentPayload, validOcmPayload } from "#tests/utils/fixtures.js";
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

async function seedIncidents() {
  await module.fastifyInstance.inject({
    method: "POST",
    url: "/incidents",
    headers: { authorization: module.generateBearerToken("encoder-id", "encoder") },
    payload: validIncidentPayload,
  });
  await module.fastifyInstance.inject({
    method: "POST",
    url: "/incidents",
    headers: { authorization: module.generateBearerToken("encoder-id", "encoder") },
    payload: validOcmPayload,
  });
}

test("liste tous les incidents avec encodedByName", async () => {
  await seedIncidents();

  const response = await module.fastifyInstance.inject({
    method: "GET",
    url: "/incidents",
    headers: { authorization: module.generateBearerToken("dpo-id", "dpo") },
  });

  expect(response.statusCode).toBe(200);
  const body = response.json();
  expect(body.meta.total).toBe(2);
  expect(body.data[0].attributes.encodedByName).toBe("E N");
});

test("filtre par clientCode", async () => {
  await seedIncidents();

  const response = await module.fastifyInstance.inject({
    method: "GET",
    url: "/incidents?filter[clientCode]=OCM",
    headers: { authorization: module.generateBearerToken("dpo-id", "dpo") },
  });

  expect(response.statusCode).toBe(200);
  const body = response.json();
  expect(body.meta.total).toBe(1);
  expect(body.data[0].attributes.clientCode).toBe("OCM");
});

test("filtre par specialCategoryData", async () => {
  await seedIncidents();

  const response = await module.fastifyInstance.inject({
    method: "GET",
    url: "/incidents?filter[specialCategoryData]=true",
    headers: { authorization: module.generateBearerToken("dpo-id", "dpo") },
  });

  expect(response.statusCode).toBe(200);
  expect(response.json().meta.total).toBe(1);
});

test("liste journalisée (INCIDENT_VIEWED)", async () => {
  await seedIncidents();

  await module.fastifyInstance.inject({
    method: "GET",
    url: "/incidents",
    headers: { authorization: module.generateBearerToken("dpo-id", "dpo") },
  });

  const events = await module.em
    .getRepository(AuditEventEntity)
    .find({ action: "INCIDENT_VIEWED" });
  expect(events.length).toBeGreaterThanOrEqual(1);
});
