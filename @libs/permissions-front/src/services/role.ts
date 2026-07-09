import type { PermissionRule, Role } from '#src/schemas/roles.ts';
import type {
  CreatedRole,
  UpdatedRole,
} from '#src/components/forms/role-validation.ts';
import { assert } from '@ember/debug';
import Service, { service } from '@ember/service';
import { cacheKeyFor, type Store } from '@warp-drive/core';
import {
  createRecord,
  deleteRecord,
  updateRecord,
} from '@warp-drive/utilities/json-api';
import type SessionService from 'ember-simple-auth/services/session';

export default class RoleService extends Service {
  @service declare store: Store;
  @service declare session: SessionService;

  public async save(data: CreatedRole | UpdatedRole) {
    if (data.id) {
      return this.update(data as UpdatedRole);
    } else {
      return this.create(data);
    }
  }

  public async delete(data: UpdatedRole) {
    const existingRole = this.store.peekRecord<Role>({
      id: data.id,
      type: 'roles',
    });
    assert('Role must exist to be deleted', existingRole);
    const request = deleteRecord(existingRole);
    request.body = JSON.stringify({});
    return this.store.request(request);
  }

  public async updateRules(
    roleId: string,
    rules: PermissionRule[]
  ): Promise<Role> {
    const response = await fetch(`/api/v1/roles/${roleId}/rules`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authorizationHeader(),
      },
      body: JSON.stringify({ data: rules }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update role permissions (${response.status})`);
    }

    const payload = (await response.json()) as { data: { attributes: Role } };
    return payload.data.attributes;
  }

  private async create(data: CreatedRole): Promise<string> {
    const role = this.store.createRecord<Role>('roles', data);
    const request = createRecord(role);

    request.body = JSON.stringify({
      data: this.store.cache.peek(cacheKeyFor(role)),
    });

    await this.store.request(request);
    assert('Created role must have an id', role.id);
    return role.id;
  }

  private async update(data: UpdatedRole) {
    const existingRole = this.store.peekRecord<Role>({
      id: data.id,
      type: 'roles',
    });
    assert('Role must exist to be updated', existingRole);

    Object.assign(existingRole, {
      name: data.name,
      description: data.description,
    });

    const request = updateRecord(existingRole, { patch: true });

    request.body = JSON.stringify({
      data: this.store.cache.peek(cacheKeyFor(existingRole)),
    });

    return this.store.request(request);
  }

  private authorizationHeader(): string {
    const authData = this.session.data.authenticated as Record<string, unknown>;
    const accessToken = (
      authData?.['data'] as Record<string, unknown> | undefined
    )?.['accessToken'] as string | undefined;
    return accessToken ? `Bearer ${accessToken}` : '';
  }
}
