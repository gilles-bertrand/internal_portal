import type { TOC } from '@ember/component/template-only';

/**
 * Le template `dashboard` réel vient de l'app hôte (@apps/front), pas de
 * cette lib — indisponible dans le harnais de test isolé. Ce stub minimal
 * permet aux tests d'acceptance de suivre une redirection vers `dashboard`
 * (ex. garde de route non-tech_admin) sans erreur de template manquant.
 */
export default <template>{{outlet}}</template> as TOC<{
  Blocks: { default: [] };
}>
