import { afterAll, aroundEach, beforeAll, expect, test } from "vitest";
import { createHmac } from "node:crypto";
import { TestModule } from "#tests/utils/setup-module.js";
import { validIncidentPayload } from "#tests/utils/fixtures.js";

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

test("export PDF unitaire avec manifeste et HMAC", async () => {
  const created = await module.fastifyInstance.inject({
    method: "POST",
    url: "/incidents",
    headers: { authorization: module.generateBearerToken("encoder-id", "encoder") },
    payload: validIncidentPayload,
  });
  const id = created.json().data.id as string;

  const response = await module.fastifyInstance.inject({
    method: "POST",
    url: `/incidents/${id}/export`,
    headers: { authorization: module.generateBearerToken("dpo-id", "dpo") },
  });

  expect(response.statusCode).toBe(200);
  const { data } = response.json();
  expect(data.format).toBe("pdf");
  expect(data.encoding).toBe("base64");
  expect(data.manifest.count).toBe(1);
  expect(data.manifest.integrityOk).toBe(true);

  const buf = Buffer.from(data.content, "base64");
  expect(buf.length).toBeGreaterThan(1000);
  expect(buf.subarray(0, 4).toString("latin1")).toBe("%PDF");

  const expected = createHmac("sha256", TestModule.EXPORT_SIGNING_KEY).update(buf).digest("hex");
  expect(data.signature).toBe(expected);
});

test("404 si incident inconnu", async () => {
  const response = await module.fastifyInstance.inject({
    method: "POST",
    url: "/incidents/00000000-0000-0000-0000-000000000000/export",
    headers: { authorization: module.generateBearerToken("dpo-id", "dpo") },
  });
  expect(response.statusCode).toBe(404);
});
