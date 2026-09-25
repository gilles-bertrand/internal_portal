import { afterAll, aroundEach, beforeAll, expect, test } from "vitest";
import { TestModule } from "#tests/utils/setup-module.js";
import { FakeUserEntity } from "#tests/utils/fake-user.entity.js";
import { RoleEntity } from "#src/entities/role.entity.js";
import { randomUUID } from "crypto";

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

const MANAGE_ROLE = [{ action: "manage", subject: "Role" }];

test("GET /roles without manage:Role is forbidden", async () => {
  const response = await module.fastifyInstance.inject({
    method: "GET",
    url: "/roles",
  });

  expect(response.statusCode).toBe(403);
});

test("GET /roles with manage:Role lists roles", async () => {
  const response = await module.fastifyInstance.inject({
    method: "GET",
    url: "/roles",
    headers: module.rulesHeader(MANAGE_ROLE),
  });

  expect(response.statusCode).toBe(200);
  expect(Array.isArray(response.json().data)).toBe(true);
});

test("POST /roles creates a role, duplicate name is rejected", async () => {
  const create = await module.fastifyInstance.inject({
    method: "POST",
    url: "/roles",
    headers: module.rulesHeader(MANAGE_ROLE),
    payload: { data: { attributes: { name: "supervisor", description: "desc" } } },
  });

  expect(create.statusCode).toBe(200);
  expect(create.json().data.attributes.name).toBe("supervisor");

  const duplicate = await module.fastifyInstance.inject({
    method: "POST",
    url: "/roles",
    headers: module.rulesHeader(MANAGE_ROLE),
    payload: { data: { attributes: { name: "supervisor", description: "desc" } } },
  });

  expect(duplicate.statusCode).toBe(409);
});

test("PATCH /roles/:id updates name and description", async () => {
  const role = module.em.getRepository(RoleEntity).create({
    id: randomUUID(),
    name: "reviewer",
    description: null,
  });
  await module.em.flush();

  const response = await module.fastifyInstance.inject({
    method: "PATCH",
    url: `/roles/${role.id}`,
    headers: module.rulesHeader(MANAGE_ROLE),
    payload: { data: { attributes: { description: "updated" } } },
  });

  expect(response.statusCode).toBe(200);
  expect(response.json().data.attributes.description).toBe("updated");
});

test("PUT /roles/:id/rules replaces the permission rules", async () => {
  const role = module.em.getRepository(RoleEntity).create({
    id: randomUUID(),
    name: "operator",
    description: null,
  });
  await module.em.flush();

  const response = await module.fastifyInstance.inject({
    method: "PUT",
    url: `/roles/${role.id}/rules`,
    headers: module.rulesHeader(MANAGE_ROLE),
    payload: { data: [{ action: "read", subject: "Incident", inverted: false, order: 0 }] },
  });

  expect(response.statusCode).toBe(200);
  expect(response.json().data.attributes.rules).toHaveLength(1);
  expect(response.json().data.attributes.rules[0]).toMatchObject({
    action: "read",
    subject: "Incident",
  });
});

test("DELETE /roles/:id succeeds when the role is unused", async () => {
  const role = module.em.getRepository(RoleEntity).create({
    id: randomUUID(),
    name: "unused-role",
    description: null,
  });
  await module.em.flush();

  const response = await module.fastifyInstance.inject({
    method: "DELETE",
    url: `/roles/${role.id}`,
    headers: module.rulesHeader(MANAGE_ROLE),
  });

  expect(response.statusCode).toBe(204);
});

// @lat: [[backend/permissions#Suppression d'un rôle encore assigné]]
test("DELETE /roles/:id is refused when a user still references the role", async () => {
  const role = module.em.getRepository(RoleEntity).create({
    id: randomUUID(),
    name: "in-use-role",
    description: null,
  });
  module.em.getRepository(FakeUserEntity).create({
    id: randomUUID(),
    role: role.id,
  });
  await module.em.flush();

  const response = await module.fastifyInstance.inject({
    method: "DELETE",
    url: `/roles/${role.id}`,
    headers: module.rulesHeader(MANAGE_ROLE),
  });

  expect(response.statusCode).toBe(409);
});
