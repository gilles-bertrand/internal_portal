import ImmerChangeset from 'ember-immer-changeset';
import type { AccessType } from '#src/utils/access-record-options.ts';

export interface DraftAccessRecord {
  id?: string | null;
  // @lat: [[frontend/forms#Stocker un Date, pas une string, pendant l'édition]]
  // Declared as string (TpkForm ties @changeset's type to z.infer of the
  // validation schema — it must structurally match), but the setter in
  // access-record-form.gts actually stores a runtime Date, cast through this
  // type. access-record-validation.ts converts it back to ISO at validation.
  accessedAt?: string | null;
  accessorRef?: string;
  dataSubjectRef?: string;
  // @lat: [[frontend/access-record-options#Contrat dataCategories en CSV]]
  // CSV string of DataCategory codes (AccessRecordService splits it back into
  // the array the backend expects).
  dataCategories?: string;
  isSpecialCategory?: boolean;
  accessType?: AccessType;
  purpose?: string;
  // @lat: [[frontend/access-record-options#Référentiels dynamiques vs enum statique]]
  // legalBasis is a code from the /legal-bases referential (dynamic, not a
  // closed frontend union).
  legalBasis?: string;
  sourceSystem?: string;
  recipient?: string;
  justification?: string;
}

export class AccessRecordChangeset extends ImmerChangeset<DraftAccessRecord> {}
