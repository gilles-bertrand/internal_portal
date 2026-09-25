import type { EntityManager } from "@mikro-orm/postgresql";

export interface LibraryContext {
  em: EntityManager;
}
