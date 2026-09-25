import { afterAll, aroundEach, beforeAll, describe, expect, test } from "vitest";
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

// @lat: [[backend/permissions#Matrice de couverture obligatoire]]
const ROLE_EXPECTATIONS = [
  { roleName: "encoder", expectedStatus: 403 },
  { roleName: "dpo", expectedStatus: 403 },
  { roleName: "auditor", expectedStatus: 403 },
  { roleName: "tech_admin", expectedStatus: 200 },
] as const;

async function createCaller(roleName: (typeof ROLE_EXPECTATIONS)[number]["roleName"]) {
  return roleName === "tech_admin"
    ? module.createTechAdmin()
    : module.createUser({
        email: `${roleName}-caller-${Date.now()}@test.com`,
        firstName: "Caller",
        lastName: roleName,
        password: "testpassword123",
        roleName,
      });
}

describe.each(ROLE_EXPECTATIONS)("role $roleName", ({ roleName, expectedStatus }) => {
  test(`POST /users -> ${expectedStatus}`, async () => {
    const caller = await createCaller(roleName);
    const encoderRole = await module.ensureRole("encoder");

    const response = await module.fastifyInstance.inject({
      method: "POST",
      url: "/users",
      headers: { authorization: module.generateBearerToken(caller.id) },
      payload: {
        data: {
          type: "users",
          attributes: {
            email: `new-${roleName}-${Date.now()}@test.com`,
            firstName: "New",
            lastName: "User",
            password: "testpassword123",
            roleId: encoderRole.id,
          },
        },
      },
    });

    expect(response.statusCode).toBe(expectedStatus);
  });

  test(`GET /roles -> ${expectedStatus}`, async () => {
    const caller = await createCaller(roleName);

    const response = await module.fastifyInstance.inject({
      method: "GET",
      url: "/roles",
      headers: { authorization: module.generateBearerToken(caller.id) },
    });

    expect(response.statusCode).toBe(expectedStatus);
  });

  test(`PATCH /users/:id -> ${expectedStatus}`, async () => {
    const caller = await createCaller(roleName);
    const target = await module.createUser({
      email: `target-${roleName}-${Date.now()}@test.com`,
      firstName: "Target",
      lastName: "User",
      password: "testpassword123",
      roleName: "encoder",
    });

    const response = await module.fastifyInstance.inject({
      method: "PATCH",
      url: `/users/${target.id}`,
      headers: { authorization: module.generateBearerToken(caller.id) },
      payload: {
        data: {
          id: target.id,
          type: "users",
          attributes: { firstName: "Updated" },
        },
      },
    });

    expect(response.statusCode).toBe(expectedStatus);
  });

  test(`GET /users -> ${expectedStatus}`, async () => {
    const caller = await createCaller(roleName);

    const response = await module.fastifyInstance.inject({
      method: "GET",
      url: "/users",
      headers: { authorization: module.generateBearerToken(caller.id) },
    });

    expect(response.statusCode).toBe(expectedStatus);
  });

  test(`GET /users/:id -> ${expectedStatus}`, async () => {
    const caller = await createCaller(roleName);
    const target = await module.createUser({
      email: `target-get-${roleName}-${Date.now()}@test.com`,
      firstName: "Target",
      lastName: "User",
      password: "testpassword123",
      roleName: "encoder",
    });

    const response = await module.fastifyInstance.inject({
      method: "GET",
      url: `/users/${target.id}`,
      headers: { authorization: module.generateBearerToken(caller.id) },
    });

    expect(response.statusCode).toBe(expectedStatus);
  });

  test(`DELETE /users/:id -> ${roleName === "tech_admin" ? 204 : 403}`, async () => {
    const caller = await createCaller(roleName);
    const target = await module.createUser({
      email: `target-delete-${roleName}-${Date.now()}@test.com`,
      firstName: "Target",
      lastName: "User",
      password: "testpassword123",
      roleName: "encoder",
    });

    const response = await module.fastifyInstance.inject({
      method: "DELETE",
      url: `/users/${target.id}`,
      headers: { authorization: module.generateBearerToken(caller.id) },
    });

    expect(response.statusCode).toBe(roleName === "tech_admin" ? 204 : 403);
  });
});
