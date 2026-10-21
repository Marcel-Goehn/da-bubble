// PROTOTYPE: three variants of unread badges, "N neu" and the legal links, switchable via ?variant= on /prototype/unread-legal.
// Each variant renders a desktop frame and a 430px mobile frame side by side, sharing one in-memory Workspace.
// The scenario bar pushes Messages and Replies in; opening a Conversation or the Thread clears its count.
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { PrototypeSwitcher, PrototypeVariant } from '../shared/prototype-switcher';
import { UnreadState, Variant } from './prototype-bits';
import { ProtoWorkspace } from './workspace';

const VARIANTS: (PrototypeVariant & { key: Variant; notes: string[] })[] = [
  {
    key: 'A',
    name: 'Zahl-Pill',
    notes: [
      'Lila Zahl-Pill rechts in der Zeile, Name fett',
      'Eingeklappte Gruppe: Summe als Pill',
      '„2 Antworten“ + lila Pill „1 neu“',
      'Menü: Profil, Log out, Trennlinie, Impressum/Datenschutz kleiner und grau',
    ],
  },
  {
    key: 'B',
    name: 'Dezent',
    notes: [
      'Lila Punkt links, Name fett, Zahl grau rechts',
      'Eingeklappte Gruppe: nur Punkt',
      '„2 Antworten · 1 neu“ in Rot',
      'Menü: vier gleichwertige Einträge',
    ],
  },
  {
    key: 'C',
    name: 'Am Avatar',
    notes: [
      'Rote Blase oben rechts am Avatar bzw. #, Name fett',
      'Eingeklappte Gruppe: rote Blase mit Summe',
      '„2 Antworten“ fett + roter Punkt „1 neu“',
      'Menü wie im Figma, darunter Fußzeile „Impressum · Datenschutz“',
    ],
  },
];

@Component({
  selector: 'app-prototype-unread-legal',
  imports: [PrototypeSwitcher, ProtoWorkspace],
  template: `
    <div class="min-h-dvh bg-neutral-200 p-6 pb-24 font-sans">
      <div class="mb-4 flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <h1 class="text-2xl font-bold">Variante {{ current().key }}: {{ current().name }}</h1>
        <span class="text-sm text-text-gray">PROTOTYP · Zeile klicken = öffnen · Avatar oben rechts = Benutzermenü · Gruppentitel klappt ein · Neu laden setzt zurück</span>
      </div>
      <ul class="mb-3 flex flex-wrap gap-2">
        @for (n of current().notes; track n) {
          <li class="rounded-full bg-white px-3 py-1 text-sm">{{ n }}</li>
        }
      </ul>
      <div class="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-neutral-400 bg-white/80 px-3 py-2 font-mono text-xs">
        <span class="text-neutral-500">Simulieren:</span>
        <button class="rounded bg-neutral-200 px-2 py-0.5 hover:bg-neutral-300" (click)="state.incoming('office')">Nachricht #Office-Team</button>
        <button class="rounded bg-neutral-200 px-2 py-0.5 hover:bg-neutral-300" (click)="state.incoming('sofia')">Sofia schreibt</button>
        <button class="rounded bg-neutral-200 px-2 py-0.5 hover:bg-neutral-300" (click)="state.incoming('elias')">Elias schreibt (neue DM)</button>
        <button class="rounded bg-neutral-200 px-2 py-0.5 hover:bg-neutral-300" (click)="state.incomingReply()">Antwort im Thread</button>
        <button class="rounded bg-neutral-200 px-2 py-0.5 hover:bg-neutral-300" (click)="state.incoming('allgemein', 120)">120 in #Allgemein</button>
        <button class="rounded bg-neutral-200 px-2 py-0.5 hover:bg-neutral-300" (click)="state.reset()">zurücksetzen</button>
        @if (state.log().length) {
          <span class="ml-2 text-neutral-500">Log: {{ state.log().join(' · ') }}</span>
        }
      </div>
      <div class="flex items-start gap-6">
        <section class="relative h-[960px] w-[1100px] shrink-0 overflow-hidden rounded-[30px] shadow">
          <app-proto-workspace [state]="state" [variant]="current().key" />
        </section>
        <section class="relative h-[932px] w-[446px] shrink-0 overflow-hidden rounded-[30px] border-8 border-neutral-800 shadow">
          <app-proto-workspace [state]="state" [variant]="current().key" [mobile]="true" />
        </section>
      </div>
    </div>
    <app-prototype-switcher [variants]="variants" />
  `,
})
export class PrototypeUnreadLegalPage {
  protected readonly variants = VARIANTS;
  protected readonly state = new UnreadState();
  private readonly key = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map((p) => p.get('variant'))),
  );
  protected readonly current = computed(
    () => VARIANTS.find((v) => v.key === this.key()) ?? VARIANTS[0],
  );
}
