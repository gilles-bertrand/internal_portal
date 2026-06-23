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

test("GET /data-categories renvoie le référentiel en JSON:API", async () => {
  const response = await module.fastifyInstance.inject({
    method: "GET",
    url: "/data-categories",
    headers: { authorization: module.generateBearerToken("encoder-id", "encoder") },
  });

  expect(response.statusCode).toBe(200);
  const body = response.json();
  expect(Array.isArray(body.data)).toBe(true);
  expect(body.data.length).toBeGreaterThanOrEqual(3);
  expect(body.data[0]).toMatchObject({
    type: "data-categories",
    attributes: { code: expect.any(String), label: expect.any(String) },
  });
});

test("GET /purposes renvoie le référentiel", async () => {
  const response = await module.fastifyInstance.inject({
    method: "GET",
    url: "/purposes",
    headers: { authorization: module.generateBearerToken("encoder-id", "encoder") },
  });
  expect(response.statusCode).toBe(200);
  expect(response.json().data.length).toBeGreaterThanOrEqual(2);
});

test("GET /legal-bases expose le flag isArticle9", async () => {
  const response = await module.fastifyInstance.inject({
    method: "GET",
    url: "/legal-bases",
    headers: { authorization: module.generateBearerToken("encoder-id", "encoder") },
  });
  expect(response.statusCode).toBe(200);
  const body = response.json();
  const art9 = body.data.find(
    (b: { attributes: { isArticle9: boolean } }) => b.attributes.isArticle9,
  );
  expect(art9).toBeDefined();
});

test("référentiels nécessitent une authentification (401)", async () => {
  const response = await module.fastifyInstance.inject({
    method: "GET",
    url: "/data-categories",
  });
  expect(response.statusCode).toBe(401);
});
