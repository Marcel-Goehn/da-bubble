import { HttpContext, HttpEventType } from '@angular/common/http';
import { computed, inject, Service, signal } from '@angular/core';
import { filter, firstValueFrom, lastValueFrom, map, tap } from 'rxjs';
import { MeService } from '../../api/generated/me/me.service';
import { AvatarUploadDto, PredefinedAvatar, UserDto } from '../../api/generated/model';
import { UsersService } from '../../api/generated/users/users.service';
import { ROUTED_READ } from '../errors/error.interceptor';
import { avatarTypes } from './avatars';
import { problemCode } from '../errors/problem';

export type { AvatarUploadDto, UserDto };
export { PredefinedAvatar };

const byName = new Intl.Collator(undefined, { sensitivity: 'base' });

/** 5 MB, the most a picture uploaded as an Avatar may have. */
export const maxAvatarSize = 5 * 1024 * 1024;
/** An uploaded Avatar's URL is refetched at most this often per User, should it keep failing to load. */
const avatarRefreshMs = 60_000;

/** Why a picture can't be an Avatar. */
export type AvatarUploadError = 'tooLarge' | 'unsupported' | 'failed';

/** An Avatar upload that failed, and why. */
export class AvatarUploadFailure extends Error {
  constructor(readonly reason: AvatarUploadError) {
    super(reason);
  }
}

/** Users, starting with the logged-in one ("me"). */
@Service()
export class UserStore {
  private readonly meService = inject(MeService);
  private readonly usersService = inject(UsersService);
  private readonly meState = signal<UserDto | null>(null);
  private readonly byId = signal(new Map<string, UserDto>());
  private loading: Promise<void> | null = null;
  /** When each User's uploaded Avatar was last refetched, by id. */
  private readonly avatarRefreshedAt = new Map<string, number>();

  /** The logged-in User; set once `loadMe` has run, which the shell's guard ensures. */
  readonly me = this.meState.asReadonly();

  /** Every loaded User of the Workspace, the logged-in one included, by name. */
  readonly all = computed(() => {
    const me = this.me();
    const others = [...this.byId().values()].filter((user) => user.id !== me?.id);
    return (me ? [me, ...others] : others).sort((a, b) => byName.compare(a.name, b.name));
  });

  /** The User with [id], if loaded or opened; kept live by `user.updated`. */
  user(id: string): UserDto | undefined {
    const me = this.me();
    return me?.id === id ? me : this.byId().get(id);
  }

  /** Fetches every User of the Workspace once; later calls wait for the same request. */
  load(): Promise<void> {
    this.loading ??= firstValueFrom(this.usersService.listUsers()).then(
      (users) =>
        this.byId.update((known) => new Map([...known, ...users.map((u) => [u.id, u] as const)])),
      (error: unknown) => {
        this.loading = null;
        throw error;
      },
    );
    return this.loading;
  }

  /**
   * The User a route opens, e.g. `/dm/:userId`. One who joined after the Workspace was loaded is asked for,
   * so the error interceptor sends the User to `/` when there is no such User.
   */
  async open(id: string): Promise<UserDto> {
    await this.load();
    const known = this.user(id);
    if (known) {
      return known;
    }
    const context = new HttpContext().set(ROUTED_READ, true);
    const user = await firstValueFrom(this.usersService.getUser(id, { context }));
    this.byId.update((map) => new Map(map).set(user.id, user));
    return user;
  }

  /** Fetches the logged-in User. The backend creates them on this first request. */
  async loadMe(): Promise<UserDto> {
    const me = await firstValueFrom(this.meService.getMe());
    this.meState.set(me);
    return me;
  }

  /** Takes in [user] as they are now, e.g. after they changed their name or Avatar. */
  upsert(user: UserDto): void {
    if (this.me()?.id === user.id) {
      this.meState.set(user);
    }
    this.byId.update((map) => new Map(map).set(user.id, user));
  }

  /** Renames the logged-in User to [name]; the backend trims it. */
  async rename(name: string): Promise<void> {
    this.upsert(await firstValueFrom(this.meService.rename({ name })));
  }

  /** Gives the logged-in User one of the predefined Avatars. */
  async setAvatar(avatar: PredefinedAvatar): Promise<void> {
    this.upsert(await firstValueFrom(this.meService.setAvatar({ avatar })));
  }

  /** Gives the logged-in User the Avatar they uploaded as [uploadId]. */
  async useUploadedAvatar(uploadId: number): Promise<void> {
    this.upsert(await firstValueFrom(this.meService.setAvatar({ uploadId })));
  }

  /**
   * Uploads [file] as the logged-in User's next Avatar, telling [progress] how much of it has arrived (0 to
   * 1). Nothing changes until it's saved with [useUploadedAvatar]. Rejects with an [AvatarUploadFailure].
   */
  async uploadAvatar(file: File, progress: (fraction: number) => void): Promise<AvatarUploadDto> {
    if (file.size > maxAvatarSize) {
      throw new AvatarUploadFailure('tooLarge');
    }
    // A type the browser doesn't know is left to the backend, which tells pictures apart by their bytes.
    if (file.type !== '' && !avatarTypes.includes(file.type)) {
      throw new AvatarUploadFailure('unsupported');
    }
    try {
      return await lastValueFrom(
        this.meService.uploadAvatar({ file }, { observe: 'events', reportProgress: true }).pipe(
          tap((event) => {
            if (event.type === HttpEventType.UploadProgress && event.total) {
              progress(event.loaded / event.total);
            }
          }),
          filter((event) => event.type === HttpEventType.Response),
          map((response) => response.body!),
        ),
      );
    } catch (error) {
      const code = problemCode(error);
      throw new AvatarUploadFailure(
        code === 'AVATAR_TOO_LARGE'
          ? 'tooLarge'
          : code === 'AVATAR_TYPE_UNSUPPORTED'
            ? 'unsupported'
            : 'failed',
      );
    }
  }

  /**
   * Refetches the User whose uploaded Avatar [url] stopped loading: its presigned URL lasts 5 minutes. At
   * most once a minute per User, so one that keeps failing doesn't loop.
   */
  refreshAvatar(url: string): void {
    const user = this.all().find((candidate) => candidate.uploadedAvatarUrl === url);
    const now = Date.now();
    if (!user || now - (this.avatarRefreshedAt.get(user.id) ?? -Infinity) < avatarRefreshMs) {
      return;
    }
    this.avatarRefreshedAt.set(user.id, now);
    this.usersService.getUser(user.id).subscribe({
      next: (fresh) => this.upsert(fresh),
      // The broken picture stays until the next try.
      error: () => undefined,
    });
  }
}
