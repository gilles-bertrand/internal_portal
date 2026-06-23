import { describe, expect, test } from 'vitest';
import { userLabel } from '#src/utils/user-label.ts';

describe('userLabel', () => {
  test('concatène prénom et nom séparés par un espace', () => {
    expect(
      userLabel({
        firstName: 'Jean',
        lastName: 'Dupont',
        email: 'jean@example.com',
      })
    ).toBe('Jean Dupont');
  });

  test('gère les prénoms et noms composés', () => {
    expect(
      userLabel({
        firstName: 'Marie-Claire',
        lastName: 'De La Fontaine',
        email: 'mc@example.com',
      })
    ).toBe('Marie-Claire De La Fontaine');
  });

  test("le libellé sert de clé de recherche inverse pour retrouver l'utilisateur", () => {
    const users = [
      { firstName: 'Alice', lastName: 'Martin', email: 'alice@example.com' },
      { firstName: 'Bob', lastName: 'Durand', email: 'bob@example.com' },
    ];

    const label = userLabel(users[0]!);
    const found = users.find((u) => userLabel(u) === label);

    expect(found?.email).toBe('alice@example.com');
  });
});
