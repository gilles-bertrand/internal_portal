import Route from '@ember/routing/route';

export type AccessRecordsCreateRouteSignature = {
  model: Awaited<ReturnType<AccessRecordsCreateRoute['model']>>;
  controller: undefined;
};

export default class AccessRecordsCreateRoute extends Route {}
