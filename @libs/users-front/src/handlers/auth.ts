import { service } from '@ember/service';
import type { NextFn } from '@warp-drive/core/request';
import type { RequestContext } from '@warp-drive/core/types/request';
import type SessionService from 'ember-simple-auth/services/session';
import { getAccessToken } from '#src/utils/access-token.ts';

export default class AuthHandler {
  @service declare session: SessionService;

  request<T>(context: RequestContext, next: NextFn<T>) {
    const headers = new Headers(context.request.headers);

    headers.append('Content-Type', 'application/json');

    const accessToken = getAccessToken(this.session);

    headers.append('Authorization', accessToken ? `Bearer ${accessToken}` : '');
    return next(Object.assign({}, context.request, { headers }));
  }
}
