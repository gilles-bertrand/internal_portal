import ImmerChangeset from 'ember-immer-changeset';

export interface DraftAccessRecord {
  id?: string | null;
  accessedAt?: string;
  accessorRef?: string;
  dataSubjectRef?: string;
  dataCategories?: string;
  isSpecialCategory?: boolean;
  accessType?: string;
  purpose?: string;
  legalBasis?: string;
  sourceSystem?: string;
  recipient?: string;
  justification?: string;
}

export class AccessRecordChangeset extends ImmerChangeset<DraftAccessRecord> {}
