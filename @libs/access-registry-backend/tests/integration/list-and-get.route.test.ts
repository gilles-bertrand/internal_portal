import { afterAll, aroundEach, beforeAll, expect, test } from "vitest";
import { TestModule } from "#tests/utils/setup-module.js";

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

const otherPayload = {
  data: {
    type: "access-records",
    attributes: {
      accessedAt: "2024-06-01T09:00:00.000Z",
      accessorRef: "emp-999",
      dataSubjectRef: "cust-other",
      dataCategories: ["identité"],
      isSpecialCategory: false,
      accessType: "consultation",
      purpose: "support",
      legalBasis: "art6.1b",
      sourceSystem: "CRM",
      justification: "Autre encoder",
    },
  },
};

// @lat: [[backend/access-registry#Filtre de liste dérivé de la condition CASL de l'encoder]]
test("un encoder ne voit que ses propres enregistrements dans la liste", async () => {
  await module.insertUser("other-encoder-id", "encoder");

  await module.fastifyInstance.inject({
    method: "POST",
    url: "/access-records",
    headers: { authorization: module.generateBearerToken("encoder-id", "encoder") },
    payload: otherPayload,
  });
  await module.fastifyInstance.inject({
    method: "POST",
    url: "/access-records",
    headers: { authorization: module.generateBearerToken("other-encoder-id", "encoder") },
    payload: otherPayload,
  });

  const response = await module.fastifyInstance.inject({
    method: "GET",
    url: "/access-records",
    headers: { authorization: module.generateBearerToken("encoder-id", "encoder") },
  });

  expect(response.statusCode).toBe(200);
  const body = response.json();
  expect(body.meta.total).toBe(1);
  expect(body.data[0].attributes.encodedBy).toBe("encoder-id");
});

test("un dpo/auditor voit la liste complète, tous encoders confondus", async () => {
  await module.insertUser("other-encoder-id", "encoder");

  await module.fastifyInstance.inject({
    method: "POST",
    url: "/access-records",
    headers: { authorization: module.generateBearerToken("encoder-id", "encoder") },
    payload: otherPayload,
  });
  await module.fastifyInstance.inject({
    method: "POST",
    url: "/access-records",
    headers: { authorization: module.generateBearerToken("other-encoder-id", "encoder") },
    payload: otherPayload,
  });

  const dpoResponse = await module.fastifyInstance.inject({
    method: "GET",
    url: "/access-records",
    headers: { authorization: module.generateBearerToken("dpo-id", "dpo") },
  });
  const auditorResponse = await module.fastifyInstance.inject({
    method: "GET",
    url: "/access-records",
    headers: { authorization: module.generateBearerToken("auditor-id", "auditor") },
  });

  expect(dpoResponse.json().meta.total).toBe(2);
  expect(auditorResponse.json().meta.total).toBe(2);
});

test("un encoder ne peut pas accéder au détail de l'enregistrement d'un autre encoder (403)", async () => {
  await module.insertUser("other-encoder-id", "encoder");

  const createResponse = await module.fastifyInstance.inject({
    method: "POST",
    url: "/access-records",
    headers: { authorization: module.generateBearerToken("other-encoder-id", "encoder") },
    payload: otherPayload,
  });
  const recordId = createResponse.json().data.id as string;

  const response = await module.fastifyInstance.inject({
    method: "GET",
    url: `/access-records/${recordId}`,
    headers: { authorization: module.generateBearerToken("encoder-id", "encoder") },
  });

  expect(response.statusCode).toBe(403);
});

test("un dpo/auditor peut accéder au détail de l'enregistrement de n'importe quel encoder", async () => {
  const createResponse = await module.fastifyInstance.inject({
    method: "POST",
    url: "/access-records",
    headers: { authorization: module.generateBearerToken("encoder-id", "encoder") },
    payload: otherPayload,
  });
  const recordId = createResponse.json().data.id as string;

  const dpoResponse = await module.fastifyInstance.inject({
    method: "GET",
    url: `/access-records/${recordId}`,
    headers: { authorization: module.generateBearerToken("dpo-id", "dpo") },
  });
  const auditorResponse = await module.fastifyInstance.inject({
    method: "GET",
    url: `/access-records/${recordId}`,
    headers: { authorization: module.generateBearerToken("auditor-id", "auditor") },
  });

  expect(dpoResponse.statusCode).toBe(200);
  expect(auditorResponse.statusCode).toBe(200);
});

// @lat: [[backend/access-registry#Détail : nom d'affichage de l'encodeur]]
test("le détail (GET /:id) résout encodedByName depuis l'utilisateur encodeur", async () => {
  const createResponse = await module.fastifyInstance.inject({
    method: "POST",
    url: "/access-records",
    headers: { authorization: module.generateBearerToken("encoder-id", "encoder") },
    payload: otherPayload,
  });
  const recordId = createResponse.json().data.id as string;

  const response = await module.fastifyInstance.inject({
    method: "GET",
    url: `/access-records/${recordId}`,
    headers: { authorization: module.generateBearerToken("dpo-id", "dpo") },
  });

  expect(response.statusCode).toBe(200);
  // encoder-id est seedé firstName "E" / lastName "N" (global-setup).
  expect(response.json().data.attributes.encodedByName).toBe("E N");
});
