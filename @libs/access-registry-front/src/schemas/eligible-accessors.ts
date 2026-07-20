import {
  withDefaults,
  type WithLegacy,
} from '@warp-drive/legacy/model/migration-support';
import type { Type } from '@warp-drive/core/types/symbols';

const EligibleAccessorSchema = withDefaults({
  type: 'eligible-accessors',
  fields: [{ name: 'name', kind: 'attribute' }],
});

export default EligibleAccessorSchema;

export type EligibleAccessor = WithLegacy<{
  name: string;
  [Type]: 'eligible-accessors';
}>;
