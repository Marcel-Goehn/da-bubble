import { Component, inject } from '@angular/core';
import { UserStore } from '../../core/data/user.store';

@Component({
  selector: 'app-shell',
  template: `
    <main>
      <p>{{ me()?.name }}</p>
    </main>
  `,
})
export class Shell {
  protected readonly me = inject(UserStore).me;
}
