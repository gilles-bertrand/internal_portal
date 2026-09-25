import { App } from "#src/app/app.js";
import { getTestContext } from "./test-context.js";
import type { AppConfiguration } from "#src/configuration.js";

export interface TestEnv {
  app: App;
}

export async function testEnv(overrides: Partial<AppConfiguration> = {}): Promise<TestEnv> {
  const context = await getTestContext(overrides);
  return {
    app: await App.init(context.context),
  };
}
