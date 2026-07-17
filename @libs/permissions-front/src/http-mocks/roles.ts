/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { http, HttpResponse } from 'msw';

const mockRules: Record<string, any[]> = {
  'role-tech_admin': [
    {
      action: 'manage',
      subject: 'User',
      conditions: null,
      fields: null,
      inverted: false,
      order: 0,
    },
    {
      action: 'manage',
      subject: 'Role',
      conditions: null,
      fields: null,
      inverted: false,
      order: 0,
    },
  ],
  'role-encoder': [
    {
      action: 'create',
      subject: 'AccessRecord',
      conditions: null,
      fields: null,
      inverted: false,
      order: 0,
    },
  ],
  'role-dpo': [
    {
      action: 'read',
      subject: 'AccessRecord',
      conditions: null,
      fields: null,
      inverted: false,
      order: 0,
    },
  ],
};

const mockRoles = [
  {
    id: 'role-tech_admin',
    type: 'roles' as const,
    attributes: {
      name: 'tech_admin',
      description: 'Administration technique et comptes',
    },
  },
  {
    id: 'role-encoder',
    type: 'roles' as const,
    attributes: {
      name: 'encoder',
      description: 'Encode les accès et incidents',
    },
  },
  {
    id: 'role-dpo',
    type: 'roles' as const,
    attributes: {
      name: 'dpo',
      description: 'Délégué à la protection des données',
    },
  },
  {
    id: 'role-auditor',
    type: 'roles' as const,
    attributes: {
      name: 'auditor',
      description: "Audite l'intégrité des registres",
    },
  },
];

export default [
  http.get('/api/v1/roles', () => {
    return HttpResponse.json({ data: mockRoles });
  }),
  http.get('/api/v1/roles/{id}', (req) => {
    const { id } = req.params;
    const role = mockRoles.find((r) => r.id === id);
    if (!role) {
      return HttpResponse.json(
        {
          errors: [
            { status: '404', title: 'Role Not Found', code: 'ROLE_NOT_FOUND' },
          ],
        },
        { status: 404 }
      );
    }
    return HttpResponse.json({
      data: {
        ...role,
        attributes: {
          ...role.attributes,
          rules: mockRules[id as string] ?? [],
        },
      },
    });
  }),
  http.post('/api/v1/roles/', async (req) => {
    const json = (await req.request.json()) as Record<string, any>;
    return HttpResponse.json({
      data: {
        id: json.data.lid ?? `role-${Date.now()}`,
        type: 'roles' as const,
        attributes: json.data.attributes,
      },
    });
  }),
  http.patch('/api/v1/roles/{id}', async (req) => {
    const json = (await req.request.json()) as Record<string, any>;
    return HttpResponse.json({
      data: {
        id: json.data.lid,
        type: 'roles' as const,
        attributes: json.data.attributes,
      },
    });
  }),
  http.put('/api/v1/roles/{id}/rules', async (req) => {
    const { id } = req.params;
    const json = (await req.request.json()) as { data: any[] };
    mockRules[id as string] = json.data;
    const role = mockRoles.find((r) => r.id === id);
    return HttpResponse.json({
      data: { ...role, attributes: { ...role?.attributes, rules: json.data } },
    });
  }),
  http.delete('/api/v1/roles/{id}', (req) => {
    const { id } = req.params;
    const role = mockRoles.find((r) => r.id === id);
    if (!role) {
      return HttpResponse.json(
        {
          errors: [
            { status: '404', title: 'Role Not Found', code: 'ROLE_NOT_FOUND' },
          ],
        },
        { status: 404 }
      );
    }
    return HttpResponse.json({ data: null }, { status: 204 });
  }),
];
