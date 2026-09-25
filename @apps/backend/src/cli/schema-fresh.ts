import mikroOrmConfig from "#src/mikro-orm.config.ts";
import { DatabaseSeeder } from "#src/seeders/development.seeder.ts";
import { MikroORM } from "@mikro-orm/postgresql";
import { APPEND_ONLY_DDL } from "#src/cli/append-only.sql.ts";

const orm = await MikroORM.init({ ...mikroOrmConfig, debug: true });

await orm.schema.refresh();
await orm.em.execute(APPEND_ONLY_DDL);
await orm.seeder.seed(DatabaseSeeder);

await orm.close(true);
