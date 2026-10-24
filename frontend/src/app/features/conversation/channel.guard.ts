import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { ConversationStore } from '../../core/data/conversation.store';
import { ErrorService } from '../../core/errors/error.service';

/**
 * Opens `/channel/:id` only for a Channel the User can see. A failed read has already sent them to `/`
 * (error interceptor); an id that isn't a Channel's goes there the same way.
 */
export const channelGuard: CanActivateFn = async (route) => {
  const router = inject(Router);
  const errors = inject(ErrorService);
  const transloco = inject(TranslocoService);
  const conversations = inject(ConversationStore);
  const id = Number(route.paramMap.get('id'));
  const unavailable = () => {
    errors.show(transloco.translate('errors.conversationUnavailable'));
    return router.createUrlTree(['/']);
  };
  if (!Number.isSafeInteger(id) || id <= 0) {
    return unavailable();
  }
  try {
    const conversation = await conversations.open(id);
    return conversation.kind === 'CHANNEL' ? true : unavailable();
  } catch {
    return false;
  }
};
