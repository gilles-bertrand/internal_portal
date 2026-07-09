import { describe, expect, test, vi } from 'vitest';
import UsersCreateRoute from '#src/routes/dashboard/users/create.gts';
import UsersEditRoute from '#src/routes/dashboard/users/edit.gts';
import { query } from '@warp-drive/utilities/json-api';

vi.mock('@warp-drive/utilities/json-api', () => ({
  findRecord: vi.fn((type, id, options) => ({ type, id, options })),
  query: vi.fn((type, queryParams, options) => ({
    type,
    queryParams,
    options,
  })),
}));

type StoreRequest = (request: {
  type?: string;
  id?: string;
}) => Promise<{ content: { data: unknown } }>;

function withStore<T extends object>(route: T, request: StoreRequest) {
  Object.defineProperty(route, 'store', {
    value: {
      request,
    },
  });
  return { route, request };
}

describe('users dashboard routes', () => {
  test('create model loads role options through the manage:User endpoint', async () => {
    const request = vi.fn<StoreRequest>(() =>
      Promise.resolve({ content: { data: [] } })
    );
    const { route } = withStore(new UsersCreateRoute(), request);

    await route.model();

    expect(query).toHaveBeenCalledWith('roles', {}, {
      resourcePath: 'users/role-options',
    });
    expect(request).toHaveBeenCalled();
  });

  test('edit model loads role options through the manage:User endpoint', async () => {
    const request = vi.fn<StoreRequest>((request) => {
      if (request.type === 'users') {
        return Promise.resolve({ content: { data: { id: request.id } } });
      }
      return Promise.resolve({ content: { data: [] } });
    });
    const { route } = withStore(new UsersEditRoute(), request);

    await route.model({ user_id: 'user-1' });

    expect(query).toHaveBeenCalledWith('roles', {}, {
      resourcePath: 'users/role-options',
    });
  });
});
