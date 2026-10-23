import { Provider, signal } from '@angular/core';
import Keycloak, { KeycloakLoginOptions } from 'keycloak-js';
import { KEYCLOAK_EVENT_SIGNAL, KeycloakEvent, KeycloakEventType } from 'keycloak-angular';

export interface FakeKeycloakOptions {
  authenticated?: boolean;
  token?: string;
}

/**
 * Stands in for keycloak-js in component tests: no network, no redirects. Holds what the app reads from
 * Keycloak (authenticated, token) and records what it asks Keycloak to do (login).
 */
export class FakeKeycloak {
  authenticated: boolean;
  token: string | undefined;
  realmAccess = { roles: [] as string[] };
  resourceAccess = {};

  readonly login = vi.fn((options?: KeycloakLoginOptions) => {
    void options;
    return Promise.resolve();
  });
  readonly updateToken = vi.fn(() => Promise.resolve(false));

  constructor({ authenticated = true, token = 'fake-access-token' }: FakeKeycloakOptions = {}) {
    this.authenticated = authenticated;
    this.token = authenticated ? token : undefined;
  }
}

/** Provides [keycloak] wherever keycloak-angular and the app inject `Keycloak`. */
export function provideFakeKeycloak(keycloak: FakeKeycloak): Provider[] {
  return [
    { provide: Keycloak, useValue: keycloak },
    {
      provide: KEYCLOAK_EVENT_SIGNAL,
      useValue: signal<KeycloakEvent>({
        type: KeycloakEventType.Ready,
        args: keycloak.authenticated,
      }),
    },
  ];
}
