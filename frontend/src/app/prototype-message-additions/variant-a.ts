// PROTOTYPE variant A, "Figma-Muster": everything reuses a pattern the Figma already has.
// ⋮ popover gets a second row, delete asks in a Figma-style dialog, deleted = outlined ghost bubble,
// "(bearbeitet)" next to the time, attachments below the bubble, emoji picker as an anchored popover.
import { Component, input } from '@angular/core';
import { ChatState, Msg } from './prototype-data';
import { ProtoReactionBar, ProtoReactions, ProtoScrollBottom, fileIcon } from './prototype-bits';
import { PrototypeEmojiPicker } from './prototype-emoji-picker';

@Component({
  selector: 'app-variant-a',
  imports: [ProtoReactionBar, ProtoReactions, PrototypeEmojiPicker, ProtoScrollBottom],
  host: { class: 'block h-full' },
  template: `
    <div class="relative flex h-full flex-col overflow-hidden bg-white font-sans" (click)="close()">
      <header class="flex items-center gap-2 px-[45px] py-6 text-2xl font-bold shadow-[0_2px_10px_rgba(0,0,0,0.08)]" [class.!px-4]="mobile()">
        <span class="material-symbols-outlined !text-[30px]">tag</span> Entwicklerteam
      </header>

      <div class="flex-1 overflow-y-auto pb-4 pt-6" appProtoScrollBottom>
        <div class="relative mx-[45px] my-2 border-t border-line" [class.!mx-4]="mobile()">
          <span class="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full border border-line bg-white px-4 py-1 text-lg">Heute</span>
        </div>

        @for (m of s.messages(); track m.id) {
          <div
            class="group relative mt-3 flex gap-5 px-[45px] py-3 hover:bg-bg-lavender"
            [class.flex-row-reverse]="s.isMine(m)"
            [class.!px-4]="mobile()"
            [class.!gap-3]="mobile()"
            [class.bg-bg-lavender]="s.active() === m.id"
            (mouseenter)="mobile() || s.active.set(m.id)"
            (click)="s.active.set(m.id); $event.stopPropagation()"
          >
            <img [src]="s.user(m.author).avatar" class="size-[70px] shrink-0 rounded-full" [class.!size-[50px]]="mobile()" />
            <div class="flex min-w-0 flex-col gap-2" [class.items-end]="s.isMine(m)">
              <div class="flex items-baseline gap-4" [class.flex-row-reverse]="s.isMine(m)">
                <span class="text-lg font-bold">{{ s.user(m.author).name }}</span>
                <span class="text-sm text-text-gray">
                  {{ m.time }} Uhr
                  @if (m.edited) { <span class="ml-1">(bearbeitet)</span> }
                </span>
              </div>

              @if (m.deleted) {
                <div
                  class="rounded-[0_30px_30px_30px] border border-dashed border-line px-5 py-[15px] text-lg italic text-text-gray"
                  [class.!rounded-[30px_0_30px_30px]]="s.isMine(m)"
                >
                  <span class="material-symbols-outlined mr-2 align-[-5px] !text-[20px]">block</span>Diese Nachricht wurde gelöscht.
                </div>
              } @else {
                @if (m.text) {
                  <div
                    class="rounded-[0_30px_30px_30px] bg-bg-lavender px-5 py-[15px] text-lg group-hover:bg-white"
                    [class.!bg-purple-2]="s.isMine(m)"
                    [class.text-white]="s.isMine(m)"
                    [class.!rounded-[30px_0_30px_30px]]="s.isMine(m)"
                    [class.!bg-white]="!s.isMine(m) && s.active() === m.id"
                  >{{ m.text }}</div>
                }
                @if (images(m).length) {
                  <div class="flex flex-wrap gap-2" [class.justify-end]="s.isMine(m)">
                    @for (a of images(m); track a.name) {
                      <div class="h-[120px] w-[160px] rounded-[20px] border border-line" [class.!h-[90px]]="mobile()" [class.!w-[110px]]="mobile()" [style.background]="a.tint" [title]="a.name"></div>
                    }
                  </div>
                }
                @for (a of files(m); track a.name) {
                  <a class="flex max-w-full items-center gap-3 self-start rounded-full border border-line bg-white py-2 pl-3 pr-5 hover:border-purple-2" [class.!self-end]="s.isMine(m)">
                    <span class="material-symbols-outlined text-purple-3">{{ icon(a.name) }}</span>
                    <span class="truncate font-semibold">{{ a.name }}</span>
                    <span class="whitespace-nowrap text-sm text-text-gray">{{ a.size }}</span>
                  </a>
                }
                <app-proto-reactions [reactions]="m.reactions" [mine]="s.isMine(m)" (add)="s.toggleEmoji(m.id)" />
              }
              @if (m.replies) {
                <div class="flex items-baseline gap-5"><a class="text-lg text-purple-3">{{ m.replies.count }} Antworten</a><span class="text-sm text-text-gray">Letzte Antwort {{ m.replies.last }}</span></div>
              }
            </div>

            @if (s.active() === m.id && !m.deleted) {
              <div class="absolute -top-6 z-20" [class.right-10]="!s.isMine(m)" [class.left-10]="s.isMine(m)" [class.!left-4]="mobile()" [class.!right-4]="mobile()">
                <app-proto-reaction-bar
                  [mine]="s.isMine(m)"
                  [menuOpen]="s.menuFor() === m.id"
                  [pickerOpen]="s.emojiFor() === m.id"
                  (quick)="s.emojiFor.set(m.id); s.pickEmoji($event)"
                  (addReaction)="s.toggleEmoji(m.id)"
                  (more)="s.menuFor.set(s.menuFor() === m.id ? null : m.id); s.emojiFor.set(null)"
                />
                @if (s.menuFor() === m.id) {
                  <div class="absolute right-0 top-[52px] w-max overflow-hidden rounded-[30px] bg-white py-2 shadow-[0_6px_14px_rgba(0,0,0,0.2)]" (click)="$event.stopPropagation()">
                    <button class="block w-full px-8 py-3 text-left text-xl font-semibold hover:bg-bg-lavender hover:text-purple-3">Nachricht bearbeiten</button>
                    <button class="block w-full px-8 py-3 text-left text-xl font-semibold hover:bg-bg-lavender hover:text-purple-3" (click)="s.confirmFor.set(m.id); s.menuFor.set(null)">Nachricht löschen</button>
                  </div>
                }
                @if (s.emojiFor() === m.id) {
                  <div class="absolute top-[52px] overflow-hidden rounded-[20px] shadow-[0_6px_14px_rgba(0,0,0,0.2)]" [class.right-0]="!s.isMine(m)" [class.left-0]="s.isMine(m)" (click)="$event.stopPropagation()">
                    <app-prototype-emoji-picker [height]="'360px'" (picked)="s.pickEmoji($event)" />
                  </div>
                }
              </div>
            }
          </div>
        }
      </div>

      <!-- composer -->
      <div class="relative mx-[45px] mb-6 rounded-[20px] border border-line p-5" [class.!mx-4]="mobile()" [class.!mb-4]="mobile()" (click)="$event.stopPropagation()">
        @if (s.emojiFor() === 'composer') {
          <div class="absolute bottom-[calc(100%+8px)] left-0 z-30 overflow-hidden rounded-[20px] shadow-[0_6px_14px_rgba(0,0,0,0.2)]" [class.right-0]="mobile()">
            <app-prototype-emoji-picker [fill]="mobile()" [height]="mobile() ? '320px' : '400px'" (picked)="s.pickEmoji($event)" />
          </div>
        }
        <textarea class="w-full resize-none text-lg outline-none placeholder:text-text-gray" rows="2" placeholder="Nachricht an #Entwicklerteam" [value]="s.text()" (input)="s.text.set($any($event.target).value)"></textarea>

        @if (s.pending().length) {
          <div class="mb-3 flex flex-wrap items-start gap-3">
            @for (p of s.pending(); track p.id) {
              <div class="flex flex-col gap-1">
                @if (p.kind === 'image' && !p.error) {
                  <div class="relative size-16 overflow-hidden rounded-[12px] border border-line" [style.background]="p.tint">
                    @if (p.progress < 100) {
                      <div class="absolute inset-0 grid place-items-center bg-white/60 text-sm font-bold text-purple-3">{{ p.progress }}%</div>
                    }
                    <button class="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-white text-xs shadow" (click)="s.removePending(p.id)">✕</button>
                  </div>
                } @else {
                  <div class="relative flex items-center gap-2 overflow-hidden rounded-full border bg-white py-2 pl-3 pr-9" [class.border-line]="!p.error" [class.border-danger]="p.error">
                    <span class="material-symbols-outlined" [class.text-purple-3]="!p.error" [class.text-danger]="p.error">{{ p.error ? 'error' : icon(p.name) }}</span>
                    <span class="max-w-[160px] truncate font-semibold">{{ p.name }}</span>
                    <span class="text-sm text-text-gray">{{ p.size }}</span>
                    @if (!p.error && p.progress < 100) {
                      <div class="absolute bottom-0 left-0 h-[3px] bg-purple-2" [style.width.%]="p.progress"></div>
                    }
                    <button class="absolute right-2 grid size-5 place-items-center text-sm" (click)="s.removePending(p.id)">✕</button>
                  </div>
                }
                @if (p.error) {
                  <span class="pl-3 text-sm text-danger">{{ p.error }}</span>
                }
              </div>
            }
          </div>
        }

        <div class="flex items-center gap-3">
          <button class="material-symbols-outlined grid size-10 place-items-center rounded-full hover:bg-bg-lavender hover:text-purple-3" [class.text-purple-3]="s.emojiFor() === 'composer'" (click)="s.toggleEmoji('composer')">sentiment_satisfied</button>
          <button class="material-symbols-outlined grid size-10 place-items-center rounded-full hover:bg-bg-lavender hover:text-purple-3">alternate_email</button>
          <button class="material-symbols-outlined grid size-10 place-items-center rounded-full hover:bg-bg-lavender hover:text-purple-3" title="Datei anhängen" (click)="s.attachFake()">attach_file</button>
          <button class="material-symbols-outlined ml-auto !text-[32px] text-primary">send</button>
        </div>
      </div>

      @if (s.confirmFor(); as id) {
        <div class="absolute inset-0 z-40 grid place-items-center bg-black/30" (click)="s.confirmFor.set(null); $event.stopPropagation()">
          <div class="flex w-[480px] max-w-[90%] flex-col gap-6 rounded-[30px] bg-white p-10" [class.!p-6]="mobile()" (click)="$event.stopPropagation()">
            <div class="flex items-center justify-between">
              <h2 class="text-2xl font-bold">Nachricht löschen?</h2>
              <button class="material-symbols-outlined" (click)="s.confirmFor.set(null)">close</button>
            </div>
            <p class="text-lg">Die Nachricht und ihre Anhänge werden für alle entfernt. Das lässt sich nicht rückgängig machen. Antworten im Thread bleiben erhalten.</p>
            <div class="flex justify-end gap-4">
              <button class="rounded-full border border-purple-2 px-6 py-3 text-lg font-bold text-primary hover:bg-primary hover:text-white" (click)="s.confirmFor.set(null)">Abbrechen</button>
              <button class="rounded-full bg-primary px-6 py-3 text-lg font-bold text-white hover:bg-purple-2" (click)="s.deleteMsg(id)">Löschen</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class VariantA {
  readonly mobile = input(false);
  protected readonly s = new ChatState();
  protected readonly icon = fileIcon;
  images = (m: Msg) => m.attachments.filter((a) => a.kind === 'image');
  files = (m: Msg) => m.attachments.filter((a) => a.kind === 'file');
  close() {
    this.s.menuFor.set(null);
    this.s.emojiFor.set(null);
  }
}
