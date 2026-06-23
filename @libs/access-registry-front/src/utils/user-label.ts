export interface UserLike {
  firstName: string;
  lastName: string;
  email: string;
}

/**
 * Libellé affiché pour un utilisateur dans le select accessorRef : prénom + nom.
 * Sert aussi de clé de conversion libellé -> email au submit (le formulaire
 * retrouve l'utilisateur par ce libellé).
 */
export function userLabel(user: UserLike): string {
  return `${user.firstName} ${user.lastName}`;
}
