import { Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

/** `/`: on desktop the empty state next to the Workspace menu; on mobile only the menu shows. */
@Component({
  selector: 'app-workspace-home',
  imports: [TranslocoPipe],
  host: { class: 'contents' },
  template: `
    <main class="flex flex-1 items-center justify-center rounded-30 bg-surface p-40 max-lg:hidden">
      <h1 class="text-center text-24 text-text-muted">{{ 'workspace.emptyState' | transloco }}</h1>
    </main>
  `,
})
export class WorkspaceHome {}
