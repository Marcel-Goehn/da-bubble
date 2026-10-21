// PROTOTYPE variant B, "Alles an Ort und Stelle": nothing floats.
// Delete confirms inline in the row (like the Figma's in-place edit), deleted = slim grey line,
// "(bearbeitet)" inside the bubble, attachments inside the bubble, pending uploads as tiles on top of the composer,
// one docked emoji picker (desktop: inside the composer, mobile: replaces the keyboard below it) also used for reactions.
import { Component, input } from '@angular/core';
import { ChatState, Msg, ext } from './prototype-data';
import { ProtoReactionBar, ProtoReactions, ProtoScrollBottom, fileIcon } from './prototype-bits';
import { PrototypeEmojiPicker } from './prototype-emoji-picker';

@Component({
  selector: 'app-variant-b',
  imports: [ProtoReactionBar, ProtoReactions, PrototypeEmojiPicker, ProtoScrollBottom],
  host: { class: 'block h-full' },
  template: `
    <div class="relative flex h-full flex-col overflow-hidden bg-white font-sans" (click)="s.menuFor.set(null)">
      <header class="flex items-center gap-2 px-[45px] py-6 text-2xl font-bold shadow-[0_2px_10px_rgba(0,0,0,0.08)]" [class.!px-4]="mobile()">
        <span class="material-symbols-outlined !text-[30px]">tag</span> Entwicklerteam
      </header>

      <div class="flex-1 overflow-y-auto pb-4 pt-6" appProtoScrollBottom>
        <div class="relative mx-[45px] my-2 border-t border-line" [class.!mx-4]="mobile()">
          <span class="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full border border-line bg-white px-4 py-1 text-lg">Heute</span>
        </div>

        @for (m of s.messages(); track m.id) {
          <div
            class="group relative mt-3 flex gap-5 px-[45px] hover:bg-bg-lavender"
            [class.py-3]="!m.deleted"
            [class.py-1]="m.deleted"
            [class.flex-row-reverse]="s.isMine(m)"
            [class.!px-4]="mobile()"
            [class.!gap-3]="mobile()"
            [class.bg-bg-lavender]="s.active() === m.id || s.confirmFor() === m.id"
            (mouseenter)="mobile() || s.active.set(m.id)"
            (click)="s.active.set(m.id); $event.stopPropagation()"
          >
            @if (m.deleted) {
              <div class="flex w-full flex-col gap-1 py-1" [class.items-end]="s.isMine(m)" [class.pl-[90px]]="!s.isMine(m) && !mobile()" [class.pr-[90px]]="s.isMine(m) && !mobile()">
                <span class="text-base italic text-text-gray">
                  <span class="material-symbols-outlined mr-1 align-[-5px] !text-[20px]">delete</span>
                  {{ s.user(m.author).name }} · Nachricht gelöscht · {{ m.time }} Uhr
                </span>
                @if (m.replies) {
                  <div class="flex items-baseline gap-5"><a class="text-lg text-purple-3">{{ m.replies.count }} Antwort{{ m.replies.count === 1 ? '' : 'en' }}</a><span class="text-sm text-text-gray">Letzte Antwort {{ m.replies.last }}</span></div>
                }
              </div>
            } @else {
              <img [src]="s.user(m.author).avatar" class="size-[70px] shrink-0 rounded-full" [class.!size-[50px]]="mobile()" />
              <div class="flex min-w-0 flex-col gap-2" [class.items-end]="s.isMine(m)">
                <div class="flex items-baseline gap-4" [class.flex-row-reverse]="s.isMine(m)">
                  <span class="text-lg font-bold">{{ s.user(m.author).name }}</span>
                  <span class="text-sm text-text-gray">{{ m.time }} Uhr</span>
                </div>

                @if (s.confirmFor() === m.id) {
                  <div class="flex max-w-[560px] flex-col gap-4 rounded-[20px] border border-line bg-white p-5" (click)="$event.stopPropagation()">
                    <p class="text-lg"><b>Nachricht löschen?</b> Text und Anhänge werden für alle entfernt. Antworten im Thread bleiben.</p>
                    <div class="flex justify-end gap-4">
                      <button class="rounded-full border border-purple-2 px-6 py-3 text-lg font-bold text-primary hover:bg-primary hover:text-white" (click)="s.confirmFor.set(null)">Abbrechen</button>
                      <button class="rounded-full bg-primary px-6 py-3 text-lg font-bold text-white hover:bg-purple-2" (click)="s.deleteMsg(m.id)">Löschen</button>
                    </div>
                  </div>
                } @else {
                  <div
                    class="flex flex-col gap-3 overflow-hidden rounded-[0_30px_30px_30px] bg-bg-lavender text-lg group-hover:bg-white"
                    [class.!bg-purple-2]="s.isMine(m)"
                    [class.text-white]="s.isMine(m)"
                    [class.!rounded-[30px_0_30px_30px]]="s.isMine(m)"
                    [class.!bg-white]="!s.isMine(m) && s.active() === m.id"
                    [class.max-w-[480px]]="images(m).length"
                  >
                    @if (images(m).length) {
                      <div class="grid gap-[2px]" [class.grid-cols-2]="images(m).length > 1">
                        @for (a of images(m); track a.name; let i = $index) {
                          <div class="h-[160px]" [class.col-span-2]="images(m).length === 3 && i === 0" [class.!h-[110px]]="mobile()" [style.background]="a.tint" [title]="a.name"></div>
                        }
                      </div>
                    }
                    @for (a of files(m); track a.name) {
                      <a class="mx-3 flex items-center gap-3 rounded-[14px] px-3 py-2" [class.bg-white]="!s.isMine(m)" [class.bg-white/20]="s.isMine(m)" [class.mt-3]="!images(m).length && $first">
                        <span class="grid size-10 place-items-center rounded-[10px] bg-purple-2 text-xs font-bold text-white" [class.!bg-white]="s.isMine(m)" [class.!text-purple-2]="s.isMine(m)">{{ ext(a.name) }}</span>
                        <span class="flex min-w-0 flex-col"><span class="truncate font-semibold">{{ a.name }}</span><span class="text-sm opacity-70">{{ a.size }}</span></span>
                        <span class="material-symbols-outlined ml-auto">download</span>
                      </a>
                    }
                    <div class="px-5 pb-[15px]" [class.pt-[15px]]="!m.attachments.length">
                      {{ m.text }}
                      @if (m.edited) { <span class="ml-1 whitespace-nowrap text-sm opacity-60">(bearbeitet)</span> }
                    </div>
                  </div>
                }
                <app-proto-reactions [reactions]="m.reactions" [mine]="s.isMine(m)" (add)="s.toggleEmoji(m.id)" />
                @if (m.replies) {
                  <div class="flex items-baseline gap-5"><a class="text-lg text-purple-3">{{ m.replies.count }} Antworten</a><span class="text-sm text-text-gray">Letzte Antwort {{ m.replies.last }}</span></div>
                }
              </div>
            }

            @if (s.active() === m.id && !m.deleted && s.confirmFor() !== m.id) {
              <div class="absolute -top-6 z-20" [class.right-10]="!s.isMine(m)" [class.left-10]="s.isMine(m)" [class.!left-4]="mobile()" [class.!right-4]="mobile()">
                <app-proto-reaction-bar
                  [mine]="s.isMine(m)"
                  [menuOpen]="s.menuFor() === m.id"
                  [pickerOpen]="s.emojiFor() === m.id"
                  (quick)="s.emojiFor.set(m.id); s.pickEmoji($event)"
                  (addReaction)="s.toggleEmoji(m.id)"
                  (more)="s.menuFor.set(s.menuFor() === m.id ? null : m.id)"
                />
                @if (s.menuFor() === m.id) {
                  <div class="absolute right-0 top-[52px] w-max overflow-hidden rounded-[30px] bg-white py-2 shadow-[0_6px_14px_rgba(0,0,0,0.2)]" (click)="$event.stopPropagation()">
                    <button class="flex w-full items-center gap-3 px-7 py-3 text-xl font-semibold hover:bg-bg-lavender hover:text-purple-3"><span class="material-symbols-outlined">edit</span>Nachricht bearbeiten</button>
                    <button class="flex w-full items-center gap-3 px-7 py-3 text-xl font-semibold hover:bg-bg-lavender hover:text-purple-3" (click)="s.confirmFor.set(m.id); s.menuFor.set(null)"><span class="material-symbols-outlined">delete</span>Nachricht löschen</button>
                  </div>
                }
              </div>
            }
          </div>
        }
      </div>

      <!-- composer -->
      <div class="mx-[45px] mb-6 overflow-hidden rounded-[20px] border border-line" [class.!mx-4]="mobile()" [class.!mb-0]="mobile() && s.emojiFor()" [class.!mb-4]="mobile() && !s.emojiFor()" (click)="$event.stopPropagation()">
        @if (s.pending().length) {
          <div class="flex gap-3 overflow-x-auto border-b border-line bg-bg-lavender/50 p-3">
            @for (p of s.pending(); track p.id) {
              <div class="relative flex w-[96px] shrink-0 flex-col gap-1" [title]="p.error ?? p.name">
                <div class="relative grid h-[96px] place-items-center overflow-hidden rounded-[14px] border bg-white" [class.border-line]="!p.error" [class.border-danger]="p.error" [style.background]="p.kind === 'image' ? p.tint : null">
                  @if (p.kind === 'file') {
                    <span class="flex flex-col items-center gap-1 text-purple-3"><span class="material-symbols-outlined !text-[34px]">{{ icon(p.name) }}</span><span class="text-xs font-bold">{{ ext(p.name) }}</span></span>
                  }
                  @if (p.error) {
                    <div class="absolute inset-0 grid place-items-center bg-white/85 px-2 text-center text-xs font-semibold text-danger"><span class="material-symbols-outlined">error</span>{{ p.error }}</div>
                  } @else if (p.progress < 100) {
                    <div class="absolute bottom-2 left-2 right-2 h-[6px] overflow-hidden rounded-full bg-white"><div class="h-full bg-purple-2" [style.width.%]="p.progress"></div></div>
                  }
                  <button class="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-white text-xs shadow" (click)="s.removePending(p.id)">✕</button>
                </div>
                <span class="truncate text-xs text-text-gray">{{ p.name }}</span>
              </div>
            }
          </div>
        }
        <div class="p-5">
          <textarea class="w-full resize-none text-lg outline-none placeholder:text-text-gray" rows="2" placeholder="Nachricht an #Entwicklerteam" [value]="s.text()" (input)="s.text.set($any($event.target).value)"></textarea>
          <div class="flex items-center gap-3">
            <button class="material-symbols-outlined grid size-10 place-items-center rounded-full hover:bg-bg-lavender hover:text-purple-3" [class.text-purple-3]="s.emojiFor() === 'composer'" [class.bg-bg-lavender]="s.emojiFor() === 'composer'" (click)="s.toggleEmoji('composer')">sentiment_satisfied</button>
            <button class="material-symbols-outlined grid size-10 place-items-center rounded-full hover:bg-bg-lavender hover:text-purple-3">alternate_email</button>
            <button class="material-symbols-outlined grid size-10 place-items-center rounded-full hover:bg-bg-lavender hover:text-purple-3" title="Datei anhängen" (click)="s.attachFake()">add_photo_alternate</button>
            <button class="material-symbols-outlined ml-auto !text-[32px] text-primary">send</button>
          </div>
        </div>
        @if (s.emojiFor() && !mobile()) {
          <div class="border-t border-line">
            @if (s.emojiFor() !== 'composer') {
              <div class="flex items-center justify-between bg-bg-lavender px-5 py-2 text-sm">Reaktion auf die Nachricht von {{ targetName() }}<button class="material-symbols-outlined !text-[18px]" (click)="s.emojiFor.set(null)">close</button></div>
            }
            <app-prototype-emoji-picker [fill]="true" [height]="'280px'" (picked)="s.pickEmoji($event)" />
          </div>
        }
      </div>
      @if (s.emojiFor() && mobile()) {
        <div class="mt-3 border-t border-line" (click)="$event.stopPropagation()">
          @if (s.emojiFor() !== 'composer') {
            <div class="flex items-center justify-between bg-bg-lavender px-4 py-2 text-sm">Reaktion auf die Nachricht von {{ targetName() }}<button class="material-symbols-outlined !text-[18px]" (click)="s.emojiFor.set(null)">close</button></div>
          }
          <app-prototype-emoji-picker [fill]="true" [height]="'300px'" (picked)="s.pickEmoji($event)" />
        </div>
      }
    </div>
  `,
})
export class VariantB {
  readonly mobile = input(false);
  protected readonly s = new ChatState();
  protected readonly icon = fileIcon;
  protected readonly ext = ext;
  images = (m: Msg) => m.attachments.filter((a) => a.kind === 'image');
  files = (m: Msg) => m.attachments.filter((a) => a.kind === 'file');
  targetName() {
    const m = this.s.messages().find((x) => x.id === this.s.emojiFor());
    return m ? this.s.user(m.author).name : '';
  }
}
