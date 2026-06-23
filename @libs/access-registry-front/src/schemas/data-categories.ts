import {
  withDefaults,
  type WithLegacy,
} from '@warp-drive/legacy/model/migration-support';
import type { Type } from '@warp-drive/core/types/symbols';

const DataCategorySchema = withDefaults({
  type: 'data-categories',
  fields: [
    { name: 'code', kind: 'attribute' },
    { name: 'label', kind: 'attribute' },
  ],
});

export default DataCategorySchema;

export type DataCategory = WithLegacy<{
  code: string;
  label: string;
  [Type]: 'data-categories';
}>;
