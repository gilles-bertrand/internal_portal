import { defineConfig } from "vitest/config";
import path from "vite-tsconfig-paths";

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [path()],
        test: {
          name: "Unit Tests",
          include: ["tests/unit/*.test.ts"],
          environment: "node",
          pool: "threads",
        },
      },
      {
        plugins: [path()],
        test: {
          name: "Integration Tests",
          globalSetup: "./tests/global-setup.ts",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          pool: "forks",
          // Tous les fichiers partagent LE MÊME conteneur Postgres (globalSetup),
          // et chacun suppose posséder une table `incident` vide : `seq` est
          // UNIQUE, donc deux fichiers exécutés en parallèle s'y percutent et
          // l'un des deux reçoit un 500. L'isolation par `aroundEach`
          // (begin/rollback) ne vaut qu'À L'INTÉRIEUR d'un fichier, jamais entre
          // deux forks. Sérialiser les fichiers est ce qui rend la suite
          // déterministe.
          fileParallelism: false,
        },
      },
    ],
  },
});
