import { boolean, object, string } from 'zod';
import type z from 'zod';
import type { IntlService } from 'ember-intl';

const ACCESS_TYPES = ['consultation', 'modification', 'export', 'transmission'];

export const createAccessRecordValidationSchema = (intl: IntlService) =>
  object({
    accessedAt: string(
      intl.t('access-records.forms.accessRecord.validation.accessedAtRequired')
    ).min(
      1,
      intl.t('access-records.forms.accessRecord.validation.accessedAtRequired')
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
    accessType: string(
      intl.t('access-records.forms.accessRecord.validation.accessTypeRequired')
    ).refine((v) => ACCESS_TYPES.includes(v), {
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
