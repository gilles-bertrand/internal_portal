import type IntlService from 'ember-intl/services/intl';

export interface JsonApiError {
  status?: string;
  code?: string;
  detail?: string;
  source?: { pointer?: string };
}

export function genericJsonApiErrorMessage(intl: IntlService): string {
  return intl.t('shared.handle-save.generic-error-message');
}

// Same code>status>detail>generic priority used by HandleSaveService, shared
// with call sites outside the save/changeset flow (e.g. login) that still
// receive a JSON:API error document from the backend.
export function resolveJsonApiErrorMessage(
  e: JsonApiError,
  intl: IntlService
): string {
  const byCode = e.code && `shared.handle-save.errors.${e.code}`;
  if (byCode && intl.exists(byCode)) return intl.t(byCode);

  const byStatus = e.status && `shared.handle-save.status.${e.status}`;
  if (byStatus && intl.exists(byStatus)) return intl.t(byStatus);

  // 5xx `detail` is server-internal text, not meant for end users — force
  // the generic message rather than leaking it.
  const isServerError = (e.status ?? '').startsWith('5');
  if (e.detail && !isServerError) return e.detail;
  return genericJsonApiErrorMessage(intl);
}
