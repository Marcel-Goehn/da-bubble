import { PredefinedAvatar } from './user.store';

const pictures: Record<PredefinedAvatar, string> = {
  AVATAR_1: '/avatars/1.webp',
  AVATAR_2: '/avatars/2.webp',
  AVATAR_3: '/avatars/3.webp',
  AVATAR_4: '/avatars/4.webp',
  AVATAR_5: '/avatars/5.webp',
  AVATAR_6: '/avatars/6.webp',
};

/** The predefined Avatars in the order the Avatar step shows them. */
export const predefinedAvatars = Object.keys(pictures) as PredefinedAvatar[];

/** The static picture of [avatar], or `null` while the User has none (shown as a silhouette). */
export function avatarUrl(avatar: PredefinedAvatar): string;
export function avatarUrl(avatar: PredefinedAvatar | null): string | null;
export function avatarUrl(avatar: PredefinedAvatar | null): string | null {
  return avatar === null ? null : pictures[avatar];
}
