// PROTOTYPE variant C, "Schnell & mobil": fewer clicks, mobile-native surfaces.
// Delete without confirmation + "Rückgängig" toast (the server delete is only sent when the toast runs out),
// deleted = centred system line like the date separator, "bearbeitet" in the meta line under the bubble,
// attachments as cards below the bubble, pending uploads as a list with progress, drag & drop onto the chat,
// ⋮ menu and emoji picker as bottom sheets on mobile, popovers on desktop.
import { Component, input, signal } from '@angular/core';
import { ChatState, Msg } from './prototype-data';
import { ProtoReactionBar, ProtoReactions, ProtoScrollBottom, fileIcon } from './prototype-bits';
import { PrototypeEmojiPicker } from './prototype-emoji-picker';

@Component({
  selector: 'app-variant-c',
  imports: [ProtoReactionBar, ProtoReactions, PrototypeEmojiPicker, ProtoScrollBottom],
  host: { class: 'block h-full' },
  template: `
    <div
      class="relative flex h-full flex-col overflow-hidden bg-white font-sans"
      (click)="close()"
      (dragover)="$event.preventDefault(); dragging.set(true)"
      (dragleave)="$event.target === $event.currentTarget && dragging.set(false)"
      (drop)="drop($event)"
    >
      <header class="flex items-center gap-2 px-[45px] py-6 text-2xl font-bold shadow-[0_2px_10px_rgba(0,0,0,0.08)]" [class.!px-4]="mobile()">
        <span class="material-symbols-outlined !text-[30px]">tag</span> Entwicklerteam
      </header>

      <div class="flex-1 overflow-y-auto pb-4 pt-6" appProtoScrollBottom>
        <div class="relative mx-[45px] my-2 border-t border-line" [class.!mx-4]="mobile()">
          <span class="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full border border-line bg-white px-4 py-1 text-lg">Heute</span>
        </div>

        @for (m of s.messages(); track m.id) {
          @if (m.deleted) {
            <div class="mx-[45px] mt-6 flex flex-col items-center gap-1" [class.!mx-4]="mobile()">
              <div class="relative w-full border-t border-dashed border-line">
                <span class="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-white px-4 py-1 text-sm italic text-text-gray" [class.!text-xs]="mobile()">
                  {{ s.user(m.author).name }} hat eine Nachricht gelöscht · {{ m.time }} Uhr
                </span>
              </div>
              @if (m.replies) {
                <a class="mt-3 text-base text-purple-3">{{ m.replies.count }} Antwort{{ m.replies.count === 1 ? '' : 'en' }} im Thread ansehen</a>
              }
            </div>
          } @else {
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
                  <span class="text-sm text-text-gray">{{ m.time }} Uhr</span>
                </div>
                <div
                  class="rounded-[0_30px_30px_30px] bg-bg-lavender px-5 py-[15px] text-lg group-hover:bg-white"
                  [class.!bg-purple-2]="s.isMine(m)"
                  [class.text-white]="s.isMine(m)"
                  [class.!rounded-[30px_0_30px_30px]]="s.isMine(m)"
                  [class.!bg-white]="!s.isMine(m) && s.active() === m.id"
                >{{ m.text }}</div>

                @for (a of images(m); track a.name; let first = $first) {
                  @if (first || expanded().has(m.id)) {
                    <figure class="relative overflow-hidden rounded-[20px] border border-line bg-white" [class.w-[320px]]="!mobile()" [class.w-[240px]]="mobile()">
                      <div class="h-[180px]" [class.!h-[140px]]="mobile()" [style.background]="a.tint"></div>
                      <figcaption class="flex items-center justify-between px-4 py-2 text-sm"><span class="truncate font-semibold">{{ a.name }}</span><span class="text-text-gray">{{ a.size }}</span></figcaption>
                      @if (first && images(m).length > 1 && !expanded().has(m.id)) {
                        <button class="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1 text-sm font-bold text-white" (click)="expand(m.id); $event.stopPropagation()">+{{ images(m).length - 1 }} Bilder</button>
                      }
                    </figure>
                  }
                }
                @for (a of files(m); track a.name) {
                  <div class="flex items-center gap-4 rounded-[20px] border border-line bg-white p-3 pr-4" [class.w-[320px]]="!mobile()" [class.w-[240px]]="mobile()">
                    <span class="grid size-12 shrink-0 place-items-center rounded-[14px] bg-bg-lavender text-purple-3"><span class="material-symbols-outlined">{{ icon(a.name) }}</span></span>
                    <span class="flex min-w-0 flex-col"><span class="truncate font-semibold">{{ a.name }}</span><span class="text-sm text-text-gray">{{ a.size }}</span></span>
                    <span class="material-symbols-outlined ml-auto text-purple-3">download</span>
                  </div>
                }

                <div class="flex flex-wrap items-center gap-4" [class.flex-row-reverse]="s.isMine(m)">
                  @if (m.edited) {
                    <span class="flex items-center gap-1 text-sm text-text-gray"><span class="material-symbols-outlined !text-[16px]">edit</span>bearbeitet</span>
                  }
                  <app-proto-reactions [reactions]="m.reactions" [mine]="s.isMine(m)" (add)="s.toggleEmoji(m.id)" />
                </div>
                @if (m.replies) {
                  <div class="flex items-baseline gap-5"><a class="text-lg text-purple-3">{{ m.replies.count }} Antworten</a><span class="text-sm text-text-gray">Letzte Antwort {{ m.replies.last }}</span></div>
                }
              </div>

              @if (s.active() === m.id) {
                <div class="absolute -top-6 z-20" [class.right-10]="!s.isMine(m)" [class.left-10]="s.isMine(m)" [class.!left-4]="mobile()" [class.!right-4]="mobile()">
                  <app-proto-reaction-bar
                    [mine]="s.isMine(m)"
                    [menuOpen]="s.menuFor() === m.id"
                    [pickerOpen]="s.emojiFor() === m.id"
                    (quick)="s.emojiFor.set(m.id); s.pickEmoji($event)"
                    (addReaction)="s.toggleEmoji(m.id)"
                    (more)="s.menuFor.set(s.menuFor() === m.id ? null : m.id); s.emojiFor.set(null)"
                  />
                  @if (s.menuFor() === m.id && !mobile()) {
                    <div class="absolute right-0 top-[52px] w-max overflow-hidden rounded-[30px] bg-white py-2 shadow-[0_6px_14px_rgba(0,0,0,0.2)]" (click)="$event.stopPropagation()">
                      <button class="block w-full px-8 py-3 text-left text-xl font-semibold hover:bg-bg-lavender hover:text-purple-3">Nachricht bearbeiten</button>
                      <button class="block w-full px-8 py-3 text-left text-xl font-semibold hover:bg-bg-lavender hover:text-purple-3" (click)="s.deleteWithUndo(m.id)">Nachricht löschen</button>
                    </div>
                  }
                  @if (s.emojiFor() === m.id && !mobile()) {
                    <div class="absolute top-[52px] overflow-hidden rounded-[20px] shadow-[0_6px_14px_rgba(0,0,0,0.2)]" [class.right-0]="!s.isMine(m)" [class.left-0]="s.isMine(m)" (click)="$event.stopPropagation()">
                      <app-prototype-emoji-picker [height]="'360px'" (picked)="s.pickEmoji($event)" />
                    </div>
                  }
                </div>
              }
            </div>
          }
        }
      </div>

      <!-- composer -->
      <div class="relative mx-[45px] mb-6 rounded-[20px] border border-line p-5" [class.!mx-4]="mobile()" [class.!mb-4]="mobile()" (click)="$event.stopPropagation()">
        @if (s.emojiFor() === 'composer' && !mobile()) {
          <div class="absolute bottom-[calc(100%+8px)] left-0 z-30 overflow-hidden rounded-[20px] shadow-[0_6px_14px_rgba(0,0,0,0.2)]">
            <app-prototype-emoji-picker [height]="'400px'" (picked)="s.pickEmoji($event)" />
          </div>
        }
        @if (s.pending().length) {
          <ul class="mb-3 flex flex-col gap-2">
            @for (p of s.pending(); track p.id) {
              <li class="relative flex items-center gap-3 overflow-hidden rounded-[14px] border px-3 py-2" [class.border-line]="!p.error" [class.border-danger]="p.error" [class.bg-danger/5]="p.error">
                @if (p.kind === 'image' && !p.error) {
                  <span class="size-9 shrink-0 rounded-[8px]" [style.background]="p.tint"></span>
                } @else {
                  <span class="grid size-9 shrink-0 place-items-center" [class.text-purple-3]="!p.error" [class.text-danger]="p.error"><span class="material-symbols-outlined">{{ p.error ? 'error' : icon(p.name) }}</span></span>
                }
                <span class="flex min-w-0 flex-1 flex-col">
                  <span class="truncate font-semibold">{{ p.name }}</span>
                  <span class="text-sm" [class.text-text-gray]="!p.error" [class.text-danger]="p.error">
                    {{ p.error ?? (p.progress < 100 ? 'Wird hochgeladen … ' + p.progress + ' %' : p.size) }}
                  </span>
                </span>
                <button class="material-symbols-outlined !text-[20px] text-text-gray hover:text-black" (click)="s.removePending(p.id)">close</button>
                @if (!p.error && p.progress < 100) {
                  <div class="absolute bottom-0 left-0 h-[3px] bg-purple-2" [style.width.%]="p.progress"></div>
                }
              </li>
            }
          </ul>
        }
        <textarea class="w-full resize-none text-lg outline-none placeholder:text-text-gray" rows="2" placeholder="Nachricht an #Entwicklerteam" [value]="s.text()" (input)="s.text.set($any($event.target).value)"></textarea>
        <div class="flex items-center gap-3">
          <button class="material-symbols-outlined grid size-10 place-items-center rounded-full hover:bg-bg-lavender hover:text-purple-3" title="Datei anhängen" (click)="s.attachFake()">add_circle</button>
          <button class="material-symbols-outlined grid size-10 place-items-center rounded-full hover:bg-bg-lavender hover:text-purple-3" [class.text-purple-3]="s.emojiFor() === 'composer'" (click)="s.toggleEmoji('composer')">sentiment_satisfied</button>
          <button class="material-symbols-outlined grid size-10 place-items-center rounded-full hover:bg-bg-lavender hover:text-purple-3">alternate_email</button>
          @if (!mobile()) { <span class="text-sm text-text-gray">oder Dateien hierher ziehen</span> }
          <button class="material-symbols-outlined ml-auto !text-[32px] text-primary">send</button>
        </div>
      </div>

      @if (dragging()) {
        <div class="pointer-events-none absolute inset-3 z-40 grid place-items-center rounded-[30px] border-4 border-dashed border-purple-2 bg-bg-lavender/90">
          <span class="flex flex-col items-center gap-2 text-2xl font-bold text-purple-3"><span class="material-symbols-outlined !text-[48px]">upload_file</span>Dateien hier ablegen</span>
        </div>
      }

      <!-- mobile bottom sheets -->
      @if (mobile() && (s.menuFor() || s.emojiFor())) {
        <div class="absolute inset-0 z-40 flex flex-col justify-end bg-black/30" (click)="close(); $event.stopPropagation()">
          <div class="rounded-t-[30px] bg-white pb-4 pt-3" (click)="$event.stopPropagation()">
            <div class="mx-auto mb-3 h-[5px] w-12 rounded-full bg-line"></div>
            @if (s.menuFor(); as id) {
              <button class="flex w-full items-center gap-4 px-6 py-4 text-xl font-semibold active:bg-bg-lavender"><span class="material-symbols-outlined">edit</span>Nachricht bearbeiten</button>
              <button class="flex w-full items-center gap-4 px-6 py-4 text-xl font-semibold active:bg-bg-lavender" (click)="s.deleteWithUndo(id)"><span class="material-symbols-outlined">delete</span>Nachricht löschen</button>
            } @else {
              <app-prototype-emoji-picker [fill]="true" [height]="'420px'" (picked)="s.pickEmoji($event)" />
            }
          </div>
        </div>
      }

      @if (s.undo()) {
        <div class="absolute bottom-[150px] left-1/2 z-50 flex -translate-x-1/2 items-center gap-6 whitespace-nowrap rounded-full bg-[#1b1b3a] px-6 py-3 text-white shadow-xl" (click)="$event.stopPropagation()">
          Nachricht gelöscht
          <button class="font-bold text-[#a7abff]" (click)="s.undoDelete()">Rückgängig</button>
        </div>
      }
    </div>
  `,
})
export class VariantC {
  readonly mobile = input(false);
  protected readonly s = new ChatState();
  protected readonly icon = fileIcon;
  protected readonly dragging = signal(false);
  protected readonly expanded = signal(new Set<string>());
  images = (m: Msg) => m.attachments.filter((a) => a.kind === 'image');
  files = (m: Msg) => m.attachments.filter((a) => a.kind === 'file');

  expand(id: string) {
    this.expanded.update((s) => new Set(s).add(id));
  }

  close() {
    this.s.menuFor.set(null);
    this.s.emojiFor.set(null);
  }

  drop(e: DragEvent) {
    e.preventDefault();
    this.dragging.set(false);
    for (const f of Array.from(e.dataTransfer?.files ?? [])) {
      const big = f.size > 10 * 1024 * 1024;
      this.s.pending.update((p) => [
        ...p,
        {
          id: Date.now() + Math.random(),
          kind: f.type.startsWith('image/') ? 'image' : 'file',
          name: f.name,
          size: `${(f.size / 1024 / 1024).toFixed(1).replace('.', ',')} MB`,
          tint: 'linear-gradient(135deg,#797ef3,#fbd38d)',
          progress: 100,
          error: big ? 'Datei zu groß (max. 10 MB)' : undefined,
        },
      ]);
    }
  }
}
