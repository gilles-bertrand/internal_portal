import { boolean, enum as zEnum, object, preprocess, string } from 'zod';
import type z from 'zod';
import type { IntlService } from 'ember-intl';
import { ACCESS_TYPES } from '#src/utils/access-record-options.ts';

// @lat: [[frontend/forms#Stocker un Date, pas une string, pendant l'édition]]
// The changeset holds a Date while editing (see DraftAccessRecord); convert
// to ISO here so the validated/submitted payload stays a proper ISO string
// for the backend contract. Strings pass through unchanged.
const dateInputToIso = (value: unknown) =>
  value instanceof Date ? value.toISOString() : value;

export const createAccessRecordValidationSchema = (intl: IntlService) =>
  object({
    accessedAt: preprocess(
      dateInputToIso,
      string(
        intl.t(
          'access-records.forms.accessRecord.validation.accessedAtRequired'
        )
      ).min(
        1,
        intl.t(
          'access-records.forms.accessRecord.validation.accessedAtRequired'
        )
      )
    ),
    accessorRef: string(
      intl.t('access-records.forms.accessRecord.validation.accessorRefRequired')
    ).min(
      1,
      intl.t('access-records.forms.accessRecord.validation.accessorRefRequired')
    ),
    dataSubjectRef: string(
      intl.t(
        'access-records.forms.accessRecord.validation.dataSubjectRefRequired'
      )
    ).min(
      1,
      intl.t(
        'access-records.forms.accessRecord.validation.dataSubjectRefRequired'
      )
    ),
    dataCategories: string(
      intl.t(
        'access-records.forms.accessRecord.validation.dataCategoriesRequired'
      )
    ).min(
      1,
      intl.t(
        'access-records.forms.accessRecord.validation.dataCategoriesRequired'
      )
    ),
    accessType: zEnum(ACCESS_TYPES, {
      message: intl.t(
        'access-records.forms.accessRecord.validation.accessTypeInvalid'
      ),
    }),
    purpose: string(
      intl.t('access-records.forms.accessRecord.validation.purposeRequired')
    ).min(
      1,
      intl.t('access-records.forms.accessRecord.validation.purposeRequired')
    ),
    // legalBasis codes come from the /legal-bases referential, fetched at
    // runtime — the valid set isn't known when this schema is built, so we
    // only enforce non-empty here and trust the closed select for validity.
    legalBasis: string(
      intl.t('access-records.forms.accessRecord.validation.legalBasisRequired')
    ).min(
      1,
      intl.t('access-records.forms.accessRecord.validation.legalBasisRequired')
    ),
    sourceSystem: string(
      intl.t(
        'access-records.forms.accessRecord.validation.sourceSystemRequired'
      )
    ).min(
      1,
      intl.t(
        'access-records.forms.accessRecord.validation.sourceSystemRequired'
      )
    ),
    recipient: string().optional(),
    isSpecialCategory: boolean().optional(),
    justification: string(
      intl.t(
        'access-records.forms.accessRecord.validation.justificationRequired'
      )
    ).min(
      1,
      intl.t(
        'access-records.forms.accessRecord.validation.justificationRequired'
      )
    ),
    id: string().optional().nullable(),
  });

export type ValidatedAccessRecord = z.infer<
  ReturnType<typeof createAccessRecordValidationSchema>
>;
