import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';
import {
  createMongoAbility,
  type MongoAbility,
  type RawRuleOf,
} from '@casl/ability';

export type AppAbility = MongoAbility<[string, string]>;
export type AbilityRule = RawRuleOf<AppAbility>;

// @lat: [[frontend/shared-front#Moteur de permissions front (AbilityService)]]
export default class AbilityService extends Service {
  @tracked private ability: AppAbility = createMongoAbility([]);

  load(rules: AbilityRule[]) {
    this.ability = createMongoAbility<AppAbility>(rules);
  }

  reset() {
    this.ability = createMongoAbility<AppAbility>([]);
  }

  can(action: string, subject: string): boolean {
    return this.ability.can(action, subject);
  }
}

// DO NOT DELETE: this is how TypeScript knows how to look up your services.
declare module '@ember/service' {
  interface Registry {
    ability: AbilityService;
  }
}
