import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '../../shared/ui/icon';

/** The Thread of a Message, beside its Conversation. TODO(#58): the parent Message and its Replies. */
@Component({
  selector: 'app-thread-pane',
  imports: [Icon, RouterLink, TranslocoPipe],
  host: { class: 'contents' },
  template: `
    <aside
      class="flex min-w-0 flex-col bg-surface max-lg:hidden max-lg:flex-1 max-lg:group-data-[pane=thread]:flex lg:w-485 lg:shrink-0 lg:rounded-30"
      aria-labelledby="thread-title"
    >
      <header class="flex items-center justify-between px-16 py-20 shadow-header lg:px-40 lg:py-32">
        <h2 id="thread-title" class="text-20 font-bold lg:text-24">
          {{ 'thread.title' | transloco }}
        </h2>
        <a class="rounded-20 p-8 hover:bg-hover" [routerLink]="conversationUrl">
          <app-icon name="close" [label]="'thread.close' | transloco" />
        </a>
      </header>
      <div class="flex-1"></div>
    </aside>
  `,
})
export class ThreadPane {
  // Not "..", which would only drop `:messageId` of the two-segment `thread/:messageId`.
  protected readonly conversationUrl = [
    '/',
    ...inject(ActivatedRoute)
      .parent!.snapshot.pathFromRoot.flatMap((route) => route.url)
      .map((segment) => segment.path),
  ];
}
