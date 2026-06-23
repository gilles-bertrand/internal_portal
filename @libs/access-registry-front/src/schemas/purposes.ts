import {
  withDefaults,
  type WithLegacy,
} from '@warp-drive/legacy/model/migration-support';
import type { Type } from '@warp-drive/core/types/symbols';

const PurposeSchema = withDefaults({
  type: 'purposes',
  fields: [
    { name: 'code', kind: 'attribute' },
    { name: 'label', kind: 'attribute' },
  ],
});

export default PurposeSchema;

export type Purpose = WithLegacy<{
  code: string;
  label: string;
  [Type]: 'purposes';
}>;
