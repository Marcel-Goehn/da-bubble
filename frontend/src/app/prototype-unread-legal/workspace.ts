// PROTOTYPE: the Figma workspace (header, sidebar, Channel with one threaded Message) hosting the variant pieces.
import { NgTemplateOutlet } from '@angular/common';
import { Component, input, signal } from '@angular/core';
import { Conv, ProtoAvatar, ProtoLegal, UnreadState, Variant } from './prototype-bits';
import { MenuA, RowA, SectionA, ThreadLineA } from './variant-a';
import { MenuB, RowB, SectionB, ThreadLineB } from './variant-b';
import { MenuC, RowC, SectionC, ThreadLineC } from './variant-c';

@Component({
  selector: 'app-proto-workspace',
  imports: [NgTemplateOutlet, ProtoAvatar, ProtoLegal, RowA, RowB, RowC, SectionA, SectionB, SectionC, ThreadLineA, ThreadLineB, ThreadLineC, MenuA, MenuB, MenuC],
  template: `
    @let s = state();
    <div class="relative flex h-full flex-col overflow-hidden bg-bg-lavender font-sans">
      <!-- header -->
      <header class="flex shrink-0 items-center gap-4 px-6" [class]="mobile() ? 'h-[80px] bg-bg-lavender' : 'h-[90px]'">
        <span class="flex items-center gap-2 text-2xl font-bold">
          <span class="grid size-10 place-items-center rounded-lg bg-primary text-sm text-white">DA</span>
          @if (mobile() && !showList()) {
            <button class="material-symbols-outlined" (click)="showList.set(true)">arrow_back</button> Devspace
          } @else { DABubble }
        </span>
        @if (!mobile()) {
          <span class="flex h-[60px] flex-1 items-center rounded-full bg-white px-6 text-text-gray">Devspace durchsuchen</span>
        }
        <button class="ml-auto flex items-center gap-3 text-2xl font-bold" (click)="menuOpen.set(!menuOpen())">
          @if (!mobile()) { Frederik Beck }
          <app-proto-avatar src="prototype-avatars/avatar-3.png" [online]="true" />
          @if (!mobile()) { <span class="material-symbols-outlined">keyboard_arrow_down</span> }
        </button>
      </header>

      <div class="flex min-h-0 flex-1 gap-4" [class]="mobile() ? '' : 'px-4 pb-4'">
        <!-- sidebar -->
        @if (!mobile() || showList()) {
          <nav class="flex shrink-0 flex-col gap-1 overflow-y-auto bg-white px-6 py-6" [class]="mobile() ? 'w-full' : 'w-[320px] rounded-[30px]'">
            @if (!mobile()) {
              <div class="mb-4 flex items-center gap-3 text-2xl font-bold">
                <span class="grid size-12 place-items-center rounded-full bg-[#1e1e4f] text-white">&lt;/&gt;</span>Devspace
                <span class="material-symbols-outlined ml-auto">edit_square</span>
              </div>
            }
            <ng-container *ngTemplateOutlet="section; context: { kind: 'channel', title: 'Channels', icon: 'workspaces', items: s.channels(), sum: s.channelSum() }" />
            @if (!s.collapsed().channel) {
              <div class="ml-6 flex items-center gap-3 px-4 py-2" [class.text-purple-3]="mobile()">
                <span class="material-symbols-outlined">add_circle</span>Channel hinzufügen
              </div>
            }
            <div class="h-3"></div>
            <ng-container *ngTemplateOutlet="section; context: { kind: 'dm', title: 'Direktnachrichten', icon: 'account_circle', items: s.dms(), sum: s.dmSum() }" />
          </nav>
        }

        <!-- Conversation -->
        @if (!mobile() || !showList()) {
          <main class="flex min-w-0 flex-1 flex-col bg-white" [class.rounded-[30px]]="!mobile()">
            <div class="flex items-center gap-2 px-8 py-5 text-2xl font-bold shadow-[0_2px_10px_rgba(0,0,0,0.08)]">
              @if (s.current().kind === 'channel') {
                <span class="material-symbols-outlined !text-3xl">tag</span>{{ s.current().name }}
              } @else {
                <app-proto-avatar [src]="s.current().avatar!" [online]="!!s.current().online" />{{ s.current().name }}
              }
            </div>
            @if (s.threadOpen() && mobile()) {
              <div class="p-6">
                <p class="text-xl font-bold">Thread <span class="text-sm font-normal text-purple-2"># Entwicklerteam</span></p>
                <p class="mt-4 text-text-gray">{{ s.replies() }} Antworten, alle gelesen.</p>
                <button class="mt-4 text-purple-3" (click)="s.threadOpen.set(false)">← zurück</button>
              </div>
            } @else if (s.currentId() === 'entwickler') {
              <div class="flex gap-6 p-8">
                <div class="flex flex-1 gap-4">
                  <img src="prototype-avatars/avatar-1.png" class="size-[60px] shrink-0 rounded-full" alt="" />
                  <div class="flex flex-col gap-2">
                    <p><span class="text-lg font-bold">Noah Braun</span> <span class="ml-3 text-sm text-text-gray">14:25 Uhr</span></p>
                    <p class="w-fit rounded-[0_30px_30px_30px] bg-bg-lavender px-4 py-3 text-lg">Welche Version ist aktuell von Angular?</p>
                    @switch (variant()) {
                      @case ('A') { <app-thread-line-a [replies]="s.replies()" [fresh]="s.newReplies()" (open)="s.openThread()" /> }
                      @case ('B') { <app-thread-line-b [replies]="s.replies()" [fresh]="s.newReplies()" (open)="s.openThread()" /> }
                      @case ('C') { <app-thread-line-c [replies]="s.replies()" [fresh]="s.newReplies()" (open)="s.openThread()" /> }
                    }
                  </div>
                </div>
                @if (s.threadOpen() && !mobile()) {
                  <aside class="w-[260px] rounded-[20px] border border-line p-4">
                    <div class="flex items-center font-bold">Thread <button class="material-symbols-outlined ml-auto" (click)="s.threadOpen.set(false)">close</button></div>
                    <p class="mt-3 text-sm text-text-gray">{{ s.replies() }} Antworten, alle gelesen.</p>
                  </aside>
                }
              </div>
            } @else {
              <p class="p-8 text-text-gray">… Nachrichten …</p>
            }
          </main>
        }
      </div>

      <!-- user menu -->
      @if (menuOpen()) {
        <div class="absolute inset-0 z-30" [class.bg-black/20]="mobile()" (click)="menuOpen.set(false)">
          <div class="absolute" [class]="mobile() ? 'right-0 bottom-0 left-0' : 'top-[80px] right-6'" (click)="$event.stopPropagation()">
            @switch (variant()) {
              @case ('A') { <app-menu-a [mobile]="mobile()" (legal)="legal($event)" /> }
              @case ('B') { <app-menu-b [mobile]="mobile()" (legal)="legal($event)" /> }
              @case ('C') { <app-menu-c [mobile]="mobile()" (legal)="legal($event)" /> }
            }
          </div>
        </div>
      }
      @if (legalPage(); as page) {
        <app-proto-legal [page]="page" (back)="legalPage.set(null)" />
      }
    </div>

    <ng-template #section let-kind="kind" let-title="title" let-icon="icon" let-items="items" let-sum="sum">
      @let collapsed = kind === 'channel' ? state().collapsed().channel : state().collapsed().dm;
      <button class="flex items-center gap-2 py-2 text-xl font-bold hover:text-purple-3" (click)="state().toggle(kind)">
        <span class="material-symbols-outlined transition-transform" [class.-rotate-90]="collapsed">arrow_drop_down</span>
        <span class="material-symbols-outlined">{{ icon }}</span>{{ title }}
        @switch (variant()) {
          @case ('A') { <app-section-a [n]="sum" [collapsed]="collapsed" /> }
          @case ('B') { <app-section-b [n]="sum" [collapsed]="collapsed" /> }
          @case ('C') { <app-section-c [n]="sum" [collapsed]="collapsed" /> }
        }
      </button>
      @if (!collapsed) {
        @for (c of items; track c.id) {
          <button
            class="relative ml-6 flex items-center gap-3 rounded-full px-4 py-2 text-left text-lg hover:bg-bg-lavender"
            [class.bg-bg-lavender]="isActive(c)"
            [class.text-purple-3]="isActive(c)"
            (click)="openConv(c)"
          >
            @switch (variant()) {
              @case ('A') { <app-row-a [conv]="c" /> }
              @case ('B') { <app-row-b [conv]="c" /> }
              @case ('C') { <app-row-c [conv]="c" /> }
            }
          </button>
        }
      }
    </ng-template>
  `,
})
export class ProtoWorkspace {
  readonly state = input.required<UnreadState>();
  readonly variant = input.required<Variant>();
  readonly mobile = input(false);
  protected readonly menuOpen = signal(false);
  protected readonly showList = signal(true);
  protected readonly legalPage = signal<'Impressum' | 'Datenschutz' | null>(null);

  protected isActive(c: Conv) {
    return !this.mobile() && this.state().currentId() === c.id;
  }

  protected openConv(c: Conv) {
    this.state().open(c.id);
    this.showList.set(false);
  }

  protected legal(page: 'Impressum' | 'Datenschutz') {
    this.menuOpen.set(false);
    this.legalPage.set(page);
    this.state().showLegal(page);
  }
}
