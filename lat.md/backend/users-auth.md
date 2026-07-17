# Rôles utilisateur et authentification

Quatre rôles (`encoder`, `dpo`, `auditor`, `tech_admin`) existent, désormais backés par une entité `Role` en base plutôt qu'une string libre — modèle complet dans [[backend/permissions]].

## RBAC sur le module users : résolu

L'ancien trou de sécurité documenté ici (`role` assignable librement dans `POST /users`, sans vérification de l'appelant) est résolu — voir [[backend/permissions#Création d'utilisateur guardée par manage:User]].

Le middleware `requireRole` (jamais branché) a été supprimé et remplacé par `requirePermission` du module `permissions-backend`.

## Authentification JWT et rotation des refresh tokens

Access token JWT courte durée (15 min) + refresh token opaque en base avec rotation, détection de vol par famille, et verrouillage anti-bruteforce.

[[@libs/users-backend/src/routes/login.route.ts#LoginRoute]] applique un verrouillage anti-bruteforce (5 échecs → compte verrouillé 15 min) puis génère `accessToken` (payload `{userId, email, role}`) et `refreshToken`. Seul le hash SHA-256 du refresh token ([[@libs/users-backend/src/utils/token.utils.ts#hashToken]]) est persisté, avec `familyId`/`deviceInfo`/`expiresAt`/`revokedAt`. [[@libs/users-backend/src/routes/refresh.route.ts#RefreshRoute]] révoque systématiquement l'ancien token et émet un nouveau avec le même `familyId` ; si un token déjà révoqué est représenté (signe de vol/replay), toute la famille est révoquée.

L'incohérence précédemment documentée ici (claim `role` absent au refresh) est corrigée — `RefreshRoute` régénère désormais le token avec le même claim `role` que `LoginRoute`. Ce claim reste informationnel : l'autorisation réelle passe par `request.ability`, reconstruite depuis la base à chaque requête (cf. [[backend/permissions#Attachement de request.ability au chargement de l'utilisateur]]), donc aucun risque de désynchronisation.

## Mot de passe oublié : UI sans backend

La page "mot de passe oublié" existe côté front avec formulaire et validation, mais son `onSubmit` est un stub vide.

Aucune route backend de réinitialisation n'existe dans `users-backend` (`@libs/users-front/src/components/forms/forgot-password.gts`, composant `ForgotPasswordTemplate`).

Divergence connexe : le mot de passe minimum est de 12 caractères à la création côté backend, mais seulement 8 dans la validation front — un mot de passe de 8 à 11 caractères peut passer la validation front puis être rejeté par l'API.
