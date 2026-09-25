import { afterAll, aroundEach, beforeAll, expect, test } from "vitest";
import { TestModule } from "#tests/utils/setup-module.js";
import { validIncidentPayload } from "#tests/utils/fixtures.js";
import { GENESIS_HASH } from "@libs/backend-shared";
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

test("crée un incident et retourne JSON:API (seq=1, prevHash=GENESIS)", async () => {
  const response = await module.fastifyInstance.inject({
    method: "POST",
    url: "/incidents",
    headers: { authorization: module.generateBearerToken("encoder-id", "encoder") },
    payload: validIncidentPayload,
  });

  expect(response.statusCode).toBe(200);
  const body = response.json();
  expect(body.data.type).toBe("incidents");
  expect(body.data.attributes.seq).toBe(1);
  expect(body.data.attributes.prevHash).toBe(GENESIS_HASH);
  expect(body.data.attributes.hash).toHaveLength(64);
  expect(body.data.attributes.encodedBy).toBe("encoder-id");
  expect(body.data.attributes.reference).toMatch(/^INC-2026-\d{4}-IPBW$/);
});

test("2e insert est chaîné sur le 1er (prevHash == hash précédent)", async () => {
  const r1 = await module.fastifyInstance.inject({
    method: "POST",
    url: "/incidents",
    headers: { authorization: module.generateBearerToken("encoder-id", "encoder") },
    payload: validIncidentPayload,
  });
  const hash1 = r1.json().data.attributes.hash as string;

  const r2 = await module.fastifyInstance.inject({
    method: "POST",
    url: "/incidents",
    headers: { authorization: module.generateBearerToken("encoder-id", "encoder") },
    payload: validIncidentPayload,
  });

  expect(r2.json().data.attributes.prevHash).toBe(hash1);
  expect(r2.json().data.attributes.seq).toBe(2);
});

test("refus si specialCategoryData sans champs impact (400 JSON:API)", async () => {
  const response = await module.fastifyInstance.inject({
    method: "POST",
    url: "/incidents",
    headers: { authorization: module.generateBearerToken("encoder-id", "encoder") },
    payload: {
      data: {
        type: "incidents",
        attributes: {
          ...validIncidentPayload.data.attributes,
          specialCategoryData: true,
          severityOverall: null,
          severityCompliance: null,
          affectedPersonsCount: null,
          affectedPatientsCount: null,
        },
      },
    },
  });

  expect(response.statusCode).toBe(400);
  const body = response.json();
  expect(body.errors[0].code).toBe("MISSING_IMPACT_FIELDS");
});

test("refus si dates incohérentes resolvedAt < detectedAt (400 JSON:API)", async () => {
  const response = await module.fastifyInstance.inject({
    method: "POST",
    url: "/incidents",
    headers: { authorization: module.generateBearerToken("encoder-id", "encoder") },
    payload: {
      data: {
        type: "incidents",
        attributes: {
          ...validIncidentPayload.data.attributes,
          detectedAt: "2026-02-20T12:00:00.000Z",
          resolvedAt: "2026-02-19T08:00:00.000Z",
        },
      },
    },
  });

  expect(response.statusCode).toBe(400);
  const body = response.json();
  expect(body.errors[0].code).toBe("INCOHERENT_DATES");
});

test("auditeur ne peut pas créer (403)", async () => {
  const response = await module.fastifyInstance.inject({
    method: "POST",
    url: "/incidents",
    headers: { authorization: module.generateBearerToken("auditor-id", "auditor") },
    payload: validIncidentPayload,
  });
  expect(response.statusCode).toBe(403);
});

test("tech_admin → 403 sur tout le registre", async () => {
  const response = await module.fastifyInstance.inject({
    method: "POST",
    url: "/incidents",
    headers: { authorization: module.generateBearerToken("admin-id", "tech_admin") },
    payload: validIncidentPayload,
  });
  expect(response.statusCode).toBe(403);
});

test("création journalisée (INCIDENT_CREATED)", async () => {
  await module.fastifyInstance.inject({
    method: "POST",
    url: "/incidents",
    headers: { authorization: module.generateBearerToken("encoder-id", "encoder") },
    payload: validIncidentPayload,
  });

  const events = await module.em
    .getRepository(AuditEventEntity)
    .find({ action: "INCIDENT_CREATED" });
  expect(events.length).toBeGreaterThanOrEqual(1);
});
