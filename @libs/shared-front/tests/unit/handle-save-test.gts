/* eslint-disable @typescript-eslint/unbound-method */
import { describe, expect, vi } from 'vitest';
import { test } from 'ember-vitest';
import { initializeTestApp, TestApp } from '../app';
import { stubRouter } from '../utils';

describe('Service | HandleSave | Unit', () => {
  // eslint-disable-next-line no-empty-pattern
  test.override({ app: ({}, use) => use(TestApp) });

  test('calls saveAction and shows success flash message', async ({
    context,
  }) => {
    await initializeTestApp(context.owner, 'en-us');
    const service = context.owner.lookup('service:handle-save');

    const successSpy = vi.spyOn(service.flashMessages, 'success');
    const saveAction = vi.fn().mockResolvedValue(undefined);

    await service.handleSave({
      saveAction,
      successMessage: 'Saved successfully',
    });

    expect(saveAction).toHaveBeenCalledOnce();
    expect(successSpy).toHaveBeenCalledWith('Saved successfully');
  });

  test('transitions on success', async ({ context }) => {
    await initializeTestApp(context.owner, 'en-us');
    const service = context.owner.lookup('service:handle-save');

    const router = stubRouter(context.owner);
    const saveAction = vi.fn().mockResolvedValue(undefined);

    await service.handleSave({
      saveAction,
      transitionOnSuccess: 'dashboard.users',
    });

    expect(router.transitionTo).toHaveBeenCalledWith('dashboard.users');
  });

  test('transitions on success with id', async ({ context }) => {
    await initializeTestApp(context.owner, 'en-us');
    const service = context.owner.lookup('service:handle-save');

    const router = stubRouter(context.owner);
    const saveAction = vi.fn().mockResolvedValue(undefined);

    await service.handleSave({
      saveAction,
      transitionOnSuccess: 'dashboard.users',
      idForTransitionOnSuccess: '123',
    });

    expect(router.transitionTo).toHaveBeenCalledWith('dashboard.users', '123');
  });

  test('no flash or transition when options not provided', async ({
    context,
  }) => {
    await initializeTestApp(context.owner, 'en-us');
    const service = context.owner.lookup('service:handle-save');

    const router = stubRouter(context.owner);
    const successSpy = vi.spyOn(service.flashMessages, 'success');
    const dangerSpy = vi.spyOn(service.flashMessages, 'danger');
    const saveAction = vi.fn().mockResolvedValue(undefined);

    await service.handleSave({ saveAction });

    expect(saveAction).toHaveBeenCalledOnce();
    expect(successSpy).not.toHaveBeenCalled();
    expect(dangerSpy).not.toHaveBeenCalled();
    expect(router.transitionTo).not.toHaveBeenCalled();
  });

  test('field error (400 with pointer): adds to changeset, no danger flash', async ({
    context,
  }) => {
    await initializeTestApp(context.owner, 'en-us');
    const service = context.owner.lookup('service:handle-save');

    const dangerSpy = vi.spyOn(service.flashMessages, 'danger');
    const changeset = { addError: vi.fn() };
    const saveAction = vi.fn().mockRejectedValue(
      new AggregateError([
        {
          status: '400',
          source: { pointer: '/data/attributes/email' },
          detail: 'is invalid',
        },
      ])
    );

    await service.handleSave({
      saveAction,
      changeset: changeset as never,
    });

    expect(changeset.addError).toHaveBeenCalledWith({
      key: 'email',
      message: 'is invalid',
      value: undefined,
      originalValue: undefined,
    });
    expect(dangerSpy).not.toHaveBeenCalled();
  });

  test('strips a legacy double-slash //data/attributes/ prefix from pointer', async ({
    context,
  }) => {
    await initializeTestApp(context.owner, 'en-us');
    const service = context.owner.lookup('service:handle-save');

    const changeset = { addError: vi.fn() };
    const saveAction = vi.fn().mockRejectedValue(
      new AggregateError([
        {
          source: { pointer: '//data/attributes/email' },
          detail: 'is invalid',
        },
      ])
    );

    await service.handleSave({
      saveAction,
      changeset: changeset as never,
    });

    expect(changeset.addError).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'email' })
    );
  });

  test('multiple field errors are all added to changeset', async ({
    context,
  }) => {
    await initializeTestApp(context.owner, 'en-us');
    const service = context.owner.lookup('service:handle-save');

    const changeset = { addError: vi.fn() };
    const saveAction = vi.fn().mockRejectedValue(
      new AggregateError([
        {
          source: { pointer: '/data/attributes/first-name' },
          detail: 'is required',
        },
        {
          source: { pointer: '/data/attributes/email' },
          detail: 'is invalid',
        },
        {
          source: { pointer: '/data/attributes/age' },
          detail: 'must be a number',
        },
      ])
    );

    await service.handleSave({
      saveAction,
      changeset: changeset as never,
    });

    expect(changeset.addError).toHaveBeenCalledTimes(3);
    expect(changeset.addError).toHaveBeenCalledWith({
      key: 'first-name',
      message: 'is required',
      value: undefined,
      originalValue: undefined,
    });
    expect(changeset.addError).toHaveBeenCalledWith({
      key: 'email',
      message: 'is invalid',
      value: undefined,
      originalValue: undefined,
    });
    expect(changeset.addError).toHaveBeenCalledWith({
      key: 'age',
      message: 'must be a number',
      value: undefined,
      originalValue: undefined,
    });
  });

  test('global error without source (403 FORBIDDEN): resolves via the code-based key, no changeset error, no throw', async ({
    context,
  }) => {
    await initializeTestApp(context.owner, 'en-us');
    const service = context.owner.lookup('service:handle-save');

    // The test app doesn't load @apps/front's real translations (see
    // tests/app.ts: setOnMissingTranslation), so `intl.exists()` never
    // matches a real key here — mock it to exercise the code>status>detail
    // priority chain, like the existing tests in this file already do.
    vi.spyOn(service.intl, 'exists').mockImplementation(
      (key: string) => key === 'shared.handle-save.errors.FORBIDDEN'
    );
    const tSpy = vi.spyOn(service.intl, 't').mockReturnValue('No permission');
    const dangerSpy = vi.spyOn(service.flashMessages, 'danger');
    const changeset = { addError: vi.fn() };
    const saveAction = vi.fn().mockRejectedValue(
      new AggregateError([
        {
          status: '403',
          code: 'FORBIDDEN',
          detail: 'Insufficient permission',
        },
      ])
    );

    await expect(
      service.handleSave({ saveAction, changeset: changeset as never })
    ).resolves.toBeUndefined();

    expect(changeset.addError).not.toHaveBeenCalled();
    expect(tSpy).toHaveBeenCalledWith('shared.handle-save.errors.FORBIDDEN');
    expect(dangerSpy).toHaveBeenCalledWith('No permission');
  });

  test('global error by status (409, no code mapped): resolves via the status-based key', async ({
    context,
  }) => {
    await initializeTestApp(context.owner, 'en-us');
    const service = context.owner.lookup('service:handle-save');

    vi.spyOn(service.intl, 'exists').mockImplementation(
      (key: string) => key === 'shared.handle-save.status.409'
    );
    const tSpy = vi.spyOn(service.intl, 't').mockReturnValue('Conflict');
    const dangerSpy = vi.spyOn(service.flashMessages, 'danger');
    const saveAction = vi
      .fn()
      .mockRejectedValue(
        new AggregateError([{ status: '409', detail: 'Role still assigned' }])
      );

    await service.handleSave({ saveAction });

    expect(tSpy).toHaveBeenCalledWith('shared.handle-save.status.409');
    expect(dangerSpy).toHaveBeenCalledWith('Conflict');
  });

  test('falls back to detail when neither code nor status have a translation', async ({
    context,
  }) => {
    await initializeTestApp(context.owner, 'en-us');
    const service = context.owner.lookup('service:handle-save');

    const dangerSpy = vi.spyOn(service.flashMessages, 'danger');
    const saveAction = vi
      .fn()
      .mockRejectedValue(
        new AggregateError([
          { status: '418', code: 'TEAPOT', detail: 'I am a teapot' },
        ])
      );

    await service.handleSave({ saveAction });

    expect(dangerSpy).toHaveBeenCalledWith('I am a teapot');
  });

  test('falls back to the generic message when nothing else is available', async ({
    context,
  }) => {
    await initializeTestApp(context.owner, 'en-us');
    const service = context.owner.lookup('service:handle-save');

    vi.spyOn(service.intl, 'exists').mockReturnValue(false);
    const tSpy = vi.spyOn(service.intl, 't').mockReturnValue('Generic error');
    const dangerSpy = vi.spyOn(service.flashMessages, 'danger');
    const saveAction = vi.fn().mockRejectedValue(new AggregateError([{}]));

    await service.handleSave({ saveAction });

    expect(tSpy).toHaveBeenCalledWith(
      'shared.handle-save.generic-error-message'
    );
    expect(dangerSpy).toHaveBeenCalledWith('Generic error');
  });

  test('does not leak raw detail for unmapped 5xx errors', async ({
    context,
  }) => {
    await initializeTestApp(context.owner, 'en-us');
    const service = context.owner.lookup('service:handle-save');

    vi.spyOn(service.intl, 'exists').mockReturnValue(false);
    const tSpy = vi.spyOn(service.intl, 't').mockReturnValue('Generic error');
    const dangerSpy = vi.spyOn(service.flashMessages, 'danger');
    const saveAction = vi
      .fn()
      .mockRejectedValue(
        new AggregateError([{ status: '599', detail: 'raw stack trace' }])
      );

    await service.handleSave({ saveAction });

    expect(tSpy).toHaveBeenCalledWith(
      'shared.handle-save.generic-error-message'
    );
    expect(dangerSpy).toHaveBeenCalledWith('Generic error');
    expect(dangerSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('raw stack trace')
    );
  });

  test('mixed field and global errors: adds the field error to the changeset and flashes the global one', async ({
    context,
  }) => {
    await initializeTestApp(context.owner, 'en-us');
    const service = context.owner.lookup('service:handle-save');

    vi.spyOn(service.intl, 'exists').mockImplementation(
      (key: string) => key === 'shared.handle-save.errors.FORBIDDEN'
    );
    vi.spyOn(service.intl, 't').mockReturnValue('No permission');
    const dangerSpy = vi.spyOn(service.flashMessages, 'danger');
    const changeset = { addError: vi.fn() };
    const saveAction = vi.fn().mockRejectedValue(
      new AggregateError([
        {
          source: { pointer: '/data/attributes/email' },
          detail: 'is invalid',
        },
        {
          status: '403',
          code: 'FORBIDDEN',
          detail: 'Insufficient permission',
        },
      ])
    );

    await service.handleSave({ saveAction, changeset: changeset as never });

    expect(changeset.addError).toHaveBeenCalledWith({
      key: 'email',
      message: 'is invalid',
      value: undefined,
      originalValue: undefined,
    });
    expect(dangerSpy).toHaveBeenCalledTimes(1);
    expect(dangerSpy).toHaveBeenCalledWith('No permission');
  });

  test('5xx errors flash a danger message and report for monitoring', async ({
    context,
  }) => {
    await initializeTestApp(context.owner, 'en-us');
    const service = context.owner.lookup('service:handle-save');

    vi.spyOn(service.intl, 'exists').mockImplementation(
      (key: string) => key === 'shared.handle-save.status.500'
    );
    vi.spyOn(service.intl, 't').mockReturnValue('Server error');
    const dangerSpy = vi.spyOn(service.flashMessages, 'danger');
    const reportSpy = vi.spyOn(service.errorReporter, 'report');
    const saveAction = vi
      .fn()
      .mockRejectedValue(
        new AggregateError([
          { status: '500', detail: 'Internal server stack trace leak' },
        ])
      );

    await service.handleSave({ saveAction });

    expect(dangerSpy).toHaveBeenCalledWith('Server error');
    expect(reportSpy).toHaveBeenCalledOnce();
  });

  test('without a changeset, every AggregateError entry is flashed (even field-shaped ones)', async ({
    context,
  }) => {
    await initializeTestApp(context.owner, 'en-us');
    const service = context.owner.lookup('service:handle-save');

    vi.spyOn(service.intl, 'exists').mockImplementation(
      (key: string) => key === 'shared.handle-save.errors.FORBIDDEN'
    );
    vi.spyOn(service.intl, 't').mockReturnValue('No permission');
    const dangerSpy = vi.spyOn(service.flashMessages, 'danger');
    const saveAction = vi.fn().mockRejectedValue(
      new AggregateError([
        {
          source: { pointer: '/data/attributes/name' },
          detail: 'is required',
        },
        {
          status: '403',
          code: 'FORBIDDEN',
          detail: 'Insufficient permission',
        },
      ])
    );

    await service.handleSave({ saveAction });

    expect(dangerSpy).toHaveBeenCalledTimes(2);
    expect(dangerSpy).toHaveBeenCalledWith('is required');
    expect(dangerSpy).toHaveBeenCalledWith('No permission');
  });

  test('transitions on error when transitionOnError is set', async ({
    context,
  }) => {
    await initializeTestApp(context.owner, 'en-us');
    const service = context.owner.lookup('service:handle-save');

    const router = stubRouter(context.owner);
    const saveAction = vi.fn().mockRejectedValue(
      new AggregateError([
        {
          source: { pointer: '/data/attributes/name' },
          detail: 'is required',
        },
      ])
    );

    await service.handleSave({
      saveAction,
      changeset: { addError: vi.fn() } as never,
      transitionOnError: 'dashboard',
    });

    expect(router.transitionTo).toHaveBeenCalledWith('dashboard');
  });

  test('non-AggregateError shows a generic danger flash and reports for monitoring', async ({
    context,
  }) => {
    await initializeTestApp(context.owner, 'en-us');
    const service = context.owner.lookup('service:handle-save');

    const router = stubRouter(context.owner);
    const changeset = { addError: vi.fn() };
    vi.spyOn(service.intl, 'exists').mockReturnValue(false);
    const tSpy = vi.spyOn(service.intl, 't').mockReturnValue('Generic error');
    const dangerSpy = vi.spyOn(service.flashMessages, 'danger');
    const reportSpy = vi.spyOn(service.errorReporter, 'report');
    const saveAction = vi.fn().mockRejectedValue(new Error('Network error'));

    await service.handleSave({
      saveAction,
      changeset: changeset as never,
      transitionOnError: 'dashboard',
    });

    expect(changeset.addError).not.toHaveBeenCalled();
    expect(tSpy).toHaveBeenCalledWith(
      'shared.handle-save.generic-error-message'
    );
    expect(dangerSpy).toHaveBeenCalledWith('Generic error');
    expect(reportSpy).toHaveBeenCalledOnce();
    expect(router.transitionTo).toHaveBeenCalledWith('dashboard');
  });
});
