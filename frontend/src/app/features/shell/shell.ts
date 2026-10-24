import { NgOptimizedImage } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ActivatedRouteSnapshot,
  NavigationEnd,
  Router,
  RouterLink,
  RouterOutlet,
} from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { filter, map } from 'rxjs';
import { ConversationStore } from '../../core/data/conversation.store';
import { UserStore } from '../../core/data/user.store';
import { ErrorService } from '../../core/errors/error.service';
import { Icon } from '../../shared/ui/icon';
import { Sidebar } from '../sidebar/sidebar';
import { UserMenu } from './user-menu';

/** Which pane a route shows on mobile, where there is room for one at a time. */
export type Pane = 'menu' | 'main' | 'thread';

/** The deepest route's `data.pane`; every Workspace route declares one. */
function activePane(route: ActivatedRouteSnapshot): Pane {
  let pane: Pane = 'menu';
  for (let current: ActivatedRouteSnapshot | null = route; current; current = current.firstChild) {
    pane = (current.data['pane'] as Pane | undefined) ?? pane;
  }
  return pane;
}

/**
 * The Workspace frame: header, Workspace menu, and the routed Conversation and Thread panes. Width decides
 * the layout (Tailwind breakpoints: one pane at a time below `lg`); state only sets `data-pane` and
 * `data-menu`, which the classes read.
 */
@Component({
  selector: 'app-shell',
  imports: [Icon, NgOptimizedImage, RouterLink, RouterOutlet, Sidebar, TranslocoPipe, UserMenu],
  template: `
    <div
      class="group flex h-dvh flex-col lg:gap-20 lg:px-20 lg:pt-25 lg:pb-20"
      [attr.data-pane]="pane()"
      [attr.data-menu]="menuOpen() ? 'open' : 'closed'"
    >
      <header class="flex items-center justify-between gap-20 px-16 py-15 lg:px-0 lg:py-0">
        <a
          routerLink="/"
          class="flex items-center gap-10 rounded-20 max-lg:group-data-[pane=menu]:hidden lg:hidden"
        >
          <app-icon name="arrowBack" [label]="'workspace.back' | transloco" />
          <app-icon name="workspaces" class="size-40! text-accent" />
          <span class="text-24 font-bold">{{ 'workspace.name' | transloco }}</span>
        </a>
        <div
          class="flex items-center gap-10 max-lg:group-data-[pane=main]:hidden max-lg:group-data-[pane=thread]:hidden lg:gap-15"
        >
          <img class="size-50 lg:size-70" ngSrc="/logo-mark.svg" width="70" height="70" alt="" />
          <span class="text-24 font-bold lg:text-32">{{ 'app.name' | transloco }}</span>
        </div>
        <app-user-menu />
      </header>

      <div class="flex min-h-0 flex-1 lg:gap-20">
        <nav
          id="workspace-menu"
          class="w-full shrink-0 overflow-y-auto bg-surface px-16 py-20 max-lg:hidden max-lg:group-data-[pane=menu]:flex lg:flex lg:w-366 lg:rounded-30 lg:px-30 lg:py-32 lg:group-data-[menu=closed]:hidden lg:max-xl:group-data-[pane=thread]:hidden"
          [attr.aria-label]="'sidebar.label' | transloco"
        >
          <app-sidebar class="w-full" />
        </nav>
        <router-outlet />
      </div>

      <button
        type="button"
        class="fixed bottom-150 left-0 flex writing-vertical items-center gap-10 rounded-r-30 bg-surface px-15 py-20 text-20 shadow-tab hover:text-interactive max-lg:hidden"
        aria-controls="workspace-menu"
        [attr.aria-expanded]="menuOpen()"
        (click)="menuOpen.set(!menuOpen())"
      >
        <app-icon [name]="menuOpen() ? 'leftPanelClose' : 'leftPanelOpen'" class="rotate-90" />
        {{ (menuOpen() ? 'workspace.closeMenu' : 'workspace.openMenu') | transloco }}
      </button>
    </div>
  `,
})
export class Shell {
  private readonly router = inject(Router);

  protected readonly menuOpen = signal(true);
  protected readonly pane = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => activePane(this.router.routerState.snapshot.root)),
    ),
    { initialValue: activePane(this.router.routerState.snapshot.root) },
  );

  constructor() {
    const errors = inject(ErrorService);
    const transloco = inject(TranslocoService);
    Promise.all([inject(ConversationStore).load(), inject(UserStore).load()]).catch(() =>
      errors.show(transloco.translate('errors.generic')),
    );
  }
}
