import {
  withDefaults,
  type WithLegacy,
} from '@warp-drive/legacy/model/migration-support';
import type { Type } from '@warp-drive/core/types/symbols';

const AccessRecordSchema = withDefaults({
  type: 'access-records',
  fields: [
    { name: 'accessedAt', kind: 'attribute' },
    { name: 'encodedAt', kind: 'attribute' },
    { name: 'encodedBy', kind: 'attribute' },
    { name: 'accessorRef', kind: 'attribute' },
    { name: 'dataSubjectRef', kind: 'attribute' },
    { name: 'dataCategories', kind: 'attribute' },
    { name: 'isSpecialCategory', kind: 'attribute' },
    { name: 'accessType', kind: 'attribute' },
    { name: 'purpose', kind: 'attribute' },
    { name: 'legalBasis', kind: 'attribute' },
    { name: 'sourceSystem', kind: 'attribute' },
    { name: 'recipient', kind: 'attribute' },
    { name: 'justification', kind: 'attribute' },
    { name: 'retentionUntil', kind: 'attribute' },
    { name: 'seq', kind: 'attribute' },
    { name: 'prevHash', kind: 'attribute' },
    { name: 'hash', kind: 'attribute' },
  ],
});

export default AccessRecordSchema;

export type AccessRecord = WithLegacy<{
  accessedAt: string;
  encodedAt: string;
  encodedBy: string;
  accessorRef: string;
  dataSubjectRef: string;
  dataCategories: string[];
  isSpecialCategory: boolean;
  accessType: string;
  purpose: string;
  legalBasis: string;
  sourceSystem: string;
  recipient: string | null;
  justification: string;
  retentionUntil: string;
  seq: number;
  prevHash: string;
  hash: string;
  [Type]: 'access-records';
}>;
