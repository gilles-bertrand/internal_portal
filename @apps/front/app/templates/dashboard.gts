import type { TOC } from '@ember/component/template-only';
import { service } from '@ember/service';
import Component from '@glimmer/component';
import type CurrentUserService from '@libs/users-front/services/current-user';
import type AbilityService from '@libs/shared-front/services/ability';
import type FeaturesService from '@libs/shared-front/services/features';
import TpkDashBoard, {
  type SidebarItem,
  type Language,
} from '@triptyk/ember-ui/components/prefabs/tpk-dashboard';
import type SessionService from 'ember-simple-auth/services/session';
import type { IntlService } from 'ember-intl';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

export default class DashboardTemplate extends Component {
  @service declare currentUser: CurrentUserService;
  @service declare ability: AbilityService;
  // Domaines montés, lus du serveur : le menu ne propose jamais une route dont
  // l'API n'existe pas. Voir [[frontend/shared-front#Domaines montés]].
  @service declare features: FeaturesService;
  @service declare session: SessionService;
  @service declare intl: IntlService;

  @tracked sidebarCollapsed = false;

  // Chaque langue est nommée DANS sa propre langue (endonyme) : « Anglais »
  // n'a de sens que pour un francophone, et le sélecteur doit rester lisible
  // quelle que soit la locale active.
  languages: Language[] = [
    { code: 'fr-fr', label: 'Français' },
    { code: 'en-us', label: 'English' },
  ];

  @action
  handleLocaleChange(locale: string) {
    this.intl.setLocale([locale]);
  }

  @action
  handleCollapsedChange(collapsed: boolean) {
    this.sidebarCollapsed = collapsed;
  }

  @action
  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  get menuItems(): SidebarItem[] {
    return [
      {
        type: 'link',
        label: this.intl.t('dashboard.sidebar.dashboard'),
        route: 'dashboard',
        icon: <template>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            class="inline-block size-4 stroke-current"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
        </template> as TOC<{ Element: SVGSVGElement }>,
      },
      ...(this.ability.can('manage', 'User')
        ? [
            {
              type: 'link' as const,
              label: this.intl.t('dashboard.sidebar.users'),
              route: 'dashboard.users',
              icon: <template>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  class="inline-block size-4 stroke-current"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </template> as TOC<{ Element: SVGSVGElement }>,
            },
          ]
        : []),
      ...(this.features.isEnabled('todos')
        ? [
            {
              type: 'link' as const,
              label: this.intl.t('dashboard.sidebar.todos'),
              route: 'dashboard.todos',
              icon: <template>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="currentColor"
                  class="inline-block size-4 stroke-current"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z"
                  />
                </svg>
              </template> as TOC<{ Element: SVGSVGElement }>,
            },
          ]
        : []),
      ...(this.features.isEnabled('accessRegistry') &&
      (this.ability.can('read', 'AccessRecord') ||
        this.ability.can('create', 'AccessRecord'))
        ? [
            {
              type: 'link' as const,
              label: this.intl.t('dashboard.sidebar.accessRecords'),
              route: 'dashboard.access-records',
              icon: <template>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="currentColor"
                  class="inline-block size-4 stroke-current"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
                  />
                </svg>
              </template> as TOC<{ Element: SVGSVGElement }>,
            },
          ]
        : []),
      ...(this.features.isEnabled('incidentRegistry') &&
      (this.ability.can('read', 'Incident') ||
        this.ability.can('create', 'Incident'))
        ? [
            {
              type: 'link' as const,
              label: this.intl.t('dashboard.sidebar.incidents'),
              route: 'dashboard.incidents',
              icon: <template>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="currentColor"
                  class="inline-block size-4 stroke-current"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
                  />
                </svg>
              </template> as TOC<{ Element: SVGSVGElement }>,
            },
          ]
        : []),
      ...(this.ability.can('manage', 'Role')
        ? [
            {
              type: 'link' as const,
              label: this.intl.t('dashboard.sidebar.roles'),
              route: 'dashboard.roles',
              icon: <template>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="currentColor"
                  class="inline-block size-4 stroke-current"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </template> as TOC<{ Element: SVGSVGElement }>,
            },
          ]
        : []),
    ];
  }

  get userForNav() {
    return {
      fullName:
        this.currentUser.currentUser.firstName +
        ' ' +
        this.currentUser.currentUser.lastName,
    };
  }

  logout = async () => {
    await this.session.invalidate();
  };

  <template>
    <TpkDashBoard
      @currentUser={{this.userForNav}}
      @onLogout={{this.logout}}
      @sidebarItems={{this.menuItems}}
      @languages={{this.languages}}
      @onLocaleChange={{this.handleLocaleChange}}
      @collapsed={{this.sidebarCollapsed}}
      @onCollapsedChange={{this.handleCollapsedChange}}
      @onSidebarToggle={{this.toggleSidebar}}
    >
      <:header>
        <div class="flex flex-col items-center justify-center p-2">
          <img
            src="/assets/img/internal_portal_logo.png"
            alt="Internal Portal"
            class="w-24 object-contain"
          />
        </div>
      </:header>
      <:content>
        <div class="p-6">
          {{outlet}}
        </div>
      </:content>
    </TpkDashBoard>
  </template>
}
