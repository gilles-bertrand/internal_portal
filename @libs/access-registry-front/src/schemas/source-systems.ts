import {
  withDefaults,
  type WithLegacy,
} from '@warp-drive/legacy/model/migration-support';
import type { Type } from '@warp-drive/core/types/symbols';

const SourceSystemSchema = withDefaults({
  type: 'source-systems',
  fields: [
    { name: 'code', kind: 'attribute' },
    { name: 'label', kind: 'attribute' },
  ],
});

export default SourceSystemSchema;

export type SourceSystem = WithLegacy<{
  code: string;
  label: string;
  [Type]: 'source-systems';
}>;
