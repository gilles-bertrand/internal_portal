import setupDeprecationWorkflow from 'ember-cli-deprecation-workflow';
import { registerWarnHandler } from '@ember/debug';

/**
 * Docs: https://github.com/ember-cli/ember-cli-deprecation-workflow
 */
setupDeprecationWorkflow({
  /**
    false by default, but if a developer / team wants to be more aggressive about being proactive with
    handling their deprecations, this should be set to "true"
  */
  throwOnUnhandled: false,
  workflow: [
    /* to generate this list, run your app for a while (or run the test suite),
     * and then run in the browser console:
     *
     *    deprecationWorkflow.flushDeprecations()
     *
     * And copy the handlers here
     */
  ],
});

/**
 * @triptyk/ember-ui (tpk-actions-menu, tpk-table-generic-prefab) lie des styles
 * `anchor-name`/`position-anchor` dynamiquement pour le CSS anchor positioning.
 * Ember émet le warning `ember-htmlbars.style-xss-warning` (canal warn, distinct
 * des deprecations) pour toute liaison de style. Les valeurs sont des identifiants
 * `--anchor-{{index}}` sûrs et notre propre code ne lie aucun style dynamique.
 */
registerWarnHandler((message, options, next) => {
  if (options?.id === 'ember-htmlbars.style-xss-warning') {
    return;
  }
  next(message, options);
});
