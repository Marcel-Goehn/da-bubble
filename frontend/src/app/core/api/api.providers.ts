import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { EnvironmentProviders, Provider } from '@angular/core';
import {
  createInterceptorCondition,
  INCLUDE_BEARER_TOKEN_INTERCEPTOR_CONFIG,
  IncludeBearerTokenCondition,
  includeBearerTokenInterceptor,
} from 'keycloak-angular';

/** HttpClient for the backend: same-origin `/api` requests (proxied by ng serve) carry the Keycloak token. */
export function provideApi(): (Provider | EnvironmentProviders)[] {
  return [
    provideHttpClient(withInterceptors([includeBearerTokenInterceptor])),
    {
      provide: INCLUDE_BEARER_TOKEN_INTERCEPTOR_CONFIG,
      useValue: [
        createInterceptorCondition<IncludeBearerTokenCondition>({ urlPattern: /^\/api(\/.*)?$/ }),
      ],
    },
  ];
}
