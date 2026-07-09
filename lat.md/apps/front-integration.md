# Intégration des libs *-front dans l'app hôte

L'app Ember hôte (`@apps/front`) ne découvre pas les libs métier automatiquement : chaque lib `*-front` doit être raccordée manuellement à plusieurs endroits précis, sous peine de routes/mocks/styles orphelins.

Pas d'engines Ember : les libs `*-front` sont de simples addons v2 qui exposent leurs routes via `forRouter`/`authRoutes`, appelées dans [[@apps/front/app/router.ts#Router]]. Checklist de branchement complète (vérifiée en pratique en branchant `incident-registry-front`, qui manquait aux 5 points) :

1. **`package.json`** — ajouter la lib en `devDependency` (`"@libs/<lib>-front": "workspace:^"`) puis `pnpm install` pour créer le symlink dans `node_modules`. Sans ça, Vite échoue avec `Failed to resolve import "@libs/<lib>-front"` — ce point n'était pas dans la checklist d'origine (découvert seulement en essayant réellement de démarrer `pnpm dev`, une simple lecture de code ne l'aurait pas révélé).
2. **`app/router.ts`** — appeler `forRouter.call(this)` de la lib dans le bloc `dashboard`.
3. **[[@apps/front/app/routes/application.ts#ApplicationRoute]]** — appeler `initialize<Lib>(getOwner(this))` en `beforeModel` et ajouter les handlers MSW de la lib à `setupWorker(...)`.
4. **`app/styles/app.css`** — ajouter une directive Tailwind `@source` pour que les classes de la lib soient scannées.
5. **`app/templates/dashboard.gts`** — ajouter une entrée dans `menuItems` (+ clé `dashboard.sidebar.<lib>` dans les traductions FR/EN) pour rendre la route accessible depuis la sidebar.

Une fois ces 5 points faits, un piège supplémentaire et systématique attend toute nouvelle ressource warp-drive consommée par la lib : **le schéma doit aussi être enregistré dans `@apps/front/app/services/store.ts`**, sinon `Missing Resource Type` — voir [[access-record-options#Enregistrement obligatoire des schémas warp-drive]] (déjà rencontré 4 fois : `purposes`, `legal-bases`, `data-categories`, et de nouveau pour `incidents`). Symétriquement côté backend, le module `*-backend` doit être instancié dans `app.ts` et enregistré dans `app.router.ts` — voir [[backend-bootstrap#Assemblage incident-registry (module désormais branché)]].

`incident-registry-front`/`incident-registry-backend` ont été intégralement branchés (les 5 points front + le module backend + `IncidentSchema` dans le store) — cas traité comme référence pour le prochain module à brancher.

Traductions agrégées à la build via `ember-intl` + modules virtuels Vite, chargées dans `ApplicationRoute.beforeModel()`. `app/styles/icons.css` comble l'absence de police d'icônes pour `tempus-dominus` (datepicker) et `ember-power-select` (chevron) — décision documentée en commentaire dans le fichier lui-même.
