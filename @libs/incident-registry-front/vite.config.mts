import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
import { extensions, ember } from '@embroider/vite';
import { babel } from '@rollup/plugin-babel';

export default defineConfig({
  plugins: [
    ember(),
    babel({
      babelHelpers: 'inline',
      extensions,
    }),
  ],
  test: {
    setupFiles: ['./tests/test-helper.ts'],
    // `ts`/`js` included too: tests/unit/incident-to-draft-test.ts is a plain
    // .ts file and was silently skipped by the {gjs,gts}-only glob.
    include: ['tests/**/*-test.{js,ts,gjs,gts}'],
    maxConcurrency: 1,
    testTimeout: 10000,
    browser: {
      provider: playwright(),
      enabled: true,
      headless: process.env.CI === 'true',
      instances: [{ browser: 'chromium' }],
    },
  },
});
