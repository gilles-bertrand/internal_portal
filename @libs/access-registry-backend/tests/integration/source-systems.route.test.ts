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

function createPayload(label: string) {
  return { data: { type: "source-systems", attributes: { label } } };
}

// @lat: [[backend/access-registry#Référentiel source-systems (creatable)]]
test("GET /source-systems retourne la liste (JSON:API)", async () => {
  const response = await module.fastifyInstance.inject({
    method: "GET",
    url: "/source-systems",
    headers: { authorization: module.generateBearerToken("encoder-id", "encoder") },
  });

  expect(response.statusCode).toBe(200);
  expect(Array.isArray(response.json().data)).toBe(true);
});

// @lat: [[backend/access-registry#Référentiel source-systems (creatable)]]
test("POST /source-systems crée un système avec un code slugifié", async () => {
  const response = await module.fastifyInstance.inject({
    method: "POST",
    url: "/source-systems",
    headers: { authorization: module.generateBearerToken("encoder-id", "encoder") },
    payload: createPayload("Dossier Patient Élysée"),
  });

  expect(response.statusCode).toBe(200);
  const body = response.json();
  expect(body.data.type).toBe("source-systems");
  expect(body.data.attributes.label).toBe("Dossier Patient Élysée");
  expect(body.data.attributes.code).toBe("dossier-patient-elysee");
});

// @lat: [[backend/access-registry#Référentiel source-systems (creatable)]]
test("POST /source-systems est idempotent : un doublon renvoie l'existant", async () => {
  const first = await module.fastifyInstance.inject({
    method: "POST",
    url: "/source-systems",
    headers: { authorization: module.generateBearerToken("encoder-id", "encoder") },
    payload: createPayload("ERP Interne"),
  });
  const second = await module.fastifyInstance.inject({
    method: "POST",
    url: "/source-systems",
    headers: { authorization: module.generateBearerToken("encoder-id", "encoder") },
    payload: createPayload("erp interne"),
  });

  expect(second.statusCode).toBe(200);
  expect(second.json().data.id).toBe(first.json().data.id);
});

// @lat: [[backend/access-registry#Référentiel source-systems (creatable)]]
test("POST /source-systems créé est ensuite listé par GET", async () => {
  await module.fastifyInstance.inject({
    method: "POST",
    url: "/source-systems",
    headers: { authorization: module.generateBearerToken("encoder-id", "encoder") },
    payload: createPayload("Portail RH"),
  });

  const list = await module.fastifyInstance.inject({
    method: "GET",
    url: "/source-systems",
    headers: { authorization: module.generateBearerToken("encoder-id", "encoder") },
  });

  const codes = list
    .json()
    .data.map((entry: { attributes: { code: string } }) => entry.attributes.code);
  expect(codes).toContain("portail-rh");
});

// @lat: [[backend/access-registry#Référentiel source-systems (creatable)]]
test("POST /source-systems sans droit create AccessRecord reçoit 403", async () => {
  const response = await module.fastifyInstance.inject({
    method: "POST",
    url: "/source-systems",
    headers: { authorization: module.generateBearerToken("dpo-id", "dpo") },
    payload: createPayload("Interdit"),
  });

  expect(response.statusCode).toBe(403);
});
