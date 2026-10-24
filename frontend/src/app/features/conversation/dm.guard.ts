import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { ErrorService } from '../../core/errors/error.service';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Opens `/dm/:userId` only for an id that can name a User. Whether they exist is up to the pane, which shows
 * the DM before its first Message too.
 */
export const dmGuard: CanActivateFn = (route) => {
  if (uuid.test(route.paramMap.get('userId') ?? '')) {
    return true;
  }
  inject(ErrorService).show(inject(TranslocoService).translate('errors.conversationUnavailable'));
  return inject(Router).createUrlTree(['/']);
};
