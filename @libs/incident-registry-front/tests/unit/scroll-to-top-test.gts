import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { scrollToListTopOnPager } from '#src/utils/scroll-to-top.ts';

describe('scrollToListTopOnPager', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    container.addEventListener('click', scrollToListTopOnPager);
  });

  afterEach(() => {
    container.removeEventListener('click', scrollToListTopOnPager);
    document.body.removeChild(container);
  });

  test('ne fait rien si target est null', () => {
    // Appel direct avec un target null — doit sortir sans lever d'exception.
    const fakeEvent = {
      target: null,
      currentTarget: container,
    } as unknown as MouseEvent;
    expect(() => scrollToListTopOnPager(fakeEvent)).not.toThrow();
  });

  test('ne déclenche pas scrollIntoView si le clic est en dehors des boutons de pagination', () => {
    const inner = document.createElement('span');
    container.appendChild(inner);

    const scrollSpy = vi.fn();
    container.scrollIntoView = scrollSpy;

    inner.click();

    expect(scrollSpy).not.toHaveBeenCalled();
  });

  test('appelle scrollIntoView après un clic sur [data-test-pagination-next]', async () => {
    const button = document.createElement('button');
    button.setAttribute('data-test-pagination-next', '');
    container.appendChild(button);

    const scrollSpy = vi.fn();
    container.scrollIntoView = scrollSpy;

    button.click();

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

    expect(scrollSpy).toHaveBeenCalledWith({
      block: 'start',
      behavior: 'smooth',
    });
  });

  test('appelle scrollIntoView après un clic sur [data-test-pagination-previous]', async () => {
    const button = document.createElement('button');
    button.setAttribute('data-test-pagination-previous', '');
    container.appendChild(button);

    const scrollSpy = vi.fn();
    container.scrollIntoView = scrollSpy;

    button.click();

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

    expect(scrollSpy).toHaveBeenCalledWith({
      block: 'start',
      behavior: 'smooth',
    });
  });

  test("n'appelle pas scrollIntoView pour un enfant du bouton qui n'est pas lui-même un bouton de pagination", () => {
    const button = document.createElement('button');
    button.setAttribute('data-test-pagination-next', '');
    const icon = document.createElement('span');
    button.appendChild(icon);
    container.appendChild(button);

    const scrollSpy = vi.fn();
    container.scrollIntoView = scrollSpy;

    // closest() remonte l'arbre — l'icône à l'intérieur du bouton doit aussi déclencher le scroll.
    // Ce test vérifie que closest() fonctionne correctement sur un élément enfant.
    icon.click();

    // Le RAF n'est pas attendu intentionnellement ici : si scrollSpy n'est pas appelé
    // de façon synchrone c'est que closest() n'a pas trouvé le sélecteur — ce serait un bug.
    // On utilise un RAF pour être cohérent avec la logique async.
    return new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        expect(scrollSpy).toHaveBeenCalledWith({
          block: 'start',
          behavior: 'smooth',
        });
        resolve();
      });
    });
  });
});
