import { afterAll, aroundEach, beforeAll, expect, test } from "vitest";
import { createHmac } from "node:crypto";
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

async function seedOneIncident() {
  await module.fastifyInstance.inject({
    method: "POST",
    url: "/incidents",
    headers: { authorization: module.generateBearerToken("encoder-id", "encoder") },
    payload: validIncidentPayload,
  });
}

test("DPO exporte en JSON avec signature HMAC vérifiable", async () => {
  await seedOneIncident();

  const response = await module.fastifyInstance.inject({
    method: "POST",
    url: "/incidents/export",
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

  const expected = createHmac("sha256", TestModule.EXPORT_SIGNING_KEY)
    .update(Buffer.from(data.content, "utf-8"))
    .digest("hex");
  expect(data.signature).toBe(expected);
});

test("export PDF registre : contenu base64 non vide", async () => {
  await seedOneIncident();

  const response = await module.fastifyInstance.inject({
    method: "POST",
    url: "/incidents/export",
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

test("l'export registre est tracé (INCIDENT_EXPORTED)", async () => {
  await seedOneIncident();

  await module.fastifyInstance.inject({
    method: "POST",
    url: "/incidents/export",
    headers: { authorization: module.generateBearerToken("dpo-id", "dpo") },
    payload: { format: "json" },
  });

  const events = await module.em
    .getRepository(AuditEventEntity)
    .find({ action: "INCIDENT_EXPORTED" });
  expect(events.length).toBeGreaterThanOrEqual(1);
});
