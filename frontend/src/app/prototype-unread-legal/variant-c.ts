// PROTOTYPE variant C, "Am Avatar": red count bubble on the Avatar / # icon (app-icon style); "N neu" with a red dot; legal links as a small footer line.
import { NgTemplateOutlet } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { Conv, ProtoAvatar, cap } from './prototype-bits';

const BUBBLE = 'absolute -top-1.5 -right-2 grid h-5 min-w-5 place-items-center rounded-full border-2 border-white bg-danger px-1 text-[11px] font-bold text-white';

@Component({
  selector: 'app-row-c',
  imports: [ProtoAvatar],
  template: `
    @let c = conv();
    @if (c.kind === 'channel') {
      <span class="relative">
        <span class="material-symbols-outlined">tag</span>
        @if (c.unread) { <span [class]="bubble">{{ cap(c.unread) }}</span> }
      </span>
    } @else {
      <app-proto-avatar [src]="c.avatar!" [online]="!!c.online">
        @if (c.unread) { <span [class]="bubble" class="!top-0 !right-0">{{ cap(c.unread) }}</span> }
      </app-proto-avatar>
    }
    <span class="truncate" [class.font-bold]="c.unread">{{ c.name }}@if (c.isMe) { (Du)}</span>
  `,
  host: { class: 'contents' },
})
export class RowC {
  readonly conv = input.required<Conv>();
  protected readonly cap = cap;
  protected readonly bubble = BUBBLE;
}

/** Collapsed section: red bubble with the sum next to the title. */
@Component({
  selector: 'app-section-c',
  template: `
    @if (n() && collapsed()) {
      <span class="relative block size-0"><span [class]="bubble" class="!-top-3 !right-auto !left-0">{{ cap(n()) }}</span></span>
    }
  `,
})
export class SectionC {
  readonly n = input.required<number>();
  readonly collapsed = input.required<boolean>();
  protected readonly cap = cap;
  protected readonly bubble = BUBBLE;
}

@Component({
  selector: 'app-thread-line-c',
  template: `
    <button class="flex items-center gap-3 text-left" (click)="open.emit()">
      <span class="text-lg text-purple-3 hover:font-bold" [class.font-bold]="fresh()">{{ replies() }} Antworten</span>
      @if (fresh()) {
        <span class="flex items-center gap-1.5 text-sm font-bold text-danger"><span class="size-2 rounded-full bg-danger"></span>{{ fresh() }} neu</span>
      }
      <span class="text-sm text-text-gray">Letzte Antwort 14:56</span>
    </button>
  `,
})
export class ThreadLineC {
  readonly replies = input.required<number>();
  readonly fresh = input.required<number>();
  readonly open = output();
}

/** Figma menu unchanged, plus a small "Impressum · Datenschutz" footer line. */
@Component({
  selector: 'app-menu-c',
  template: `
    @if (mobile()) {
      <div class="rounded-t-[30px] bg-white px-10 pt-4 pb-5 shadow-[0_-4px_20px_rgba(0,0,0,0.15)]">
        <div class="mx-auto mb-6 h-1.5 w-16 rounded-full bg-neutral-300"></div>
        <button class="flex w-full items-center gap-4 py-3 text-xl"><span class="material-symbols-outlined">account_circle</span>Profil</button>
        <button class="flex w-full items-center gap-4 py-3 text-xl"><span class="material-symbols-outlined">logout</span>Log out</button>
        <ng-container *ngTemplateOutlet="footer" />
      </div>
    } @else {
      <div class="w-[280px] rounded-[30px] rounded-tr-none bg-white p-6 pb-4 text-center shadow-xl">
        <button class="block w-full rounded-full py-2 text-2xl hover:bg-bg-lavender hover:text-purple-3">Profil</button>
        <button class="block w-full rounded-full py-2 text-2xl hover:bg-bg-lavender hover:text-purple-3">Log out</button>
        <ng-container *ngTemplateOutlet="footer" />
      </div>
    }
    <ng-template #footer>
      <p class="mt-4 flex justify-center gap-2 text-xs text-text-gray">
        <button class="hover:text-purple-3 hover:underline" (click)="legal.emit('Impressum')">Impressum</button>·
        <button class="hover:text-purple-3 hover:underline" (click)="legal.emit('Datenschutz')">Datenschutz</button>
      </p>
    </ng-template>
  `,
  imports: [NgTemplateOutlet],
})
export class MenuC {
  readonly mobile = input(false);
  readonly legal = output<'Impressum' | 'Datenschutz'>();
}
