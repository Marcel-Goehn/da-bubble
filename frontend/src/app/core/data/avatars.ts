import { PredefinedAvatar, UserDto } from './user.store';

const pictures: Record<PredefinedAvatar, string> = {
  AVATAR_1: '/avatars/1.webp',
  AVATAR_2: '/avatars/2.webp',
  AVATAR_3: '/avatars/3.webp',
  AVATAR_4: '/avatars/4.webp',
  AVATAR_5: '/avatars/5.webp',
  AVATAR_6: '/avatars/6.webp',
  GUEST: '/avatars/guest.svg',
};

/** The predefined Avatars a User can pick, in the order the Avatar step shows them; the Guest's isn't one. */
export const predefinedAvatars = (Object.keys(pictures) as PredefinedAvatar[]).filter(
  (avatar) => avatar !== 'GUEST',
);

/** The pictures an Avatar may be uploaded from; the backend tells them apart by their bytes. */
export const avatarTypes = ['image/jpeg', 'image/png', 'image/webp'];

/** What a User's Avatar is shown from. */
export type AvatarOf = Pick<UserDto, 'avatar' | 'uploadedAvatarUrl'>;

/** The static picture of the predefined [avatar]. */
export function predefinedAvatarUrl(avatar: PredefinedAvatar): string {
  return pictures[avatar];
}

/**
 * The picture of [user]'s Avatar: the one they uploaded, or a predefined one. `null` while they have none or
 * aren't loaded (shown as a silhouette).
 */
export function avatarUrl(user: AvatarOf | null | undefined): string | null {
  if (!user) {
    return null;
  }
  return user.uploadedAvatarUrl ?? (user.avatar === null ? null : pictures[user.avatar]);
}
