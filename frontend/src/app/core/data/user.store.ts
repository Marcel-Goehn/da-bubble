import { HttpContext } from '@angular/common/http';
import { computed, inject, Service, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MeService } from '../../api/generated/me/me.service';
import { PredefinedAvatar, UserDto } from '../../api/generated/model';
import { UsersService } from '../../api/generated/users/users.service';
import { ROUTED_READ } from '../errors/error.interceptor';

export type { UserDto };
export { PredefinedAvatar };

const byName = new Intl.Collator(undefined, { sensitivity: 'base' });

/** Users, starting with the logged-in one ("me"). */
@Service()
export class UserStore {
  private readonly meService = inject(MeService);
  private readonly usersService = inject(UsersService);
  private readonly meState = signal<UserDto | null>(null);
  private readonly byId = signal(new Map<string, UserDto>());
  private loading: Promise<void> | null = null;

  /** The logged-in User; set once `loadMe` has run, which the shell's guard ensures. */
  readonly me = this.meState.asReadonly();

  /** Every loaded User of the Workspace, the logged-in one included, by name. */
  readonly all = computed(() => {
    const me = this.me();
    const others = [...this.byId().values()].filter((user) => user.id !== me?.id);
    return (me ? [me, ...others] : others).sort((a, b) => byName.compare(a.name, b.name));
  });

  /** The User with [id], if loaded or opened. TODO(#69): live `user.updated`. */
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

  /** Gives the logged-in User one of the predefined Avatars. */
  async setAvatar(avatar: PredefinedAvatar): Promise<void> {
    this.meState.set(await firstValueFrom(this.meService.setAvatar({ avatar })));
  }
}
