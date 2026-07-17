# Todos — portée strictement privée

Les todos sont des ressources privées par utilisateur : aucun partage, aucune assignation, aucun rôle n'intervient, contrairement aux registres RGPD du monorepo.

Toutes les routes filtrent systématiquement par `userId: currentUser.id` ([[@libs/todos-backend/src/routes/list.route.ts#ListRoute]], [[@libs/todos-backend/src/routes/get.route.ts#GetRoute]]) — un todo n'est jamais visible ni modifiable par un autre utilisateur, y compris un `tech_admin`. Pas de soft-delete, pas d'audit, et ce module ne réutilise pas la primitive hash-chain d'[[hash-chain-integrity|access-registry/incident-registry]] : un simple CRUD scoped par propriétaire.
