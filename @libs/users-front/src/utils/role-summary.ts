/**
 * Forme minimale d'un rôle, telle que consommée par le sélecteur de rôle du
 * formulaire utilisateur. Délibérément local à users-front (pas importé
 * depuis @libs/permissions-front) pour éviter une dépendance circulaire —
 * permissions-front dépend déjà de users-front pour CurrentUserService.
 */
export interface RoleSummary {
  id: string;
  name: string;
}
