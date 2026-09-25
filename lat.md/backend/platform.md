# Plateforme backend — contrats partagés

Décisions d'architecture transverses qui permettent à `@apps/backend` de rester agnostique du contenu de chaque module métier (`users`, `todos`, `access-registry`, `incident-registry`).

## Contrat de module Fastify partagé

Deux interfaces de 9 lignes au total ([[@libs/backend-shared/src/module.ts#Route]] et [[@libs/backend-shared/src/module.ts#ModuleInterface]]) sont le seul contrat que [[@apps/backend/src/app/app.router.ts#appRouter]] connaît de chaque module métier.

`appRouter` appelle `authModule.setupRoutes(fastify)`, `userModule.setupRoutes(fastify)`, `todosModule.setupRoutes(fastify)`, `accessRegistryModule.setupRoutes(fastify)` de façon identique, sans branche conditionnelle par module. Chaque lib backend instancie ses routes concrètes dans son propre `init.ts` derrière `Module implements ModuleInterface`. Centraliser ce contrat évite que chaque lib invente sa propre façon d'être « branchable » et garde le composition root agnostique du contenu ajouté au fil du temps.

`audit-log-backend` n'implémente PAS `ModuleInterface` — voir [[platform#Audit-log : noyau sans HTTP]].

## Enveloppe JSON:API et gestion d'erreurs partagées

`@libs/backend-shared` fournit les seuls helpers JSON:API (`makeJsonApiDocumentSchema`, `makeSingleJsonApiTopDocument`, `makeJsonApiError`) et le handler d'erreurs Zod du monorepo — toutes les routes s'y conforment.

[[@libs/backend-shared/src/error-handler.ts#handleJsonApiErrors]] convertit les erreurs de validation Zod/Fastify en document d'erreur JSON:API (statut 400, pointer normalisé par [[@libs/backend-shared/src/error-handler.ts#jsonApiValidationPointer]]). Ce handler n'est **pas** branché globalement dans `app.ts` — chaque module l'appelle localement dans son propre `setErrorHandler` interne. C'est donc un contrat appliqué par convention module par module, pas par un middleware central : sans lui, chaque lib réinventerait le format d'erreur JSON:API.

### C'est ce handler-là qui répond, pas celui d'`app.ts`

Un `setErrorHandler` posé sur un scope Fastify interne l'emporte sur celui du composition root : pour toute route métier, c'est `handleJsonApiErrors` qui formate la réponse.

Le monorepo compte neuf `setErrorHandler` — un par scope de module, plus le global. Corriger le format d'erreur dans `app.ts` seul est donc du code mort pour l'essentiel du trafic. C'est ce qui s'est produit : le correctif du pointer doublé a d'abord été écrit dans `app.ts`, tandis que `handleJsonApiErrors` continuait d'émettre `//email`. Le pointer est désormais construit par **une seule** fonction, partagée par les deux handlers.

Conséquence de build : chaque lib `*-backend` **inline** `handleJsonApiErrors` dans son `dist/` au moment du bundle. Modifier `@libs/backend-shared` ne suffit pas — il faut reconstruire les libs consommatrices (ce que `turbo run build` fait via `dependsOn: ["^build"]`), sinon le correctif reste invisible à l'exécution comme aux tests.

## Audit-log : noyau sans HTTP

`audit-log-backend` n'expose aucune route HTTP ; son entité et son service d'écriture sont consommés par les registries via une interface `AuditLogger` locale à chaque consommateur, pas par import direct depuis le kernel.

Contenu réel : [[@libs/audit-log-backend/src/entities/audit-event.entity.ts#AuditEventEntity]] et [[@libs/audit-log-backend/src/serializers/audit-event.serializer.ts#jsonApiSerializeManyAuditEvents]]. **Amendé le 2026-09-18** : l'exposition HTTP du journal ([[@libs/audit-log-backend/src/routes/audit-events.route.ts#AuditEventsRoute]]) a rejoint `audit-log-backend`, qui implémente désormais `ModuleInterface` en LECTURE seule — voir [[audit-log#Journal exposé par son propre module]]. Le découplage décrit ici porte sur l'ÉCRITURE et reste entier. Elle était implémentée dans `access-registry-backend`, alors qu'elle interroge la table `audit_event` globale — c'est le seul point de requête/filtrage du journal qui existe actuellement ; `incident-registry-backend` n'y est pas câblé.

Découplage délibéré : `access-registry-backend` et `incident-registry-backend` définissent chacun leur propre interface `AuditLogger` locale ([[@libs/access-registry-backend/src/utils/audit-logger.type.ts#AuditLogger]] et [[@libs/incident-registry-backend/src/utils/audit-logger.type.ts#AuditLogger]], identiques mot pour mot) plutôt que d'importer le type depuis `audit-log-backend`. Seul `app.ts` connaît la classe concrète `AuditAppendService` et l'injecte comme implémentation structurelle de `AuditLogger` — un port/adapter où les registries ne dépendent jamais du package `audit-log-backend` pour leur logique métier.

## Parser du content-type JSON:API

Le parser `application/vnd.api+json` doit être passé en **troisième** argument de `addContentTypeParser` : dans le slot `opts`, aucune fonction de parsing n'est enregistrée et tout corps JSON:API est rejeté.

C'est le bug qui rendait le registre incidents inutilisable : le front (WarpDrive) pose `Content-Type: application/vnd.api+json` sur toutes ses écritures, et chaque POST/PUT repartait en 400 `FST_ERR_CTP_INVALID_JSON_BODY` — « Body is not valid JSON » — sans jamais atteindre la route. Un `// @ts-expect-error` accompagnait l'appel et masquait exactement cette erreur de signature. Les lectures (GET, sans corps) n'étant pas concernées, l'application paraissait fonctionner : seules les créations échouaient, en silence côté UI.

Règle : ne jamais faire taire par `@ts-expect-error` une erreur de typage sur un appel de configuration Fastify — c'est la signature qui est fausse, pas le typage.

## Le handler d'erreur global répond en JSON:API

Le `setErrorHandler` global d'`app.ts` émet un document `{ errors: [...] }` et pose le status explicitement, parce que c'est la forme que TOUTES les routes déclarent pour leurs réponses d'erreur.

Le handler renvoyait `{ message, code, status }`. Or les 17 `404`, 15 `403`, 6 `400`, 4 `409`, 4 `401` et 1 `423` déclarés dans les libs le sont tous en `jsonApiErrorDocumentSchema`. Fastify sérialise la réponse d'erreur contre le schéma déclaré pour ce status : la clé `errors` étant absente, la sérialisation échouait et le client recevait un **500 `FST_ERR_RESPONSE_SERIALIZATION` opaque au lieu du 400 de validation** — sur toutes les routes de tous les modules. Le message nommant le champ fautif était donc perdu, et le front ne pouvait rien afficher d'utile.

Corollaire pour toute nouvelle route : déclarer un status d'erreur dans `response` engage le handler global à produire cette forme. Un status déclaré avec une autre forme rendrait de nouveau les erreurs opaques.

### Le pointer d'erreur ne doit pas être doublé

[[@libs/backend-shared/src/error-handler.ts#jsonApiValidationPointer]] normalise le chemin en un seul slash de tête, parce que le front dérive la clé du champ fautif de ce pointer.

`instancePath` commence déjà par `/`, et une concaténation naïve produisait `//email` ou `//data/attributes/...`. Le front y voyait bien une erreur de champ mais en tirait une clé inexploitable : l'erreur serveur ne se rattachait à aucun input. Voir [[shared-front#Erreur serveur de champ → clé de changeset]].

La fonction est partagée entre `handleJsonApiErrors` et le handler global d'`app.ts` : une seconde implémentation est précisément ce qui avait laissé le défaut en place, corrigé d'un côté et pas de l'autre. Couvert par [[@apps/backend/tests/integration/app.test.ts]], qui assert qu'un pointer ne commence jamais par `//`.
