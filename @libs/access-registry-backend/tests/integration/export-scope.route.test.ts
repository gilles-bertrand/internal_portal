import { afterAll, aroundEach, beforeAll, expect, test } from "vitest";
import { TestModule } from "#tests/utils/setup-module.js";
import { accessRecordPayload } from "#tests/utils/fixtures.js";

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

async function createSourceSystem(label: string): Promise<string> {
  const res = await module.fastifyInstance.inject({
    method: "POST",
    url: "/source-systems",
    headers: { authorization: module.generateBearerToken("encoder-id", "encoder") },
    payload: { data: { type: "source-systems", attributes: { label } } },
  });
  return res.json().data.attributes.code as string;
}

async function seedRecordFor(sourceSystem: string, dataSubjectRef: string) {
  await module.fastifyInstance.inject({
    method: "POST",
    url: "/access-records",
    headers: { authorization: module.generateBearerToken("encoder-id", "encoder") },
    payload: accessRecordPayload({ sourceSystem, dataSubjectRef }),
  });
}

test("export filtré par source system → uniquement les accès de ce système", async () => {
  const crm = await createSourceSystem("CRM");
  const erp = await createSourceSystem("ERP");
  await seedRecordFor(crm, "cust-crm");
  await seedRecordFor(erp, "cust-erp");

  const response = await module.fastifyInstance.inject({
    method: "POST",
    url: "/access-records/export",
    headers: { authorization: module.generateBearerToken("dpo-id", "dpo") },
    payload: { format: "json", sourceSystem: crm },
  });

  expect(response.statusCode).toBe(200);
  const { data } = response.json();
  expect(data.manifest.count).toBe(1);
  expect(data.content).toContain("cust-crm");
  expect(data.content).not.toContain("cust-erp");
});

test("export sans sourceSystem → registre complet", async () => {
  const crm = await createSourceSystem("CRM");
  const erp = await createSourceSystem("ERP");
  await seedRecordFor(crm, "cust-crm");
  await seedRecordFor(erp, "cust-erp");

  const response = await module.fastifyInstance.inject({
    method: "POST",
    url: "/access-records/export",
    headers: { authorization: module.generateBearerToken("dpo-id", "dpo") },
    payload: { format: "json" },
  });

  expect(response.statusCode).toBe(200);
  const { data } = response.json();
  expect(data.manifest.count).toBe(2);
  expect(data.content).toContain("cust-crm");
  expect(data.content).toContain("cust-erp");
});

test("export filtré sur un source system non-genesis reste intègre (chaîne complète)", async () => {
  // A est créé en premier (seq 0 = genesis), B ensuite (seq 1). Filtrer sur B
  // exporte un sous-ensemble non contigu : l'intégrité doit rester OK car elle
  // porte sur la chaîne complète du registre, pas sur le sous-ensemble.
  const a = await createSourceSystem("Alpha");
  const b = await createSourceSystem("Beta");
  await seedRecordFor(a, "cust-alpha");
  await seedRecordFor(b, "cust-beta");

  const response = await module.fastifyInstance.inject({
    method: "POST",
    url: "/access-records/export",
    headers: { authorization: module.generateBearerToken("dpo-id", "dpo") },
    payload: { format: "json", sourceSystem: b },
  });

  expect(response.statusCode).toBe(200);
  const { data } = response.json();
  expect(data.manifest.integrityOk).toBe(true);
  expect(data.manifest.count).toBe(1);
  expect(data.content).toContain("cust-beta");
  expect(data.content).not.toContain("cust-alpha");
  const parsed = JSON.parse(data.content);
  expect(parsed.integrity.ok).toBe(true);
});

test("export avec source system inexistant → 404", async () => {
  await module.fastifyInstance.inject({
    method: "POST",
    url: "/access-records",
    headers: { authorization: module.generateBearerToken("encoder-id", "encoder") },
    payload: accessRecordPayload(),
  });

  const response = await module.fastifyInstance.inject({
    method: "POST",
    url: "/access-records/export",
    headers: { authorization: module.generateBearerToken("dpo-id", "dpo") },
    payload: { format: "json", sourceSystem: "systeme-fantome" },
  });

  expect(response.statusCode).toBe(404);
});
