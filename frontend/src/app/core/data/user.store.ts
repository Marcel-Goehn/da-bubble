import { inject, Service, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MeService } from '../../api/generated/me/me.service';
import { PredefinedAvatar, UserDto } from '../../api/generated/model';
import { UsersService } from '../../api/generated/users/users.service';

export type { UserDto };
export { PredefinedAvatar };

/** Users, starting with the logged-in one ("me"). */
@Service()
export class UserStore {
  private readonly meService = inject(MeService);
  private readonly usersService = inject(UsersService);
  private readonly meState = signal<UserDto | null>(null);
  private readonly byId = signal(new Map<string, UserDto>());

  /** The logged-in User; set once `loadMe` has run, which the shell's guard ensures. */
  readonly me = this.meState.asReadonly();

  /** The User with [id], if they were in the Workspace when it was loaded. TODO(#56): live `user.updated`. */
  user(id: string): UserDto | undefined {
    const me = this.me();
    return me?.id === id ? me : this.byId().get(id);
  }

  /** Fetches every User of the Workspace. */
  async load(): Promise<void> {
    const users = await firstValueFrom(this.usersService.listUsers());
    this.byId.set(new Map(users.map((user) => [user.id, user])));
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
