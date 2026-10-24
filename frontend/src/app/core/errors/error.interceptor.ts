import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { catchError, throwError } from 'rxjs';
import { ErrorService } from './error.service';

/** Marks the read a route depends on, e.g. the Conversation `/channel/:id` opens. */
export const ROUTED_READ = new HttpContextToken(() => false);

/**
 * When a route's read is forbidden or not found, the User goes to `/` with a toast. The error still
 * reaches the caller, so a guard can cancel its navigation.
 */
export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const router = inject(Router);
  const errors = inject(ErrorService);
  const transloco = inject(TranslocoService);
  return next(request).pipe(
    catchError((error: unknown) => {
      if (
        request.context.get(ROUTED_READ) &&
        error instanceof HttpErrorResponse &&
        (error.status === 403 || error.status === 404)
      ) {
        errors.show(transloco.translate('errors.conversationUnavailable'));
        void router.navigateByUrl('/');
      }
      return throwError(() => error);
    }),
  );
};
