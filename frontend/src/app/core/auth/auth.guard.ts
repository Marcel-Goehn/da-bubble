import { CanActivateFn } from '@angular/router';
import { createAuthGuard } from 'keycloak-angular';

/** Lets logged-in Users through and sends everyone else to the Keycloak login, returning to the same URL. */
export const authGuard = createAuthGuard<CanActivateFn>(
  async (_route, state, { authenticated, keycloak }) => {
    if (authenticated) {
      return true;
    }
    await keycloak.login({ redirectUri: `${window.location.origin}${state.url}` });
    return false;
  },
);
