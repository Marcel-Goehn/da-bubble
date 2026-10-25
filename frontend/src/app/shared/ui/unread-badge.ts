import { Component, computed, input } from '@angular/core';

/** Above it, the badge shows "99+". */
const MAX_SHOWN = 99;

/**
 * The red count bubble of Unread Messages, placed on an Avatar or icon by its host. Hidden from assistive
 * technology: the row it marks says the count in its name.
 */
@Component({
  selector: 'app-unread-badge',
  host: {
    class:
      'grid h-20 min-w-20 place-items-center rounded-full border-2 border-surface bg-danger px-4 text-12 font-bold text-text-inverse',
    'aria-hidden': 'true',
  },
  template: `{{ shown() }}`,
})
export class UnreadBadge {
  readonly count = input.required<number>();

  protected readonly shown = computed(() =>
    this.count() > MAX_SHOWN ? `${MAX_SHOWN}+` : String(this.count()),
  );
}
