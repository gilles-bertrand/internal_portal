import { object, string } from 'zod';
import type z from 'zod';
import type { IntlService } from 'ember-intl';

export const createRoleValidationSchema = (intl: IntlService) =>
  object({
    name: string(intl.t('permissions.forms.role.validation.nameRequired')).min(
      1,
      intl.t('permissions.forms.role.validation.nameRequired')
    ),
    description: string().optional().nullable(),
    id: string().optional().nullable(),
  });

export const editRoleValidationSchema = (intl: IntlService) =>
  object({
    name: string(intl.t('permissions.forms.role.validation.nameRequired')).min(
      1,
      intl.t('permissions.forms.role.validation.nameRequired')
    ),
    description: string().optional().nullable(),
    id: string(),
  });

export type CreatedRole = z.infer<
  ReturnType<typeof createRoleValidationSchema>
>;
export type UpdatedRole = z.infer<ReturnType<typeof editRoleValidationSchema>>;
