# Plateforme backend — contrats partagés

Décisions d'architecture transverses qui permettent à `@apps/backend` de rester agnostique du contenu de chaque module métier (`users`, `todos`, `access-registry`, `incident-registry`).

## Contrat de module Fastify partagé

Deux interfaces de 9 lignes au total ([[@libs/backend-shared/src/module.ts#Route]] et [[@libs/backend-shared/src/module.ts#ModuleInterface]]) sont le seul contrat que [[@apps/backend/src/app/app.router.ts#appRouter]] connaît de chaque module métier.

`appRouter` appelle `authModule.setupRoutes(fastify)`, `userModule.setupRoutes(fastify)`, `todosModule.setupRoutes(fastify)`, `accessRegistryModule.setupRoutes(fastify)` de façon identique, sans branche conditionnelle par module. Chaque lib backend instancie ses routes concrètes dans son propre `init.ts` derrière `Module implements ModuleInterface`. Centraliser ce contrat évite que chaque lib invente sa propre façon d'être « branchable » et garde le composition root agnostique du contenu ajouté au fil du temps.

`audit-log-backend` n'implémente PAS `ModuleInterface` — voir [[platform#Audit-log : noyau sans HTTP]].

## Enveloppe JSON:API et gestion d'erreurs partagées

`@libs/backend-shared` fournit les seuls helpers JSON:API (`makeJsonApiDocumentSchema`, `makeSingleJsonApiTopDocument`, `makeJsonApiError`) et le handler d'erreurs Zod du monorepo — toutes les routes s'y conforment.

[[@libs/backend-shared/src/error-handler.ts#handleJsonApiErrors]] convertit les erreurs de validation Zod/Fastify en document d'erreur JSON:API (statut 400, pointer basé sur `instancePath`). Ce handler n'est **pas** branché globalement dans `app.ts` — chaque module l'appelle localement dans son propre `setErrorHandler` interne. C'est donc un contrat appliqué par convention module par module, pas par un middleware central : sans lui, chaque lib réinventerait le format d'erreur JSON:API.

## Audit-log : noyau sans HTTP

`audit-log-backend` n'expose aucune route HTTP ; son entité et son service d'écriture sont consommés par les registries via une interface `AuditLogger` locale à chaque consommateur, pas par import direct depuis le kernel.

Contenu réel : [[@libs/audit-log-backend/src/entities/audit-event.entity.ts#AuditEventEntity]] et [[@libs/audit-log-backend/src/serializers/audit-event.serializer.ts#jsonApiSerializeManyAuditEvents]]. L'exposition HTTP du journal ([[@libs/access-registry-backend/src/routes/audit-events.route.ts#AuditEventsRoute]]) est implémentée dans `access-registry-backend`, pas dans `audit-log-backend`, alors qu'elle interroge la table `audit_event` globale — c'est le seul point de requête/filtrage du journal qui existe actuellement ; `incident-registry-backend` n'y est pas câblé.

Découplage délibéré : `access-registry-backend` et `incident-registry-backend` définissent chacun leur propre interface `AuditLogger` locale ([[@libs/access-registry-backend/src/utils/audit-logger.type.ts#AuditLogger]] et [[@libs/incident-registry-backend/src/utils/audit-logger.type.ts#AuditLogger]], identiques mot pour mot) plutôt que d'importer le type depuis `audit-log-backend`. Seul `app.ts` connaît la classe concrète `AuditAppendService` et l'injecte comme implémentation structurelle de `AuditLogger` — un port/adapter où les registries ne dépendent jamais du package `audit-log-backend` pour leur logique métier.
