import { EnvironmentProviders } from '@angular/core';
import {
  AutoRefreshTokenService,
  provideKeycloak,
  UserActivityService,
  withAutoRefreshToken,
} from 'keycloak-angular';

/**
 * Keycloak's hosted login with Authorization Code + PKCE (ADR 0001). `check-sso` only picks up an existing
 * session; routes that need a User send visitors to the login through `authGuard`.
 */
export function provideAuth(): EnvironmentProviders {
  return provideKeycloak({
    config: { url: 'http://localhost:8080', realm: 'da-bubble', clientId: 'da-bubble-app' },
    initOptions: {
      onLoad: 'check-sso',
      silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
      pkceMethod: 'S256',
    },
    // Refreshes the token while the User is active; an idle tab is not logged out.
    features: [withAutoRefreshToken({ onInactivityTimeout: 'none' })],
    providers: [AutoRefreshTokenService, UserActivityService],
  });
}
