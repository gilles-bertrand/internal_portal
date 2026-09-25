import { afterAll, aroundEach, beforeAll, expect, test } from "vitest";
import { createHmac } from "node:crypto";
import { TestModule } from "#tests/utils/setup-module.js";
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

const validPayload = {
  data: {
    type: "access-records",
    attributes: {
      accessedAt: "2024-06-01T09:00:00.000Z",
      accessorRef: "emp-001",
      dataSubjectRef: "cust-abc",
      dataCategories: ["identité"],
      isSpecialCategory: false,
      accessType: "consultation",
      purpose: "support",
      legalBasis: "art6.1b",
      sourceSystem: "CRM",
      justification: "Test",
    },
  },
};

async function seedOneRecord() {
  await module.fastifyInstance.inject({
    method: "POST",
    url: "/access-records",
    headers: { authorization: module.generateBearerToken("encoder-id", "encoder") },
    payload: validPayload,
  });
}

test("DPO exporte en JSON avec signature HMAC vérifiable", async () => {
  await seedOneRecord();

  const response = await module.fastifyInstance.inject({
    method: "POST",
    url: "/access-records/export",
    headers: { authorization: module.generateBearerToken("dpo-id", "dpo") },
    payload: { format: "json" },
  });

  expect(response.statusCode).toBe(200);
  const { data } = response.json();
  expect(data.format).toBe("json");
  expect(data.manifest.count).toBe(1);
  expect(data.manifest.integrityOk).toBe(true);

  const parsed = JSON.parse(data.content);
  expect(parsed.integrity.ok).toBe(true);
  expect(parsed.integrity.chainHeadHash).toHaveLength(64);

  // Signature vérifiable avec la clé de test
  const expected = createHmac("sha256", TestModule.EXPORT_SIGNING_KEY)
    .update(Buffer.from(data.content, "utf-8"))
    .digest("hex");
  expect(data.signature).toBe(expected);
});

test("export CSV : contenu + manifeste cohérents", async () => {
  await seedOneRecord();

  const response = await module.fastifyInstance.inject({
    method: "POST",
    url: "/access-records/export",
    headers: { authorization: module.generateBearerToken("dpo-id", "dpo") },
    payload: { format: "csv" },
  });

  expect(response.statusCode).toBe(200);
  const { data } = response.json();
  expect(data.format).toBe("csv");
  expect(data.content).toContain("# integrity:OK");
  expect(data.content).toContain("seq,id,accessedAt");
  expect(data.content).toContain("cust-abc");
  expect(data.manifest.integrityOk).toBe(true);
  expect(data.manifest.contentSha256).toHaveLength(64);
});

test("export PDF : contenu base64 non vide", async () => {
  await seedOneRecord();

  const response = await module.fastifyInstance.inject({
    method: "POST",
    url: "/access-records/export",
    headers: { authorization: module.generateBearerToken("dpo-id", "dpo") },
    payload: { format: "pdf" },
  });

  expect(response.statusCode).toBe(200);
  const { data } = response.json();
  expect(data.format).toBe("pdf");
  expect(data.encoding).toBe("base64");
  expect(data.manifest.integrityOk).toBe(true);
  const buf = Buffer.from(data.content, "base64");
  expect(buf.length).toBeGreaterThan(0);
  expect(buf.subarray(0, 4).toString("latin1")).toBe("%PDF");
});

test("l'export est tracé dans le méta-journal (REGISTRY_EXPORTED)", async () => {
  await seedOneRecord();

  await module.fastifyInstance.inject({
    method: "POST",
    url: "/access-records/export",
    headers: { authorization: module.generateBearerToken("dpo-id", "dpo") },
    payload: { format: "json" },
  });

  const events = await module.em
    .getRepository(AuditEventEntity)
    .find({ action: "REGISTRY_EXPORTED" });
  expect(events.length).toBeGreaterThanOrEqual(1);
});

test("encoder peut exporter le registre", async () => {
  await seedOneRecord();

  const response = await module.fastifyInstance.inject({
    method: "POST",
    url: "/access-records/export",
    headers: { authorization: module.generateBearerToken("encoder-id", "encoder") },
    payload: { format: "json" },
  });
  expect(response.statusCode).toBe(200);
});

test("format invalide → 400", async () => {
  const response = await module.fastifyInstance.inject({
    method: "POST",
    url: "/access-records/export",
    headers: { authorization: module.generateBearerToken("dpo-id", "dpo") },
    payload: { format: "xml" },
  });
  expect(response.statusCode).toBe(400);
});
