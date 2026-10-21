// PROTOTYPE variant A, "Zahl-Pill": solid purple count pill at the row end, "N neu" as a pill, legal links as a quieter second group in the menu.
import { Component, input, output } from '@angular/core';
import { Conv, ProtoAvatar, cap } from './prototype-bits';

@Component({
  selector: 'app-row-a',
  imports: [ProtoAvatar],
  template: `
    @let c = conv();
    @if (c.kind === 'channel') {
      <span class="material-symbols-outlined">tag</span>
    } @else {
      <app-proto-avatar [src]="c.avatar!" [online]="!!c.online" />
    }
    <span class="truncate" [class.font-bold]="c.unread">{{ c.name }}@if (c.isMe) { (Du)}</span>
    @if (c.unread) {
      <span class="ml-auto grid h-6 min-w-6 place-items-center rounded-full bg-primary px-1.5 text-xs font-bold text-white">{{ cap(c.unread) }}</span>
    }
  `,
  host: { class: 'contents' },
})
export class RowA {
  readonly conv = input.required<Conv>();
  protected readonly cap = cap;
}

/** Collapsed section: the sum as the same pill. */
@Component({
  selector: 'app-section-a',
  template: `
    @if (n() && collapsed()) {
      <span class="grid h-6 min-w-6 place-items-center rounded-full bg-primary px-1.5 text-xs font-bold text-white">{{ cap(n()) }}</span>
    }
  `,
})
export class SectionA {
  readonly n = input.required<number>();
  readonly collapsed = input.required<boolean>();
  protected readonly cap = cap;
}

@Component({
  selector: 'app-thread-line-a',
  template: `
    <button class="flex items-center gap-3 text-left" (click)="open.emit()">
      <span class="text-lg text-purple-3 hover:font-bold">{{ replies() }} Antworten</span>
      @if (fresh()) {
        <span class="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-white">{{ fresh() }} neu</span>
      }
      <span class="text-sm text-text-gray">Letzte Antwort 14:56</span>
    </button>
  `,
})
export class ThreadLineA {
  readonly replies = input.required<number>();
  readonly fresh = input.required<number>();
  readonly open = output();
}

/** Desktop dropdown / mobile bottom sheet: Profil, Log out, then a divider and smaller grey legal links. */
@Component({
  selector: 'app-menu-a',
  template: `
    @if (mobile()) {
      <div class="rounded-t-[30px] bg-white px-10 pt-4 pb-8 shadow-[0_-4px_20px_rgba(0,0,0,0.15)]">
        <div class="mx-auto mb-6 h-1.5 w-16 rounded-full bg-neutral-300"></div>
        <button class="flex w-full items-center gap-4 py-3 text-xl"><span class="material-symbols-outlined">account_circle</span>Profil</button>
        <button class="flex w-full items-center gap-4 py-3 text-xl"><span class="material-symbols-outlined">logout</span>Log out</button>
        <hr class="my-3 border-line" />
        <button class="flex w-full items-center gap-4 py-2 text-text-gray" (click)="legal.emit('Impressum')"><span class="material-symbols-outlined !text-xl">info</span>Impressum</button>
        <button class="flex w-full items-center gap-4 py-2 text-text-gray" (click)="legal.emit('Datenschutz')"><span class="material-symbols-outlined !text-xl">shield</span>Datenschutz</button>
      </div>
    } @else {
      <div class="w-[280px] rounded-[30px] rounded-tr-none bg-white p-6 text-center shadow-xl">
        <button class="block w-full rounded-full py-2 text-2xl hover:bg-bg-lavender hover:text-purple-3">Profil</button>
        <button class="block w-full rounded-full py-2 text-2xl hover:bg-bg-lavender hover:text-purple-3">Log out</button>
        <hr class="my-3 border-line" />
        <button class="block w-full rounded-full py-1 text-text-gray hover:text-purple-3" (click)="legal.emit('Impressum')">Impressum</button>
        <button class="block w-full rounded-full py-1 text-text-gray hover:text-purple-3" (click)="legal.emit('Datenschutz')">Datenschutz</button>
      </div>
    }
  `,
})
export class MenuA {
  readonly mobile = input(false);
  readonly legal = output<'Impressum' | 'Datenschutz'>();
}
