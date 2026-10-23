import { inject, Service, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MeService } from '../../api/generated/me/me.service';
import { UserDto } from '../../api/generated/model';

export type { UserDto };

/** Users, starting with the logged-in one ("me"). */
@Service()
export class UserStore {
  private readonly meService = inject(MeService);
  private readonly meState = signal<UserDto | null>(null);

  /** The logged-in User; set once `loadMe` has run, which the shell's guard ensures. */
  readonly me = this.meState.asReadonly();

  /** Fetches the logged-in User. The backend creates them on this first request. */
  async loadMe(): Promise<void> {
    this.meState.set(await firstValueFrom(this.meService.getMe()));
  }
}
