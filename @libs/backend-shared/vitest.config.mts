import { defineConfig } from "vitest/config";
import path from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [path()],
  test: {
    name: "Unit Tests",
    include: ["tests/unit/*.test.ts"],
    environment: "node",
    pool: "threads",
  },
});
