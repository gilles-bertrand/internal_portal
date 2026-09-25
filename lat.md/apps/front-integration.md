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

## Domaines montés : chargés avant le menu

[[@apps/front/app/routes/dashboard.ts#DashboardIndexRoute]] attend `features.load()` dans son `beforeModel`, avant que le menu de `templates/dashboard.gts` ne se rende.

Résoudre après coup ferait apparaître puis disparaître des entrées sous le curseur. Le service ne rejette jamais — un échec réseau laisse tous les domaines actifs — donc cet `await` ne peut pas bloquer l'accès au tableau de bord. Contrat complet : [[shared-front#Domaines montés : lus du serveur, jamais redéclarés]].

## Un nouveau service ou une nouvelle route de lib exige un redémarrage de Vite

Embroider fusionne l'arbre `_app_` de chaque addon **une seule fois au démarrage de Vite**.

Ajouter un fichier qui s'y ré-exporte — un service, une route — pendant que `pnpm dev` tourne ne suffit donc pas : le HMR recharge bien le module, mais le conteneur Ember ne le connaît pas.

Le piège était documenté pour l'ajout d'une **lib** entière ; il vaut aussi pour un simple **fichier** dans une lib déjà branchée, parce que c'est le mapping `ember-addon.app-js` du `package.json` de la lib qui change, et il n'est lu qu'au démarrage.

Symptôme, constaté le 2026-09-21 : l'application ne démarre plus du tout.

```
Assertion Failed: Attempting to inject an unknown injection: 'service:features'
```

Une route injecte le service, le conteneur ne le résout pas, et le routeur meurt avant le premier rendu. Aucun message côté serveur.

**Ce qui rend le diagnostic trompeur** : `curl localhost:4200` répond `200`, `curl /api/v1/status` répond `200`, tous les comptes s'authentifient. Le serveur sert le shell HTML et l'API, tout va bien de ce côté — c'est le démarrage du client qui échoue. Une vérification par `curl` déclare donc « sain » une application entièrement morte. **Ouvrir le navigateur et lire la console est le seul contrôle valable pour ce type de panne.**

Diagnostic en trois vérifications avant d'incriminer le code : le mapping `app-js` du `package.json` de la lib contient-il l'entrée ; le fichier existe-t-il dans son `dist/_app_/` ; depuis quand tourne le serveur. Si les deux premières sont vraies, c'est la troisième qui est en cause — relancer `pnpm dev`.
