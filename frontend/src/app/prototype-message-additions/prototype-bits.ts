// PROTOTYPE: the Figma pieces every variant keeps as drawn.
import { Component, Directive, ElementRef, afterNextRender, inject, input, output } from '@angular/core';

/** Figma 52/52c: hover reaction bar; ⋮ only on your own Messages. */
@Component({
  selector: 'app-proto-reaction-bar',
  template: `
    <div
      class="flex items-center gap-[2px] rounded-[25px_25px_0_25px] border border-line bg-white px-4 py-[2px]"
      (click)="$event.stopPropagation()"
    >
      <button class="grid size-10 place-items-center rounded-full text-[22px] hover:bg-bg-lavender" (click)="quick.emit('✅')">✅</button>
      <button class="grid size-10 place-items-center rounded-full text-[22px] hover:bg-bg-lavender" (click)="quick.emit('👍')">👍</button>
      <button
        class="grid size-10 place-items-center rounded-full hover:bg-bg-lavender hover:text-purple-3"
        [class.bg-bg-lavender]="pickerOpen()"
        [class.text-purple-3]="pickerOpen()"
        (click)="addReaction.emit()"
      >
        <span class="material-symbols-outlined">add_reaction</span>
      </button>
      <button class="grid size-10 place-items-center rounded-full hover:bg-bg-lavender hover:text-purple-3">
        <span class="material-symbols-outlined">comment</span>
      </button>
      @if (mine()) {
        <button
          class="grid size-10 place-items-center rounded-full hover:bg-bg-lavender hover:text-purple-3"
          [class.bg-bg-lavender]="menuOpen()"
          [class.text-purple-3]="menuOpen()"
          (click)="more.emit()"
        >
          <span class="material-symbols-outlined">more_vert</span>
        </button>
      }
    </div>
  `,
})
export class ProtoReactionBar {
  readonly mine = input(false);
  readonly menuOpen = input(false);
  readonly pickerOpen = input(false);
  readonly quick = output<string>();
  readonly addReaction = output<void>();
  readonly more = output<void>();
}

/** Figma 54–57: reaction pills plus the add-reaction icon. */
@Component({
  selector: 'app-proto-reactions',
  template: `
    <div class="flex flex-wrap items-center gap-2" [class.justify-end]="mine()">
      @for (r of reactions(); track r.emoji) {
        <span class="flex items-center gap-2 rounded-full border border-line bg-white px-[10px] py-[3px] text-base">
          <span class="text-[18px]">{{ r.emoji }}</span>{{ r.count }}
        </span>
      }
      @if (reactions().length) {
        <button class="material-symbols-outlined hover:text-purple-3" (click)="add.emit(); $event.stopPropagation()">add_reaction</button>
      }
    </div>
  `,
})
export class ProtoReactions {
  readonly reactions = input.required<{ emoji: string; count: number }[]>();
  readonly mine = input(false);
  readonly add = output<void>();
}

/** Material-ish icon per file type. */
export function fileIcon(name: string) {
  const e = name.split('.').pop()!.toLowerCase();
  if (e === 'pdf') return 'picture_as_pdf';
  if (['doc', 'docx'].includes(e)) return 'description';
  if (['xls', 'xlsx', 'csv'].includes(e)) return 'table_chart';
  if (['mov', 'mp4'].includes(e)) return 'movie';
  return 'draft';
}

/** Chats open at the newest Message. */
@Directive({ selector: '[appProtoScrollBottom]' })
export class ProtoScrollBottom {
  constructor() {
    const el = inject(ElementRef).nativeElement as HTMLElement;
    afterNextRender(() => (el.scrollTop = el.scrollHeight));
  }
}
