import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { UserStore } from './user.store';

/** Loads the logged-in User once, before the shell renders. */
export const meGuard: CanActivateFn = async () => {
  const users = inject(UserStore);
  if (users.me() === null) {
    await users.loadMe();
  }
  return true;
};
