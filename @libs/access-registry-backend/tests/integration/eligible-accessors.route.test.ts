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

// @lat: [[backend/access-registry#Liste des accédants habilités (accessorRef)]]
test("un encodeur reçoit la liste des utilisateurs habilités à créer un record", async () => {
  const response = await module.fastifyInstance.inject({
    method: "GET",
    url: "/eligible-accessors",
    headers: { authorization: module.generateBearerToken("encoder-id", "encoder") },
  });

  expect(response.statusCode).toBe(200);
  const body = response.json();
  const ids = body.data.map((entry: { id: string }) => entry.id);
  expect(ids).toContain("encoder-id");
  expect(body.data[0].type).toBe("eligible-accessors");
  expect(body.data[0].attributes.name).toBeTruthy();
});

// @lat: [[backend/access-registry#Liste des accédants habilités (accessorRef)]]
test("les rôles sans droit de création (dpo/auditor) ne sont pas listés", async () => {
  const response = await module.fastifyInstance.inject({
    method: "GET",
    url: "/eligible-accessors",
    headers: { authorization: module.generateBearerToken("encoder-id", "encoder") },
  });

  const ids = response.json().data.map((entry: { id: string }) => entry.id);
  expect(ids).not.toContain("dpo-id");
  expect(ids).not.toContain("auditor-id");
});

// @lat: [[backend/access-registry#Liste des accédants habilités (accessorRef)]]
test("tech_admin (cannot manage AccessRecord) n'est pas listé", async () => {
  const response = await module.fastifyInstance.inject({
    method: "GET",
    url: "/eligible-accessors",
    headers: { authorization: module.generateBearerToken("encoder-id", "encoder") },
  });

  const ids = response.json().data.map((entry: { id: string }) => entry.id);
  expect(ids).not.toContain("admin-id");
});

// @lat: [[backend/access-registry#Liste des accédants habilités (accessorRef)]]
test("un utilisateur sans droit create AccessRecord reçoit 403", async () => {
  const response = await module.fastifyInstance.inject({
    method: "GET",
    url: "/eligible-accessors",
    headers: { authorization: module.generateBearerToken("dpo-id", "dpo") },
  });

  expect(response.statusCode).toBe(403);
});
