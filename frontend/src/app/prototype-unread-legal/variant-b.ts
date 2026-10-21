// PROTOTYPE variant B, "Dezent": bold name + purple dot at the left edge, count as plain grey text; "N neu" as red text; legal links as equal menu items.
import { Component, input, output } from '@angular/core';
import { Conv, ProtoAvatar, cap } from './prototype-bits';

@Component({
  selector: 'app-row-b',
  imports: [ProtoAvatar],
  template: `
    @let c = conv();
    <span class="absolute -left-4 size-2 rounded-full" [class.bg-primary]="c.unread"></span>
    @if (c.kind === 'channel') {
      <span class="material-symbols-outlined">tag</span>
    } @else {
      <app-proto-avatar [src]="c.avatar!" [online]="!!c.online" />
    }
    <span class="truncate" [class.font-extrabold]="c.unread" [class.text-black]="c.unread">{{ c.name }}@if (c.isMe) { (Du)}</span>
    @if (c.unread) {
      <span class="ml-auto text-sm font-semibold text-text-gray">{{ cap(c.unread) }}</span>
    }
  `,
  host: { class: 'contents' },
})
export class RowB {
  readonly conv = input.required<Conv>();
  protected readonly cap = cap;
}

/** Collapsed section: just the dot, no number. */
@Component({
  selector: 'app-section-b',
  template: `
    @if (n() && collapsed()) {
      <span class="size-2 rounded-full bg-primary" title="{{ n() }} ungelesen"></span>
    }
  `,
})
export class SectionB {
  readonly n = input.required<number>();
  readonly collapsed = input.required<boolean>();
}

@Component({
  selector: 'app-thread-line-b',
  template: `
    <button class="flex items-center gap-2 text-left" (click)="open.emit()">
      <span class="text-lg text-purple-3 hover:font-bold">{{ replies() }} Antworten</span>
      @if (fresh()) {
        <span class="text-lg font-bold text-danger">· {{ fresh() }} neu</span>
      }
      <span class="ml-2 text-sm text-text-gray">Letzte Antwort 14:56</span>
    </button>
  `,
})
export class ThreadLineB {
  readonly replies = input.required<number>();
  readonly fresh = input.required<number>();
  readonly open = output();
}

/** Four equal items: Profil, Log out, Impressum, Datenschutz. */
@Component({
  selector: 'app-menu-b',
  template: `
    @if (mobile()) {
      <div class="rounded-t-[30px] bg-white px-10 pt-4 pb-8 shadow-[0_-4px_20px_rgba(0,0,0,0.15)]">
        <div class="mx-auto mb-6 h-1.5 w-16 rounded-full bg-neutral-300"></div>
        <button class="flex w-full items-center gap-4 py-3 text-xl"><span class="material-symbols-outlined">account_circle</span>Profil</button>
        <button class="flex w-full items-center gap-4 py-3 text-xl"><span class="material-symbols-outlined">logout</span>Log out</button>
        <button class="flex w-full items-center gap-4 py-3 text-xl" (click)="legal.emit('Impressum')"><span class="material-symbols-outlined">info</span>Impressum</button>
        <button class="flex w-full items-center gap-4 py-3 text-xl" (click)="legal.emit('Datenschutz')"><span class="material-symbols-outlined">shield</span>Datenschutz</button>
      </div>
    } @else {
      <div class="w-[280px] rounded-[30px] rounded-tr-none bg-white p-6 text-center shadow-xl">
        @for (item of items; track item) {
          <button
            class="block w-full rounded-full py-2 text-2xl hover:bg-bg-lavender hover:text-purple-3"
            (click)="item === 'Impressum' || item === 'Datenschutz' ? legal.emit(item) : null"
          >{{ item }}</button>
        }
      </div>
    }
  `,
})
export class MenuB {
  readonly mobile = input(false);
  readonly legal = output<'Impressum' | 'Datenschutz'>();
  protected readonly items = ['Profil', 'Log out', 'Impressum', 'Datenschutz'] as const;
}
