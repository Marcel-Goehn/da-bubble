import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '../../shared/ui/icon';
import { ErrorService } from './error.service';

/** The toast of [ErrorService], over every route. Screen readers hear it through the LiveAnnouncer. */
@Component({
  selector: 'app-toaster',
  imports: [Icon, TranslocoPipe],
  template: `
    @if (errors.toast(); as message) {
      <div
        class="fixed inset-x-16 bottom-40 z-20 mx-auto flex max-w-606 items-center gap-20 rounded-30 bg-surface py-15 pr-15 pl-30 shadow-overlay"
      >
        <p class="flex-1">{{ message }}</p>
        <button
          type="button"
          class="rounded-20 p-8 hover:bg-hover"
          [attr.aria-label]="'toast.dismiss' | transloco"
          (click)="errors.dismiss()"
        >
          <app-icon name="close" />
        </button>
      </div>
    }
  `,
})
export class Toaster {
  protected readonly errors = inject(ErrorService);
}
