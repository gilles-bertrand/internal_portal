# Afficher à l'utilisateur les erreurs backend non liées à un champ

## Problème

Certaines erreurs renvoyées par le backend **ne sont jamais affichées à l'utilisateur** : elles sont soit avalées silencieusement, soit poussées dans un champ de formulaire inexistant, soit uniquement loguées en `console.error`. L'utilisateur voit l'opération « échouer sans rien dire ».

### Chaîne de cause racine (vérifiée dans le code)

1. **Backend** — toutes les routes renvoient l'enveloppe JSON:API `{ errors: [{ status, title, code?, detail?, source? }] }` via [[@libs/backend-shared/src/serialization/json-api.ts#makeJsonApiError]] et [[@libs/backend-shared/src/error-handler.ts#handleJsonApiErrors]].
   - **Erreurs de validation (400)** : portent un `source.pointer` type `/data/attributes/<champ>` (générées par `handleJsonApiErrors` depuis Zod).
   - **Erreurs non liées à un champ (401, 403, 404, 409, 500)** : `source` est **absent** (ex. `requirePermission` → `makeJsonApiError(403, "Forbidden", { code: "FORBIDDEN", detail: "Insufficient permission" })`).

2. **WarpDrive** — le `Fetch` handler transforme **toute** réponse d'erreur dont le corps contient un tableau `errors` en **`AggregateError`** (`node_modules/@warp-drive/core/.../index-CQP2NSqg.js:9692`) :
   ```js
   const error = errors ? new AggregateError(errors, msg) : new Error(msg);
   error.status = response.status;      // 403, 409, 500…
   error.statusText = statusText;
   error.isRequestError = true;
   error.code = error.status;
   error.content = errorPayload;        // { errors: [...] }
   throw error;
   ```
   → Donc **400 comme 403/409/500 arrivent tous en `AggregateError`** côté front.

