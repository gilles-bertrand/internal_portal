import {
  withDefaults,
  type WithLegacy,
} from '@warp-drive/legacy/model/migration-support';
import type { Type } from '@warp-drive/core/types/symbols';

const LegalBasisSchema = withDefaults({
  type: 'legal-bases',
  fields: [
    { name: 'code', kind: 'attribute' },
    { name: 'label', kind: 'attribute' },
    { name: 'isArticle9', kind: 'attribute' },
  ],
});

export default LegalBasisSchema;

export type LegalBasis = WithLegacy<{
  code: string;
  label: string;
  isArticle9: boolean;
  [Type]: 'legal-bases';
}>;
