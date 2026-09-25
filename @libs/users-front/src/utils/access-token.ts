import type SessionService from 'ember-simple-auth/services/session';

export function getAccessToken(session: SessionService): string | undefined {
  const authData = session.data.authenticated as Record<string, unknown>;
  return (authData?.['data'] as Record<string, unknown>)?.['accessToken'] as
    | string
    | undefined;
}
