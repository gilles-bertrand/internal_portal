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

test("CreateRoute returns JSON:API error on validation failure", async () => {
  const response = await module.fastifyInstance.inject({
    method: "POST",
    url: "/users",
    headers: {
      authorization: module.generateBearerToken(TestModule.TEST_USER_ID),
    },
    payload: {
      data: {
        type: "users",
        attributes: {
          email: "invalid-email",
          firstName: "New",
          lastName: "User",
          password: "testpassword",
        },
      },
    },
  });

  expect(response.statusCode).toBe(400);
  const body = response.json();
  expect(body).toHaveProperty("errors");
  expect(Array.isArray(body.errors)).toBe(true);
  expect(body.errors.length).toBeGreaterThan(0);
  expect(body.errors[0]).toMatchObject({
    status: "400",
    title: "Validation Error",
    detail: expect.any(String),
    source: {
      pointer: expect.any(String),
    },
  });
});

test("CreateRoute works correctly", async () => {
  const admin = await module.createTechAdmin();
  const encoderRole = await module.ensureRole("encoder");

  const response = await module.fastifyInstance.inject({
    method: "POST",
    url: "/users",
    headers: {
      authorization: module.generateBearerToken(admin.id),
    },
    payload: {
      data: {
        type: "users",
        attributes: {
          email: "new@test.com",
          firstName: "New",
          lastName: "User",
          password: "testpassword",
          roleId: encoderRole.id,
        },
      },
    },
  });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({
    data: {
      type: "users",
      id: expect.any(String),
      attributes: {
        email: "new@test.com",
        firstName: "New",
        lastName: "User",
        roleId: encoderRole.id,
        roleName: "encoder",
      },
    },
  });
});

test("CreateRoute rejects a caller without manage:User permission", async () => {
  const encoderRole = await module.ensureRole("encoder");

  const response = await module.fastifyInstance.inject({
    method: "POST",
    url: "/users",
    headers: {
      authorization: module.generateBearerToken(TestModule.TEST_USER_ID),
    },
    payload: {
      data: {
        type: "users",
        attributes: {
          email: "blocked@test.com",
          firstName: "Blocked",
          lastName: "User",
          password: "testpassword",
          roleId: encoderRole.id,
        },
      },
    },
  });

  expect(response.statusCode).toBe(403);
});
