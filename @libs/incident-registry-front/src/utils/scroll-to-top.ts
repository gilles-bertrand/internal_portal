/**
 * Gestionnaire de clic à poser sur le conteneur d'une liste paginée.
 * Quand l'utilisateur clique sur un bouton de pagination (précédent/suivant),
 * on ramène le haut de la liste dans la vue — sinon on reste en bas de page
 * après le changement de page.
 */
export function scrollToListTopOnPager(event: MouseEvent): void {
  const target = event.target as HTMLElement | null;
  if (!target) {
    return;
  }
  const isPager = target.closest(
    '[data-test-pagination-previous], [data-test-pagination-next]'
  );
  if (!isPager) {
    return;
  }
  const container = event.currentTarget as HTMLElement;
  // Après le re-rendu des lignes par la table.
  requestAnimationFrame(() => {
    container.scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
}
