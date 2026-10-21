import { Component, computed, inject, input, isDevMode } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';

export interface PrototypeVariant {
  key: string;
  name: string;
}

/** PROTOTYPE: floating bar that cycles `?variant=` on the current route. Never shown in production builds. */
@Component({
  selector: 'app-prototype-switcher',
  host: { '(document:keydown)': 'onKey($event)' },
  template: `
    @if (devMode) {
      <div
        class="fixed bottom-4 left-1/2 z-[1000] flex -translate-x-1/2 items-center gap-3 rounded-full bg-neutral-900 px-3 py-2 font-mono text-sm text-white shadow-2xl"
      >
        <button class="rounded-full px-2 hover:bg-white/20" (click)="step(-1)">←</button>
        <span>{{ current().key }} ({{ current().name }})</span>
        <button class="rounded-full px-2 hover:bg-white/20" (click)="step(1)">→</button>
      </div>
    }
  `,
})
export class PrototypeSwitcher {
  readonly variants = input.required<PrototypeVariant[]>();

  protected readonly devMode = isDevMode();
  private readonly router = inject(Router);
  private readonly key = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map((p) => p.get('variant'))),
  );

  readonly current = computed(
    () => this.variants().find((v) => v.key === this.key()) ?? this.variants()[0],
  );

  step(delta: number) {
    const all = this.variants();
    const i = all.indexOf(this.current());
    const next = all[(i + delta + all.length) % all.length];
    this.router.navigate([], { queryParams: { variant: next.key }, replaceUrl: true });
  }

  onKey(e: KeyboardEvent) {
    const t = e.target as HTMLElement;
    if (t.closest('input, textarea, [contenteditable], emoji-picker')) return;
    if (e.key === 'ArrowLeft') this.step(-1);
    if (e.key === 'ArrowRight') this.step(1);
  }
}
