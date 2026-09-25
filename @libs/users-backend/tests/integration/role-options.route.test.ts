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

test("GET /users/role-options is available to callers with manage:User only", async () => {
  await module.ensureRole("encoder");
  await module.ensureRole("dpo");
  const caller = await module.createUser({
    email: `user-manager-${Date.now()}@test.com`,
    firstName: "User",
    lastName: "Manager",
    password: "testpassword123",
    roleName: "user_manager",
  });
  await module.grantPermission(caller.roleId, "manage", "User");

  const roleOptionsResponse = await module.fastifyInstance.inject({
    method: "GET",
    url: "/users/role-options",
    headers: { authorization: module.generateBearerToken(caller.id) },
  });

  expect(roleOptionsResponse.statusCode).toBe(200);
  expect(roleOptionsResponse.json().data).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        type: "roles",
        attributes: expect.objectContaining({ name: "encoder" }),
      }),
      expect.objectContaining({
        type: "roles",
        attributes: expect.objectContaining({ name: "dpo" }),
      }),
    ]),
  );

  const rolesResponse = await module.fastifyInstance.inject({
    method: "GET",
    url: "/roles",
    headers: { authorization: module.generateBearerToken(caller.id) },
  });

  expect(rolesResponse.statusCode).toBe(403);
});

test("GET /users/role-options rejects callers without manage:User", async () => {
  const caller = await module.createUser({
    email: `encoder-${Date.now()}@test.com`,
    firstName: "Encoder",
    lastName: "User",
    password: "testpassword123",
    roleName: "encoder",
  });

  const response = await module.fastifyInstance.inject({
    method: "GET",
    url: "/users/role-options",
    headers: { authorization: module.generateBearerToken(caller.id) },
  });

  expect(response.statusCode).toBe(403);
});
