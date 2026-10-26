import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { avatarUrl } from './avatars';
import { UserDto, UserStore } from './user.store';

/** The logged-in User, fetched on the first navigation only. */
async function loadedMe(users: UserStore): Promise<UserDto> {
  return users.me() ?? (await users.loadMe());
}

/** Whether [user] has an Avatar yet: a predefined one or one they uploaded. */
function hasAvatar(user: UserDto): boolean {
  return avatarUrl(user) !== null;
}

/** Loads the logged-in User once, before the shell renders, and holds them on the Avatar step until they pick one. */
export const meGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const me = await loadedMe(inject(UserStore));
  return hasAvatar(me) ? true : router.createUrlTree(['/avatar']);
};

/** Keeps Users who already have an Avatar off the Avatar step. */
export const avatarStepGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const me = await loadedMe(inject(UserStore));
  return hasAvatar(me) ? router.createUrlTree(['/']) : true;
};
