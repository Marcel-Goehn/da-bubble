import { NgOptimizedImage } from '@angular/common';
import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '../../shared/ui/icon';

/** The frame of the Impressum and Datenschutz pages: logo, a back link to the app, and a card. */
@Component({
  selector: 'app-legal-page',
  imports: [Icon, NgOptimizedImage, RouterLink, TranslocoPipe],
  template: `
    <div class="flex min-h-dvh flex-col">
      <header class="px-16 pt-40 lg:px-50 lg:pt-25">
        <div class="flex items-center gap-15">
          <img class="size-56 lg:size-70" ngSrc="/logo-mark.svg" width="70" height="70" alt="" />
          <span class="text-32 font-bold">{{ 'app.name' | transloco }}</span>
        </div>
      </header>
      <main class="flex flex-1 justify-center px-16 py-40">
        <article
          class="flex w-full max-w-1000 flex-col gap-20 self-start rounded-30 bg-surface p-30 lg:p-56"
        >
          <a routerLink="/" class="self-start rounded-20 p-8 hover:bg-hover">
            <app-icon name="arrowBack" [label]="'legal.back' | transloco" />
          </a>
          <h1 class="text-32 font-bold text-accent lg:text-46">{{ heading() }}</h1>
          <ng-content />
        </article>
      </main>
    </div>
  `,
})
export class LegalPage {
  /** Translated by the caller. */
  readonly heading = input.required<string>();
}
