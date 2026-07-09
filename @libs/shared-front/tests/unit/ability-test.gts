import { describe, expect } from 'vitest';
import { test } from 'ember-vitest';
import { initializeTestApp, TestApp } from '../app';

describe('Service | Ability | Unit', () => {
  // eslint-disable-next-line no-empty-pattern
  test.override({ app: ({}, use) => use(TestApp) });

  test('denies everything before any rules are loaded', async ({ context }) => {
    await initializeTestApp(context.owner, 'en-us');
    const service = context.owner.lookup('service:ability');

    expect(service.can('manage', 'User')).toBe(false);
  });

  test('load() grants access matching the provided rules', async ({
    context,
  }) => {
    await initializeTestApp(context.owner, 'en-us');
    const service = context.owner.lookup('service:ability');

    service.load([{ action: 'manage', subject: 'User' }]);

    expect(service.can('manage', 'User')).toBe(true);
    expect(service.can('manage', 'Role')).toBe(false);
  });

  test('reset() clears previously loaded rules', async ({ context }) => {
    await initializeTestApp(context.owner, 'en-us');
    const service = context.owner.lookup('service:ability');

    service.load([{ action: 'manage', subject: 'User' }]);
    expect(service.can('manage', 'User')).toBe(true);

    service.reset();

    expect(service.can('manage', 'User')).toBe(false);
  });

  test('an inverted rule with higher priority overrides a broader can rule', async ({
    context,
  }) => {
    await initializeTestApp(context.owner, 'en-us');
    const service = context.owner.lookup('service:ability');

    service.load([
      { action: 'manage', subject: 'AccessRecord' },
      { action: 'manage', subject: 'AccessRecord', inverted: true },
    ]);

    expect(service.can('manage', 'AccessRecord')).toBe(false);
  });
});
