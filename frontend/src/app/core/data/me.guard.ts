import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserDto, UserStore } from './user.store';

/** The logged-in User, fetched on the first navigation only. */
async function loadedMe(users: UserStore): Promise<UserDto> {
  return users.me() ?? (await users.loadMe());
}

/** Loads the logged-in User once, before the shell renders, and holds them on the Avatar step until they pick one. */
export const meGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const me = await loadedMe(inject(UserStore));
  return me.avatar === null ? router.createUrlTree(['/avatar']) : true;
};

/** Keeps Users who already have an Avatar off the Avatar step. */
export const avatarStepGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const me = await loadedMe(inject(UserStore));
  return me.avatar === null ? true : router.createUrlTree(['/']);
};
