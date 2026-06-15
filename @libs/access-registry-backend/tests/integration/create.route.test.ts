import { afterAll, aroundEach, beforeAll, expect, test } from "vitest";
import { TestModule } from "#tests/utils/setup-module.js";
import { GENESIS_HASH } from "@libs/backend-shared";

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

const validPayload = {
  data: {
    type: "access-records",
    attributes: {
      accessedAt: "2024-06-01T09:00:00.000Z",
      accessorRef: "emp-001",
      dataSubjectRef: "cust-abc-pseudonym",
      dataCategories: ["identité"],
      isSpecialCategory: false,
      accessType: "consultation",
      purpose: "support",
      legalBasis: "art6.1b",
      sourceSystem: "CRM",
      justification: "Demande client",
    },
  },
};

test("crée un enregistrement et retourne JSON:API (seq=1, prevHash=GENESIS)", async () => {
  const response = await module.fastifyInstance.inject({
    method: "POST",
    url: "/access-records",
    headers: { authorization: module.generateBearerToken("encoder-id", "encoder") },
    payload: validPayload,
  });

  expect(response.statusCode).toBe(200);
  const body = response.json();
  expect(body.data.type).toBe("access-records");
  expect(body.data.attributes.seq).toBe(1);
  expect(body.data.attributes.prevHash).toBe(GENESIS_HASH);
  expect(body.data.attributes.hash).toHaveLength(64);
  expect(body.data.attributes.encodedBy).toBe("encoder-id");
  expect(body.data.attributes.retentionUntil).toBeTruthy();
});

test("2e insert est chaîné sur le 1er (prevHash == hash précédent)", async () => {
  const r1 = await module.fastifyInstance.inject({
    method: "POST",
    url: "/access-records",
    headers: { authorization: module.generateBearerToken("encoder-id", "encoder") },
    payload: validPayload,
  });
  const hash1 = r1.json().data.attributes.hash as string;

  const r2 = await module.fastifyInstance.inject({
    method: "POST",
    url: "/access-records",
    headers: { authorization: module.generateBearerToken("encoder-id", "encoder") },
    payload: validPayload,
  });

  expect(r2.json().data.attributes.prevHash).toBe(hash1);
  expect(r2.json().data.attributes.seq).toBe(2);
});

test("refus si transmission sans recipient (400 JSON:API)", async () => {
  const response = await module.fastifyInstance.inject({
    method: "POST",
    url: "/access-records",
    headers: { authorization: module.generateBearerToken("encoder-id", "encoder") },
    payload: {
      data: {
        type: "access-records",
        attributes: { ...validPayload.data.attributes, accessType: "transmission" },
      },
    },
  });

  expect(response.statusCode).toBe(400);
  const body = response.json();
  expect(body.errors[0].code).toBe("MISSING_RECIPIENT");
});

test("refus si isSpecialCategory sans base art. 9.2 (400 JSON:API)", async () => {
  const response = await module.fastifyInstance.inject({
    method: "POST",
    url: "/access-records",
    headers: { authorization: module.generateBearerToken("encoder-id", "encoder") },
    payload: {
      data: {
        type: "access-records",
        attributes: {
          ...validPayload.data.attributes,
          isSpecialCategory: true,
          legalBasis: "art6.1b",
        },
      },
    },
  });

  expect(response.statusCode).toBe(400);
  const body = response.json();
  expect(body.errors[0].code).toBe("MISSING_ART9_BASIS");
});

test("non authentifié → 401", async () => {
  const response = await module.fastifyInstance.inject({
    method: "POST",
    url: "/access-records",
    payload: validPayload,
  });
  expect(response.statusCode).toBe(401);
});

test("DPO ne peut pas créer (403)", async () => {
  const response = await module.fastifyInstance.inject({
    method: "POST",
    url: "/access-records",
    headers: { authorization: module.generateBearerToken("dpo-id", "dpo") },
    payload: validPayload,
  });
  expect(response.statusCode).toBe(403);
});

test("tech_admin → 403 sur tout le registre", async () => {
  const response = await module.fastifyInstance.inject({
    method: "POST",
    url: "/access-records",
    headers: { authorization: module.generateBearerToken("admin-id", "tech_admin") },
    payload: validPayload,
  });
  expect(response.statusCode).toBe(403);
});
