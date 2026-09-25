import EmberRouter from '@embroider/router';
import config from '@apps/front/config/environment';
import { forRouter as userLibRouter, authRoutes } from '@libs/users-front';
import { forRouter as todosLibRouter } from '@libs/todos-front';
import { forRouter as accessRegistryLibRouter } from '@libs/access-registry-front';
import { forRouter as incidentRegistryLibRouter } from '@libs/incident-registry-front';
import { forRouter as permissionsLibRouter } from '@libs/permissions-front';

// @lat: [[apps/front-integration]]
export default class Router extends EmberRouter {
  location = config.locationType;
  rootURL = config.rootURL;
}

Router.map(function () {
  this.route('dashboard', { path: '/' }, function () {
    userLibRouter.call(this);
    todosLibRouter.call(this);
    accessRegistryLibRouter.call(this);
    incidentRegistryLibRouter.call(this);
    permissionsLibRouter.call(this);
  });
  authRoutes.call(this);
});
