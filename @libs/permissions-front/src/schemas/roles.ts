import {
  withDefaults,
  type WithLegacy,
} from '@warp-drive/legacy/model/migration-support';
import type { Type } from '@warp-drive/core/types/symbols';

export interface PermissionRule {
  action: string;
  subject: string;
  conditions?: Record<string, unknown> | null;
  fields?: string[] | null;
  inverted: boolean;
  order: number;
}

const RoleSchema = withDefaults({
  type: 'roles',
  fields: [
    { name: 'name', kind: 'attribute' },
    { name: 'description', kind: 'attribute' },
    { name: 'rules', kind: 'attribute' },
  ],
});

export default RoleSchema;

export type Role = WithLegacy<{
  name: string;
  description: string | null;
  rules?: PermissionRule[];
  [Type]: 'roles';
}>;
