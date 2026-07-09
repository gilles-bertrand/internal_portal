import Service, { service } from '@ember/service';
import type FlashMessageService from 'ember-cli-flash/services/flash-messages';
import type IntlService from 'ember-intl/services/intl';
import type RouterService from '@ember/routing/router-service';
import type { ImmerChangeset } from 'ember-immer-changeset';
import type ErrorReporterService from './error-reporter';
import {
  genericJsonApiErrorMessage,
  resolveJsonApiErrorMessage,
  type JsonApiError,
} from '../utils/json-api-error-message.ts';

interface HandleSaveOptions<T> {
  saveAction: () => Promise<T>;
  changeset?: ImmerChangeset;
  successMessage?: string;
  transitionOnSuccess?: string;
  transitionOnError?: string;
  idForTransitionOnSuccess?: string | string[];
}

const FIELD_POINTER_RE = /\/data\/attributes\//;

function isFieldError(e: JsonApiError): boolean {
  return (
    typeof e.source?.pointer === 'string' &&
    FIELD_POINTER_RE.test(e.source.pointer)
  );
}

// @lat: [[frontend/shared-front]]
export default class HandleSaveService extends Service {
  @service declare flashMessages: FlashMessageService;
  @service declare intl: IntlService;
  @service declare router: RouterService;
  @service declare errorReporter: ErrorReporterService;

  public async handleSave<T>({
    saveAction,
    successMessage,
    transitionOnError,
    transitionOnSuccess,
    idForTransitionOnSuccess,
    changeset,
  }: HandleSaveOptions<T>) {
    try {
      await saveAction();
      if (successMessage) {
        this.flashMessages.success(
          this.intl.exists(successMessage)
            ? this.intl.t(successMessage)
            : successMessage
        );
      }
      if (transitionOnSuccess)
        if (idForTransitionOnSuccess) {
          await this.router.transitionTo(
            transitionOnSuccess,
            ...(Array.isArray(idForTransitionOnSuccess)
              ? idForTransitionOnSuccess
              : [idForTransitionOnSuccess])
          );
        } else {
          await this.router.transitionTo(transitionOnSuccess);
        }
    } catch (error) {
      let handled = false;

      if (error instanceof AggregateError) {
        this.handleAggregateError(error, changeset);
        handled = true;
      }

      if (!handled) {
        // Non-AggregateError: network failure, non-JSON body, etc. — no
        // structured JSON:API errors to classify, so surface a generic flash
        // in addition to reporting for monitoring.
        this.errorReporter.report(error);
        this.flashMessages.danger(genericJsonApiErrorMessage(this.intl));
      }

      if (transitionOnError) {
        await this.router.transitionTo(transitionOnError);
      }
    }
  }

  private handleAggregateError(
    error: AggregateError,
    changeset?: ImmerChangeset
  ) {
    const errors = (error.errors ?? []) as JsonApiError[];
    const fieldErrors = errors.filter(isFieldError);
    const globalErrors = errors.filter((e) => !isFieldError(e));

    if (changeset && fieldErrors.length) {
      this.addErrorsToChangeset(fieldErrors, changeset);
    }

    // Without a changeset there is no field to attach a field error to, so
    // every error — field or global — is flashed instead.
    const toFlash = changeset ? globalErrors : errors;
    for (const e of toFlash) {
      this.flashMessages.danger(resolveJsonApiErrorMessage(e, this.intl));
    }

    if (!fieldErrors.length && !toFlash.length) {
      this.flashMessages.danger(genericJsonApiErrorMessage(this.intl));
    }

    if (globalErrors.some((e) => (e.status ?? '').startsWith('5'))) {
      this.errorReporter.report(error);
    }
  }

  private addErrorsToChangeset(
    fieldErrors: JsonApiError[],
    changeset: ImmerChangeset
  ) {
    for (const e of fieldErrors) {
      changeset.addError({
        message: e.detail ?? genericJsonApiErrorMessage(this.intl),
        key: e
          .source!.pointer!.replace(FIELD_POINTER_RE, '')
          .replace(/^\/+/, ''),
        value: undefined,
        originalValue: undefined,
      });
    }
  }
}

// DO NOT DELETE: this is how TypeScript knows how to look up your services.
declare module '@ember/service' {
  interface Registry {
    'handle-save': HandleSaveService;
  }
}
