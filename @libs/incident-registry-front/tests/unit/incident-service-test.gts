import { describe, expect as hardExpect, vi } from 'vitest';
import { renderingTest } from 'ember-vitest';
import { initializeTestApp, TestApp } from '../app.ts';
import type { Store } from '@warp-drive/core';
import type IncidentService from '#src/services/incident.ts';
import type { ValidatedIncident } from '#src/components/forms/incident-validation.ts';

const expect = hardExpect.soft;

// Attributs de contenu minimaux — le service ne valide pas, il sérialise.
const SAMPLE = {
  clientCode: 'IPBW',
  clientName: 'IPBW SA',
  applicationName: 'Portail',
  version: '1.0',
  timelineEvents: [{ date: '2026-02-19', time: '08:00', event: 'Début' }],
} as unknown as ValidatedIncident;

type CapturedRequest = { url?: string; method?: string; body?: string };

describe('incident service (contrat backend)', function () {
  // eslint-disable-next-line no-empty-pattern
  renderingTest.override({ app: ({}, use) => use(TestApp) });

  renderingTest(
    'update() envoie un PUT /incidents/:id avec les attributs de contenu',
    async function ({ context }) {
      initializeTestApp(context.owner, 'fr-fr');
      const store = context.owner.lookup('service:store') as Store;
      const spy = vi.spyOn(store, 'request').mockResolvedValue({} as never);
      const incident = context.owner.lookup(
        'service:incident'
      ) as IncidentService;

      await incident.update('inc-1', SAMPLE);

      const req = spy.mock.calls[0]?.[0] as CapturedRequest;
      expect(req.method).toBe('PUT');
      expect(req.url).toBe('/api/v1/incidents/inc-1');
      const body = JSON.parse(req.body ?? '{}') as {
        data: {
          type: string;
          id: string;
          attributes: Record<string, unknown>;
        };
      };
      expect(body.data.type).toBe('incidents');
      expect(body.data.id).toBe('inc-1');
      expect(body.data.attributes['clientCode']).toBe('IPBW');
    }
  );

  renderingTest(
    'softDelete() envoie un DELETE /incidents/:id',
    async function ({ context }) {
      initializeTestApp(context.owner, 'fr-fr');
      const store = context.owner.lookup('service:store') as Store;
      const spy = vi.spyOn(store, 'request').mockResolvedValue({} as never);
      const incident = context.owner.lookup(
        'service:incident'
      ) as IncidentService;

      await incident.softDelete('inc-1');

      const req = spy.mock.calls[0]?.[0] as CapturedRequest;
      expect(req.method).toBe('DELETE');
      expect(req.url).toBe('/api/v1/incidents/inc-1');
    }
  );

  renderingTest(
    'restore() envoie un POST /incidents/:id/restore',
    async function ({ context }) {
      initializeTestApp(context.owner, 'fr-fr');
      const store = context.owner.lookup('service:store') as Store;
      const spy = vi.spyOn(store, 'request').mockResolvedValue({} as never);
      const incident = context.owner.lookup(
        'service:incident'
      ) as IncidentService;

      await incident.restore('inc-1');

      const req = spy.mock.calls[0]?.[0] as CapturedRequest;
      expect(req.method).toBe('POST');
      expect(req.url).toBe('/api/v1/incidents/inc-1/restore');
    }
  );
});