3. **Front — [[@libs/shared-front/src/services/handle-save.ts#HandleSaveService]]** (le point d'entrée de tous les `save` de formulaire) :
   ```js
   catch (error) {
     if (error instanceof AggregateError) {
       this.handleAggregateError(error, changeset); // → si changeset: addErrorsToChangeset
       handled = true;
     }
     if (!handled) this.errorReporter.report(error); // console.error uniquement
   }
   ```
   `handleAggregateError` → `addErrorsToChangeset` fait aveuglément :
   ```js
   key: singleError.source.pointer.replace('//data/attributes/', '')
   ```

### Les 3 classes d'erreurs invisibles

| Cas | Comportement actuel | Résultat pour l'utilisateur |
|-----|---------------------|------------------------------|
| **A. Erreur sans `source`** (403, 401, 409, 404, 500 via `makeJsonApiError`) | `singleError.source` est `undefined` → `.pointer` lève un `TypeError` **dans le `catch`** → rejet non géré | Rien affiché |
| **B. Erreur avec `source.pointer` ne correspondant à aucun champ rendu** | ajoutée au changeset sous une clé sans champ lié | Rien affiché |
| **C. Non-`AggregateError`** (échec réseau, corps non-JSON) | `errorReporter.report` → `console.error` seulement (cf. test `handle-save-test.gts:230`) | Rien affiché |

### Constat annexe

La clé de traduction `shared.handle-save.generic-error-message` (utilisée par `reportAggregateError`) **n'existe dans aucun fichier de traduction** — il n'y a pas de namespace `shared/` sous `@apps/front/translations/`. Si ce chemin était atteint, l'utilisateur verrait le libellé brut de la clé manquante.

## Objectif

Quand une erreur backend n'est **pas** rattachable à un champ de formulaire (permission, conflit, introuvable, erreur serveur, réseau), elle doit **s'afficher via un flash `danger`** avec un message localisé. Les erreurs de validation de champ (400 avec `source.pointer`) continuent de s'afficher **inline** sur le champ concerné (comportement actuel conservé).

## Architectural Context (advisory — graphify, graphe frais)

- **Communautés touchées** : `shared-front` (service transverse), consommé par tous les `*-front`.
- **God nodes concernés** : `IncidentForm` (31 edges, #1) est un consommateur direct de `handleSave` — tout changement du service se répercute sur ce composant très connecté ⇒ couverture de test renforcée.
- **Contrats transverses à risque** :
  - Format d'erreur JSON:API (`makeJsonApiError`) — ne pas modifier le backend, seulement le consommer côté front.
  - Consommateurs de `handleSave` (5) : `user-form.gts`, `incident-form.gts`, `todo-form.gts`, `access-record-form.gts`, `role-form.gts`. L'API publique `handleSave(options)` doit rester rétro-compatible.
- **Règle advisory** : diagnostic déjà confirmé par lecture directe des fichiers ; le graphe n'a servi qu'à mesurer le rayon d'impact.

## Approche technique

Refonte de la gestion d'erreur de `HandleSaveService` (aucun changement backend, aucun changement d'API publique). Ajout d'un namespace de traduction `shared/`.

### Principe : classifier chaque erreur JSON:API

Une erreur du tableau `AggregateError.errors` est **une erreur de champ** si et seulement si elle possède un `source.pointer` référençant `/data/attributes/`. Sinon c'est une **erreur globale**.

- Erreurs de champ → `changeset.addError()` (inline).
- Erreurs globales → **flash `danger`** avec message localisé.
- Un `AggregateError` peut contenir un **mélange** des deux → traiter chaque catégorie.
- Non-`AggregateError` → flash `danger` générique + `errorReporter.report` (pour un futur Sentry).

### Sélection du message affiché (erreurs globales)

Les `detail` backend sont techniques/anglais (« Insufficient permission ») → préférer une traduction pilotée par `code` puis `status`, avec repli sur `detail`, puis message générique :

```
1. shared.handle-save.errors.<code>        ex. errors.FORBIDDEN
2. shared.handle-save.status.<status>       ex. status.409
3. singleError.detail                        (repli si présent)
4. shared.handle-save.generic-error-message  (dernier repli)
```

Utiliser `intl.exists()` avant chaque `intl.t()` pour éviter d'afficher une clé manquante.

## Guide d'implémentation

### Phase 1 — Refonte de la classification d'erreurs dans `HandleSaveService`

Fichier : `@libs/shared-front/src/services/handle-save.ts`

1. Introduire un type/garde pour distinguer erreur de champ vs globale :
   ```ts
   interface JSONAPIError {
     status?: string;
     code?: string;
     detail?: string;
     source?: { pointer?: string };
   }

   const FIELD_POINTER_RE = /\/data\/attributes\//;

   function isFieldError(e: JSONAPIError): boolean {
     return typeof e.source?.pointer === 'string'
       && FIELD_POINTER_RE.test(e.source.pointer);
   }
   ```

2. Réécrire `handleAggregateError` pour partitionner les erreurs :
   ```ts
   private handleAggregateError(error: AggregateError, changeset?: ImmerChangeset) {
     const errors = (error.errors ?? []) as JSONAPIError[];
     const fieldErrors  = errors.filter(isFieldError);
     const globalErrors = errors.filter((e) => !isFieldError(e));

     if (changeset && fieldErrors.length) {
       this.addErrorsToChangeset(fieldErrors, changeset);
     }

     // Erreurs globales OU absence totale de changeset → flash
     const toFlash = changeset ? globalErrors : errors;
     for (const e of toFlash) {
       this.flashMessages.danger(this.messageForError(e));
     }

     // Rien de rattachable + rien à flasher (défensif) → générique
     if (!fieldErrors.length && !toFlash.length) {
       this.flashMessages.danger(this.genericMessage());
     }

     // Reporting monitoring pour les erreurs serveur (5xx)
     if (globalErrors.some((e) => (e.status ?? '').startsWith('5'))) {
       this.errorReporter.report(error);
     }
   }
   ```

3. Rendre `addErrorsToChangeset` défensif (ne plus supposer `source.pointer` présent) et n'accepter que les erreurs de champ déjà filtrées :
   ```ts
   private addErrorsToChangeset(fieldErrors: JSONAPIError[], changeset: ImmerChangeset) {
     for (const e of fieldErrors) {
       changeset.addError({
         message: e.detail ?? this.genericMessage(),
         key: e.source!.pointer!.replace(FIELD_POINTER_RE, '').replace(/^\/+/, ''),
         value: undefined,
         originalValue: undefined,
       });
     }
   }
   ```
   > Note : le code actuel utilise `replace('//data/attributes/', '')` (double slash). Vérifier le pointer réel produit par le backend (`/data/attributes/…` simple slash, cf. `handleJsonApiErrors`) et par WarpDrive, et normaliser la clé de manière robuste (regex + strip des slashes de tête) pour éviter une clé mal formée. Confirmer via un test avec un pointer réel.

4. Ajouter `messageForError` et `genericMessage` :
   ```ts
   private genericMessage(): string {
     return this.intl.t('shared.handle-save.generic-error-message');
   }

   private messageForError(e: JSONAPIError): string {
     const byCode = e.code && `shared.handle-save.errors.${e.code}`;
     if (byCode && this.intl.exists(byCode)) return this.intl.t(byCode);

     const byStatus = e.status && `shared.handle-save.status.${e.status}`;
     if (byStatus && this.intl.exists(byStatus)) return this.intl.t(byStatus);

     if (e.detail) return e.detail;
     return this.genericMessage();
   }
   ```

5. Supprimer/replier l'ancien `reportAggregateError` (désormais couvert par le flux ci-dessus).

### Phase 2 — Gérer les non-`AggregateError` (réseau / parse)

Toujours dans `handleSave` :
```ts
if (!handled) {
  this.errorReporter.report(error);              // monitoring
  this.flashMessages.danger(this.genericMessage()); // NOUVEAU : visible utilisateur
}
```
> Décision : l'utilisateur demande d'afficher « dans certains cas ». Un échec réseau/serveur est précisément un cas à montrer (un message générique, pas de détail technique).

### Phase 3 — Ajouter le namespace de traduction `shared/`

Créer `@apps/front/translations/shared/fr-fr.yaml` et `@apps/front/translations/shared/en-us.yaml`.

`fr-fr.yaml` :
```yaml
handle-save:
  generic-error-message: "Une erreur est survenue. Veuillez réessayer."
  errors:
    UNAUTHORIZED: "Votre session a expiré. Veuillez vous reconnecter."
    FORBIDDEN: "Vous n'avez pas les droits nécessaires pour cette action."
  status:
    '401': "Votre session a expiré. Veuillez vous reconnecter."
    '403': "Vous n'avez pas les droits nécessaires pour cette action."
    '404': "La ressource demandée est introuvable."
    '409': "Conflit : cette action entre en conflit avec l'état actuel des données."
    '422': "Les données envoyées sont invalides."
    '500': "Une erreur serveur est survenue. Veuillez réessayer plus tard."
```

`en-us.yaml` : équivalents anglais.

> Vérifier le mécanisme de chargement des traductions (`ember-intl`) : confirmer que le dossier `shared/` est bien fusionné dans le namespace `shared.*` comme les autres dossiers (`users/`, `global/`…). Aligner la structure sur un dossier existant.

### Phase 4 (optionnelle, à confirmer avec le demandeur) — Erreurs de lecture / chargement de route

Les erreurs `403/404` sur les `model()` de route (ex. liste refusée) ne passent **pas** par `handleSave` — elles remontent via les *error substates* d'Ember. Hors périmètre du fix principal. Si souhaité, prévoir un `error.gts` de route ou un handler WarpDrive global affichant un flash. **Ne pas implémenter sans validation explicite du périmètre.**

## Stratégie de test (critère de succès bloquant)

Fichier : `@libs/shared-front/tests/unit/handle-save-test.gts`. Les tests d'intégration/unitaires suivants sont **bloquants** (non substituables par un smoke test manuel) :

1. **Erreur de champ (400 avec pointer)** → `changeset.addError` appelé avec la bonne `key` ; **aucun** flash danger. (adapter le test existant)
2. **Erreur globale sans `source` (403 `FORBIDDEN`)** → **flash danger** avec le message traduit `errors.FORBIDDEN` ; `changeset.addError` **non** appelé ; **pas** de `TypeError`.
3. **Erreur globale par status (409 sans code mappé)** → flash danger via `status.409`.
4. **Repli sur `detail`** quand ni `code` ni `status` n'ont de traduction → flash affiche `e.detail`.
5. **Repli générique** quand rien n'est disponible → flash `generic-error-message`.
6. **Mélange champ + global** dans un même `AggregateError` → `addError` pour le champ **et** flash pour le global.
7. **5xx** → flash danger **et** `errorReporter.report` appelé.
8. **Non-`AggregateError` (réseau)** → flash danger générique **et** `errorReporter.report` (remplace l'assertion actuelle `handle-save-test.gts:230` qui vérifie l'absence de flash — ce test doit être **inversé**).
9. **Sans changeset + AggregateError** → toutes les erreurs sont flashées.

Commande : `cd @libs/shared-front && pnpm test` (vitest). Lint : `pnpm run lint`.

## Critères de succès (vérifiables)

1. `@libs/shared-front` : `pnpm test` passe, incluant les 9 cas ci-dessus (le test `handle-save-test.gts:230` est inversé pour asserter l'affichage du flash).
2. `addErrorsToChangeset` ne lève plus de `TypeError` sur une erreur sans `source` (couvert par test #2).
3. Une 403 sur un `save` de formulaire affiche un flash danger localisé (fr + en) — vérifiable manuellement en se connectant en `encoder` et en tentant une action réservée `tech_admin`.
4. Le namespace `shared.*` est chargé : `intl.exists('shared.handle-save.generic-error-message')` renvoie `true` (les clés existent en fr-fr et en-us).
5. Aucune régression sur l'affichage inline des erreurs de validation 400 (test #1).
6. `pnpm run lint` passe sur `@libs/shared-front` et `@apps/front`.
7. `lat.md/frontend/shared-front.md` mis à jour pour décrire la nouvelle classification champ/global + `messageForError` ; `lat check` passe.

## Fichiers touchés

- `@libs/shared-front/src/services/handle-save.ts` (refonte gestion d'erreur)
- `@libs/shared-front/tests/unit/handle-save-test.gts` (nouveaux cas + inversion du cas réseau)
- `@apps/front/translations/shared/fr-fr.yaml` (nouveau)
- `@apps/front/translations/shared/en-us.yaml` (nouveau)
- `lat.md/frontend/shared-front.md` (doc)

## Notes / risques

- **401 Unauthorized** : selon la stratégie de session (refresh token, cf. [[backend/users-auth]]), une 401 peut mériter une **redirection vers login** plutôt qu'un flash. Vérifier s'il existe un intercepteur 401 (le `AuthHandler` actuel n'ajoute que les headers, sans logique de refresh). À défaut, le message `errors.UNAUTHORIZED` est un repli acceptable ; ne pas ajouter de redirection sans validation.
- **Ne pas exposer les `detail` techniques 5xx** : les 5xx passent par `code`/`status` traduits ; le repli `detail` ne s'applique qu'aux 4xx métier. Vérifier qu'un 500 backend ne renvoie pas de `detail` sensible (sinon forcer le message générique pour les status `5xx`).
- Rétro-compatibilité : la signature `handleSave(options)` est inchangée ; les 5 formulaires consommateurs ne nécessitent aucune modification.
