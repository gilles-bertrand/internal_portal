# repo-utils — configuration outillage partagée

`@libs/repo-utils` n'est pas une lib runtime — c'est un paquet de configuration pur (tsconfig, oxlint, babel/rollup pour addons Ember), étendu par toutes les libs du monorepo, front et back confondues.

Trois familles de config : `configs/backend-lib/tsconfig.base.json` (étendu par toutes les libs backend, strict, decorators MikroORM) ; `configs/oxlintrc.json` (règles de taille — `max-lines: 200`, `max-lines-per-function: 50` — assouplies via overrides pour `*.route.ts` et les tests) ; `configs/addon/*` (babel/rollup pour les addons Ember front).

`moveRouteTemplatesPlugin` (`@libs/repo-utils/configs/addon/mapper-plugin.mjs`) déplace les templates de route compilés de `routes/**/*-template.js` vers `templates/**/*.js` — nécessaire car Ember colocation génère les templates sous `routes/` mais le runtime Ember classique les attend sous `templates/`. Centraliser cette config évite que les ~10 libs dupliquent leur tsconfig/oxlint/babel et garantit que toute nouvelle lib hérite automatiquement des mêmes règles de complexité/taille.
