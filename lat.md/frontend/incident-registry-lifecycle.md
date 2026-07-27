# Registre d'incidents — édition / suppression / restauration (Frontend)

UI front du cycle de vie incident : éditer (nouvelle version), soft-supprimer avec confirmation, restaurer. Consomme le contrat backend du spec 01 ([[incident-registry#Édition = nouvelle version (append)]]).

## Service : update / softDelete / restore

Le service ([[@libs/incident-registry-front/src/services/incident.ts#IncidentService]]) porte trois méthodes en plus de `create`, alignées sur le contrat backend.

`update(id, data)` envoie un **PUT** `/incidents/:id` (corps = attributs de contenu, identiques à `create` — le backend crée une nouvelle version). `softDelete(id)` envoie **DELETE** `/incidents/:id`. `restore(id)` envoie **POST** `/incidents/:id/restore`. Les requêtes passent par `store.request` (auth injectée par le handler), donc interceptées par MSW en test.

## Route & formulaire d'édition

La route `incidents/edit` (`/:incident_id/edit`, `IncidentsEditRoute` dans `@libs/incident-registry-front/src/routes/dashboard/incidents/edit.gts`) est gardée `update:Incident` et charge l'incident via `findRecord`.

Le wizard `IncidentForm` accepte `@mode` (`create`/`edit`) et `@incidentId` : en édition, `onSubmit` appelle `incident.update(incidentId, …)` au lieu de `create`. Le changeset est pré-rempli par [[@libs/incident-registry-front/src/changesets/incident.ts#incidentToDraft]], qui reconvertit les dates ISO→Date et normalise les formes des éditeurs imbriqués (descriptionSections `body`→`detail`, signatures `{name,date}`).

## Table : actions, modale et filtre supprimés

La table (`IncidentTable` dans `@libs/incident-registry-front/src/components/incident-table.gts`) expose un `actionMenu` composé selon les abilities et une `TpkConfirmModalPrefab` pour la suppression.

Le prefab `TableGenericPrefab` n'offre pas de visibilité par ligne : le menu est donc composé au niveau du rôle (`can('update'|'delete'|'restore','Incident')`) et le row-level (encoder = les siens) est revérifié dans le handler (`canManageRow` : DPO ou `encodedBy === user.id`) — le backend fait foi (403). La suppression ouvre la modale puis `softDelete` + `reloadData`. Le toggle « afficher les supprimés » (DPO, via `can('restore')`) ajoute `filter[includeDeleted]=true` et une colonne « état » tague les lignes supprimées.
