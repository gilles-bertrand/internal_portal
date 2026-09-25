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
  await module.em.begin();
  await runTest();
  await module.em.rollback();
});

// @lat: [[backend/permissions#Route GET /me/ability]]
test("GET /me/ability returns an empty rule set for a caller without permissions", async () => {
  const response = await module.fastifyInstance.inject({
    method: "GET",
    url: "/me/ability",
  });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ data: { rules: [] } });
});

test("GET /me/ability returns the caller's own rules (e.g. tech_admin's manage:User/Role)", async () => {
  const rules = [
    { action: "manage", subject: "User" },
    { action: "manage", subject: "Role" },
  ];

  const response = await module.fastifyInstance.inject({
    method: "GET",
    url: "/me/ability",
    headers: module.rulesHeader(rules),
  });

  expect(response.statusCode).toBe(200);
  expect(response.json().data.rules).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ action: "manage", subject: "User" }),
      expect.objectContaining({ action: "manage", subject: "Role" }),
    ]),
  );
});

test("GET /me/ability does not leak rules for a resource the caller has no rule for", async () => {
  const rules = [{ action: "read", subject: "AccessRecord" }];

  const response = await module.fastifyInstance.inject({
    method: "GET",
    url: "/me/ability",
    headers: module.rulesHeader(rules),
  });

  expect(response.statusCode).toBe(200);
  const { rules: returnedRules } = response.json().data as {
    rules: { action: string; subject: string }[];
  };
  expect(returnedRules.some((r) => r.subject === "User")).toBe(false);
  expect(returnedRules.some((r) => r.subject === "Role")).toBe(false);
});
