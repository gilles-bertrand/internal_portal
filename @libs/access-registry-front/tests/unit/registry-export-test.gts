import {
  type MockInstance,
  describe,
  expect,
  vi,
  beforeEach,
  afterEach,
} from 'vitest';
import { test } from 'ember-vitest';
import RegistryExportService from '#src/services/registry-export.ts';
import { initializeTestApp, TestApp } from '../app.ts';

// Mock session service — on évite d'instancier le vrai SessionService +
// AdaptiveStore qui a besoin d'un environnement complet.
vi.mock('ember-simple-auth/services/session', async () => {
  const { default: EmberService } = await import('@ember/service');
  return {
    default: class MockSessionService extends EmberService {
      isAuthenticated = true;
      data = {
        authenticated: {
          data: { accessToken: 'mock-token' },
        },
      };
    },
  };
});

describe('RegistryExportService', () => {
  // eslint-disable-next-line no-empty-pattern
  test.override({ app: ({}, use) => use(TestApp) });

  let fetchSpy: MockInstance<typeof globalThis.fetch>;
  let createObjectURLSpy: MockInstance<typeof URL.createObjectURL>;
  let revokeObjectURLSpy: MockInstance<typeof URL.revokeObjectURL>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    createObjectURLSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:mock-url');
    revokeObjectURLSpy = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
  });

  test('downloadReport declenche le telechargement du fichier PDF', async function ({
    context,
  }) {
    initializeTestApp(context.owner, 'fr-fr');

    const exportPayload = {
      data: {
        format: 'pdf',
        encoding: 'base64' as const,
        content: btoa('fake-pdf-content'),
        manifest: {
          generatedAt: '2026-06-23T10:00:00.000Z',
          generatedBy: 'user-1',
          count: 5,
          chainHeadHash: 'abc123',
          contentSha256: 'sha256-hash',
        },
        signature: 'sig-value',
      },
    };

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(exportPayload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const svc = context.owner.lookup(
      'service:registry-export'
    ) as RegistryExportService;

    // Spy on the real anchor element's click method
    const realCreateElement = document.createElement.bind(document);
    let capturedAnchor: HTMLAnchorElement | null = null;
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreateElement(tag);
      if (tag === 'a') {
        capturedAnchor = el as HTMLAnchorElement;
        vi.spyOn(capturedAnchor, 'click').mockImplementation(() => {});
      }
      return el;
    });

    await svc.downloadReport('pdf');

    // Verify fetch was called with the right endpoint
    expect(fetchSpy).toHaveBeenCalledOnce();
    const fetchArgs = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(fetchArgs[0]).toBe('/api/v1/access-records/export');
    expect(JSON.parse(fetchArgs[1].body as string)).toEqual({
      format: 'pdf',
    });

    // Verify download was triggered
    expect(capturedAnchor).not.toBeNull();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(capturedAnchor!.click).toHaveBeenCalledOnce();
    expect(createObjectURLSpy).toHaveBeenCalledOnce();
    expect(revokeObjectURLSpy).toHaveBeenCalledOnce();
  });

  test('downloadReport throw si la requete echoue', async function ({
    context,
  }) {
    initializeTestApp(context.owner, 'fr-fr');

    fetchSpy.mockResolvedValueOnce(new Response('Forbidden', { status: 403 }));

    const svc = context.owner.lookup(
      'service:registry-export'
    ) as RegistryExportService;

    await expect(svc.downloadReport('pdf')).rejects.toThrow(
      'Export request failed with status 403'
    );
  });
});
