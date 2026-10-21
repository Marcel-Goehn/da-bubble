// PROTOTYPE: three variants of the undrawn message additions (delete, deleted placeholder, "(bearbeitet)",
// attachments in composer and Message, emoji picker placement), switchable via ?variant= on
// /prototype/message-additions. Each variant renders a desktop chat pane and a 430px mobile frame side by side.
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { PrototypeSwitcher, PrototypeVariant } from '../shared/prototype-switcher';
import { VariantA } from './variant-a';
import { VariantB } from './variant-b';
import { VariantC } from './variant-c';

const VARIANTS: (PrototypeVariant & { notes: string[] })[] = [
  {
    key: 'A',
    name: 'Figma-Muster',
    notes: [
      '⋮ → Popover mit „Nachricht bearbeiten“ + „Nachricht löschen“',
      'Löschen fragt in einem Dialog im Figma-Stil',
      'Gelöscht: gestrichelte Geister-Blase, Name/Zeit bleiben',
      '„(bearbeitet)“ neben der Uhrzeit',
      'Anhänge unter der Blase: Thumbnails + Datei-Pills',
      'Composer: 📎 neben ☺ und @, Vorschau-Chips im Feld',
      'Emoji-Picker: Popover am Auslöser (mobil volle Breite)',
    ],
  },
  {
    key: 'B',
    name: 'Alles an Ort und Stelle',
    notes: [
      '⋮ → Popover mit Icons',
      'Löschen bestätigt inline in der Zeile (wie Bearbeiten)',
      'Gelöscht: schmale graue Zeile ohne Avatar und Blase',
      '„(bearbeitet)“ klein in der Blase',
      'Anhänge in der Blase: Bild-Raster + Dateizeilen',
      'Composer: Kachel-Leiste über dem Text, Fehler auf der Kachel',
      'Emoji-Picker angedockt im Composer (mobil statt Tastatur), auch für Reaktionen',
    ],
  },
  {
    key: 'C',
    name: 'Schnell & mobil',
    notes: [
      'Löschen ohne Rückfrage, Toast „Rückgängig“ (6 s, erst dann wird gelöscht)',
      'Mobil: ⋮-Menü und Emoji-Picker als Bottom-Sheet',
      'Gelöscht: Systemzeile wie der Datums-Trenner',
      '„bearbeitet“ mit Stift in der Meta-Zeile unter der Blase',
      'Anhänge als Karten unter der Blase, mehrere Bilder gestapelt (+N)',
      'Composer: Upload-Liste mit Fortschritt, Drag & Drop (Datei draufziehen!)',
    ],
  },
];

@Component({
  selector: 'app-prototype-message-additions',
  imports: [PrototypeSwitcher, VariantA, VariantB, VariantC],
  template: `
    <div class="min-h-dvh bg-bg-lavender p-6 pb-24 font-sans">
      <div class="mb-4 flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <h1 class="text-2xl font-bold">Variante {{ current().key }}: {{ current().name }}</h1>
        <span class="text-sm text-text-gray">PROTOTYP · Hover/Tippen auf eine Nachricht, ⋮ bei eigenen Nachrichten, ☺ und Anhängen im Composer ausprobieren · Neu laden setzt zurück</span>
      </div>
      <ul class="mb-5 flex flex-wrap gap-2">
        @for (n of current().notes; track n) {
          <li class="rounded-full bg-white px-3 py-1 text-sm">{{ n }}</li>
        }
      </ul>
      <div class="flex items-start gap-6">
        <section class="h-[900px] w-[990px] shrink-0 overflow-hidden rounded-[30px] shadow">
          @switch (current().key) {
            @case ('A') { <app-variant-a /> }
            @case ('B') { <app-variant-b /> }
            @case ('C') { <app-variant-c /> }
          }
        </section>
        <section class="h-[900px] w-[430px] shrink-0 overflow-hidden rounded-[30px] border-8 border-neutral-800 shadow">
          @switch (current().key) {
            @case ('A') { <app-variant-a [mobile]="true" /> }
            @case ('B') { <app-variant-b [mobile]="true" /> }
            @case ('C') { <app-variant-c [mobile]="true" /> }
          }
        </section>
      </div>
    </div>
    <app-prototype-switcher [variants]="variants" />
  `,
})
export class PrototypeMessageAdditionsPage {
  protected readonly variants = VARIANTS;
  private readonly key = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map((p) => p.get('variant'))),
  );
  protected readonly current = computed(
    () => VARIANTS.find((v) => v.key === this.key()) ?? VARIANTS[0],
  );
}
